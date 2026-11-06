// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {RotationController as RC} from "../src/RotationController.sol";
import {IQuoteSealResolver} from "../src/interfaces/IENSContext.sol";

contract RegistryMock {
    address public resolver;
    address public owner;
    uint64 public expiry;

    constructor(address r, address o, uint64 e) {
        resolver = r;
        owner = o;
        expiry = e;
    }

    function getResolver(string calldata) external view returns (address) {
        return resolver;
    }

    function findOwner(string calldata) external view returns (address) {
        return owner;
    }

    function findExpiry(string calldata) external view returns (uint64) {
        return expiry;
    }

    function change(address r, address o, uint64 e) external {
        resolver = r;
        owner = o;
        expiry = e;
    }
}

contract RootMock {
    address public child;

    constructor(address c) {
        child = c;
    }

    function getSubregistry(string calldata) external view returns (address) {
        return child;
    }

    function change(address c) external {
        child = c;
    }
}

contract ResolverMock {
    mapping(bytes32 => mapping(string => string)) private records;
    address public writer;
    bytes public aliasName;
    string public failKey;
    bool public noop;
    bool public reenter;
    bool public reentryRejected;
    bool public approvalObserved;

    function setup(bytes32 node, string calldata key, string calldata val) external {
        records[node][key] = val;
    }

    function configure(address w, string calldata fail, bool n, bool r) external {
        writer = w;
        failKey = fail;
        noop = n;
        reenter = r;
    }

    function setAlias(bytes calldata a) external {
        aliasName = a;
    }

    function getAlias(bytes calldata) external view returns (bytes memory) {
        return aliasName;
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        require(msg.sender == writer, "writer");
        require(keccak256(bytes(key)) != keccak256(bytes(failKey)), "write failed");
        if (reenter) {
            (bool ok,) = writer.call(abi.encodeCall(RC.activateRotation, (RC(writer).getRotationState().id)));
            require(!ok, "reentered");
            reentryRejected = true;
        }
        if (keccak256(bytes(key)) == keccak256("quoteseal.pendingPayTo") && bytes(value).length > 0) {
            approvalObserved = RC(writer).getRotationState().state == RC.State.PENDING_APPROVED;
        }
        if (!noop) records[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return records[node][key];
    }

    function resolve(bytes calldata, bytes calldata data) external view returns (bytes memory) {
        (bytes32 node, string memory key) = abi.decode(data[4:], (bytes32, string));
        return abi.encode(records[node][key]);
    }
}

abstract contract RotationFixture is Test {
    RC internal c;
    ResolverMock internal r;
    RegistryMock internal registry;
    RootMock internal root;
    uint256 internal constant OWNER_KEY = 11;
    uint256 internal constant OP_KEY = 22;
    uint256 internal constant ATTESTOR_KEY = 33;
    address internal owner;
    address internal op;
    address internal guardian = address(44);
    address internal attestor;
    bytes32 internal node;
    RC.Config internal config;

    function setUp() public virtual {
        vm.warp(1000);
        owner = vm.addr(OWNER_KEY);
        op = vm.addr(OP_KEY);
        attestor = vm.addr(ATTESTOR_KEY);
        node = keccak256(abi.encode(keccak256(abi.encode(bytes32(0), keccak256("eth"))), keccak256("merchant")));
        r = new ResolverMock();
        registry = new RegistryMock(address(r), owner, 1000000);
        root = new RootMock(address(registry));
        r.setup(node, "quoteseal.activePayTo", "0.0.123");
        r.setup(node, "quoteseal.profileVersion", "1");
        config = RC.Config(
            keccak256("merchant"),
            owner,
            guardian,
            attestor,
            address(registry),
            address(root),
            address(r),
            hex"086d65726368616e740365746800",
            node,
            1000000,
            90,
            120,
            300,
            "0.0.123",
            1
        );
        c = new RC(config);
        r.configure(address(c), "", false, false);
        _enroll(op);
    }

    function _sig(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(rr, s, v);
    }

    function _enroll(address account) internal {
        RC.Enrollment memory e = RC.Enrollment(c.merchantId(), account, 1, 999999, c.enrollmentNonce(), address(c));
        c.enrollOperator(e, _sig(OWNER_KEY, c.enrollmentDigest(e)));
    }

    function _propose() internal returns (RC.RotationApproval memory a) {
        vm.prank(op);
        bytes32 id = c.proposeRotation("0.0.456", uint64(block.timestamp + 1000));
        a = RC.RotationApproval(
            c.merchantId(),
            id,
            op,
            address(r),
            node,
            keccak256("0.0.123"),
            keccak256("0.0.456"),
            uint64(block.timestamp + 90),
            uint64(block.timestamp + 1000),
            c.proposalNonce(),
            uint64(block.timestamp),
            uint64(block.timestamp + 300)
        );
    }

    function _approve(RC.RotationApproval memory a) internal {
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }
}

contract RotationControllerTest is RotationFixture {
    function testPreviewProposalIdMatchesCanonicalProposalEncoding() public {
        uint64 expiry = uint64(block.timestamp + 1000);
        uint256 nonce = c.proposalNonce() + 1;
        bytes32 expected = keccak256(
            abi.encode(
                address(c),
                block.chainid,
                c.merchantId(),
                nonce,
                op,
                keccak256(bytes(c.activePayTo())),
                keccak256(bytes("0.0.456")),
                expiry
            )
        );
        assertEq(c.previewProposalId(op, "0.0.456", expiry), expected);

        vm.prank(op);
        bytes32 actual = c.proposeRotation("0.0.456", expiry);
        assertEq(actual, expected);
    }

    function testApprovalBindsProposalTimeEffectiveAtAndToleratesMiningDelay() public {
        RC.RotationApproval memory a = _propose();
        RC.Proposal memory p = c.getRotationState();
        assertEq(a.effectiveAt, p.proposedAt + c.rotationDelay());

        // Approval may be mined after the delay has elapsed. The signed effectiveAt
        // remains the proposal-time deadline; mining latency does not restart the delay.
        vm.warp(uint256(a.effectiveAt) + 17);
        a.authTime = uint64(block.timestamp);
        a.attestationExpiry = uint64(block.timestamp + 60);
        _approve(a);
        assertEq(c.getRotationState().effectiveAt, a.effectiveAt);
        assertEq(uint256(c.getRotationState().state), uint256(RC.State.PENDING_APPROVED));
    }

    function testApprovalRejectsEffectiveAtShortenedOrExtendedFromProposal() public {
        RC.RotationApproval memory a = _propose();
        a.effectiveAt--;
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.InvalidApproval.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testValidProposalAndApproval() public {
        RC.RotationApproval memory a = _propose();
        assertEq(c.pendingPayTo(), "");
        assertEq(r.text(node, "quoteseal.pendingPayTo"), "");
        assertEq(uint256(c.getRotationState().state), uint256(RC.State.PROPOSED));
        _approve(a);
        assertEq(c.pendingPayTo(), "0.0.456");
        assertTrue(r.approvalObserved());
        assertTrue(c.consumedApprovalNonce(a.proposalNonce));
    }

    function testStateSemanticsAndExplicitActivation() public {
        assertEq(uint256(c.payoutVerdict("0.0.123")), 0);
        assertEq(uint256(c.payoutVerdict("0.0.456")), 1);
        RC.RotationApproval memory a = _propose();
        _approve(a);
        assertEq(uint256(c.payoutVerdict("0.0.123")), 0);
        assertEq(uint256(c.payoutVerdict("0.0.456")), 2);
        vm.expectRevert(RC.InvalidState.selector);
        vm.prank(op);
        c.activateRotation(a.proposalId);
        vm.warp(a.effectiveAt);
        assertEq(c.activePayTo(), "0.0.123");
        assertEq(uint256(c.payoutVerdict("0.0.456")), 2);
        vm.prank(op);
        c.activateRotation(a.proposalId);
        assertEq(uint256(c.payoutVerdict("0.0.123")), 1);
        assertEq(uint256(c.payoutVerdict("0.0.456")), 0);
        assertEq(r.text(node, "quoteseal.activePayTo"), "0.0.456");
        assertEq(c.profileVersion(), 2);
    }

    function testWrongSigner() public {
        RC.RotationApproval memory a = _propose();
        bytes memory sig = _sig(77, c.approvalDigest(a));
        vm.expectRevert(RC.InvalidSignature.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testFuzzWrongBoundField(uint8 field) public {
        RC.RotationApproval memory a = _propose();
        field = uint8(bound(field, 0, 10));
        if (field == 0) a.merchantId = bytes32(uint256(1));
        if (field == 1) a.resolver = address(99);
        if (field == 2) a.namehash = bytes32(uint256(1));
        if (field == 3) a.oldPayToHash = keccak256("wrong");
        if (field == 4) a.newPayToHash = keccak256("wrong");
        if (field == 5) a.proposalId = bytes32(uint256(1));
        if (field == 6) a.operator = address(99);
        if (field == 7) a.proposalNonce++;
        if (field == 8) a.proposalExpiry++;
        if (field == 9) a.effectiveAt = uint64(block.timestamp + 89);
        if (field == 10) a.authTime = uint64(block.timestamp + 1);
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.InvalidApproval.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testWrongMerchant() public {
        testFuzzWrongBoundField(0);
    }

    function testWrongResolver() public {
        testFuzzWrongBoundField(1);
    }

    function testWrongNamehash() public {
        testFuzzWrongBoundField(2);
    }

    function testWrongOldPayout() public {
        testFuzzWrongBoundField(3);
    }

    function testWrongNewPayout() public {
        testFuzzWrongBoundField(4);
    }

    function testWrongProposalIdentity() public {
        testFuzzWrongBoundField(5);
    }

    function testWrongOperatorField() public {
        testFuzzWrongBoundField(6);
    }

    function testWrongNonce() public {
        testFuzzWrongBoundField(7);
    }

    function testDelayCannotBeShortened() public {
        testFuzzWrongBoundField(9);
    }

    function testExpiredActivation() public {
        RC.RotationApproval memory a = _propose();
        _approve(a);
        vm.warp(a.proposalExpiry);
        vm.expectRevert(RC.Expired.selector);
        vm.prank(op);
        c.activateRotation(a.proposalId);
        assertEq(c.activePayTo(), "0.0.123");
    }

    function testUnauthorizedCancelPauseAndRevoke() public {
        RC.RotationApproval memory a = _propose();
        vm.expectRevert(RC.Unauthorized.selector);
        c.cancelPendingRotation(a.proposalId, bytes32(0));
        vm.expectRevert(RC.Unauthorized.selector);
        vm.prank(op);
        c.emergencyPause(bytes32(0));
        vm.expectRevert(RC.Unauthorized.selector);
        vm.prank(op);
        c.revokeOperator(op);
    }

    function testPausedApprovalAndActivation() public {
        RC.RotationApproval memory a = _propose();
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.prank(guardian);
        c.emergencyPause(bytes32(0));
        vm.expectRevert(RC.Paused.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
        vm.prank(guardian);
        c.unpause();
        _approve(a);
        vm.prank(guardian);
        c.emergencyPause(bytes32(0));
        vm.warp(a.effectiveAt);
        vm.expectRevert(RC.Paused.selector);
        vm.prank(op);
        c.activateRotation(a.proposalId);
    }

    function testOwnerAndExpiryAnchorChanges() public {
        registry.change(address(r), address(1234), 1000000);
        vm.expectRevert(RC.TrustAnchorChanged.selector);
        vm.prank(op);
        c.proposeRotation("0.0.456", 2000);
        registry.change(address(r), owner, 1000001);
        vm.expectRevert(RC.TrustAnchorChanged.selector);
        vm.prank(op);
        c.proposeRotation("0.0.456", 2000);
    }

    function testActivationRejectsChangedOldPayout() public {
        RC.RotationApproval memory a = _propose();
        _approve(a);
        vm.warp(a.effectiveAt);
        r.setup(node, "quoteseal.activePayTo", "0.0.999");
        vm.expectRevert(RC.TrustAnchorChanged.selector);
        vm.prank(op);
        c.activateRotation(a.proposalId);
    }

    function testAttestationTTLAndAuthFreshness() public {
        RC.RotationApproval memory a = _propose();
        a.attestationExpiry = uint64(block.timestamp + 301);
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.InvalidApproval.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
        a.attestationExpiry = uint64(block.timestamp + 300);
        a.authTime = 999;
        sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.InvalidApproval.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testSignatureBindsEffectiveAt() public {
        RC.RotationApproval memory a = _propose();
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        a.effectiveAt++;
        vm.expectRevert(RC.InvalidApproval.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testZeroAddressAndInvalidDNS() public {
        config.owner = address(0);
        vm.expectRevert(RC.InvalidInput.selector);
        new RC(config);
        config.owner = owner;
        config.dnsName = hex"ff00";
        vm.expectRevert(RC.InvalidInput.selector);
        new RC(config);
    }

    function testEIP712DigestMatchesExplicitEncoding() public {
        RC.RotationApproval memory a = _propose();
        bytes memory left = abi.encode(
            c.APPROVAL_TYPEHASH(), a.merchantId, a.proposalId, a.operator, a.resolver, a.namehash, a.oldPayToHash
        );
        bytes memory right = abi.encode(
            a.newPayToHash, a.effectiveAt, a.proposalExpiry, a.proposalNonce, a.authTime, a.attestationExpiry
        );
        bytes32 structHash = keccak256(bytes.concat(left, right));
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("QuoteSeal"),
                keccak256("1"),
                block.chainid,
                address(c)
            )
        );
        assertEq(c.approvalDigest(a), keccak256(abi.encodePacked(hex"1901", domain, structHash)));
    }

    function testExpiredSignature() public {
        RC.RotationApproval memory a = _propose();
        a.attestationExpiry = uint64(block.timestamp);
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.Expired.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testExpiredProposal() public {
        RC.RotationApproval memory a = _propose();
        vm.warp(a.proposalExpiry);
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.Expired.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testReplay() public {
        RC.RotationApproval memory a = _propose();
        _approve(a);
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.InvalidState.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testUnauthorizedOperator() public {
        vm.expectRevert(RC.Unauthorized.selector);
        c.proposeRotation("0.0.456", 2000);
    }

    function testAttestorCannotActAsOperator() public {
        RC.RotationApproval memory a = _propose();
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.Unauthorized.selector);
        vm.prank(attestor);
        c.approveWithAttestation(a, sig);
    }

    function testRevokedOperatorApproval() public {
        RC.RotationApproval memory a = _propose();
        vm.prank(owner);
        c.revokeOperator(op);
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.Unauthorized.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testRevokedOperatorActivation() public {
        RC.RotationApproval memory a = _propose();
        _approve(a);
        vm.prank(owner);
        c.revokeOperator(op);
        vm.warp(a.effectiveAt);
        vm.expectRevert(RC.Unauthorized.selector);
        vm.prank(op);
        c.activateRotation(a.proposalId);
    }

    function testCancelledNeverActivates() public {
        RC.RotationApproval memory a = _propose();
        _approve(a);
        vm.prank(guardian);
        c.cancelPendingRotation(a.proposalId, bytes32("emergency"));
        vm.warp(a.effectiveAt);
        vm.expectRevert(RC.InvalidState.selector);
        vm.prank(op);
        c.activateRotation(a.proposalId);
        assertEq(uint256(c.payoutVerdict("0.0.456")), 1);
        assertEq(c.activePayTo(), "0.0.123");
    }

    function testCancellationSurvivesResolverFailureAndPause() public {
        RC.RotationApproval memory a = _propose();
        _approve(a);
        r.configure(address(c), "quoteseal.pendingPayTo", false, false);
        vm.startPrank(guardian);
        c.emergencyPause(bytes32(0));
        c.cancelPendingRotation(a.proposalId, bytes32(0));
        vm.stopPrank();
        assertEq(uint256(c.getRotationState().state), 4);
    }

    function testPausedOperationAndResume() public {
        vm.prank(guardian);
        c.emergencyPause(bytes32(0));
        assertEq(uint256(c.payoutVerdict("0.0.123")), 2);
        vm.expectRevert(RC.Paused.selector);
        vm.prank(op);
        c.proposeRotation("0.0.456", 2000);
        vm.expectRevert(RC.Unauthorized.selector);
        vm.prank(op);
        c.unpause();
        vm.prank(guardian);
        c.unpause();
        _propose();
    }

    function testUnauthorizedDirectWrite() public {
        vm.expectRevert("writer");
        vm.prank(owner);
        r.setText(node, "quoteseal.activePayTo", "0.0.999");
    }

    function testMalformedResolverConfiguration() public {
        config.resolver = address(7);
        vm.expectRevert(RC.InvalidInput.selector);
        new RC(config);
    }

    function testWrongNameConfiguration() public {
        config.namehash = bytes32(uint256(1));
        vm.expectRevert(RC.InvalidInput.selector);
        new RC(config);
    }

    function testResolverAnchorChange() public {
        registry.change(address(99), owner, 1000000);
        vm.expectRevert(RC.TrustAnchorChanged.selector);
        vm.prank(op);
        c.proposeRotation("0.0.456", 2000);
    }

    function testRegistryPathChangeRejected() public {
        root.change(address(0));
        vm.expectRevert(RC.TrustAnchorChanged.selector);
        vm.prank(op);
        c.proposeRotation("0.0.456", 2000);
    }

    function testAliasRejected() public {
        r.setAlias(hex"00");
        vm.expectRevert(RC.TrustAnchorChanged.selector);
        vm.prank(op);
        c.proposeRotation("0.0.456", 2000);
    }

    function testActivationWriteRollback() public {
        RC.RotationApproval memory a = _propose();
        _approve(a);
        r.configure(address(c), "quoteseal.profileVersion", false, false);
        vm.warp(a.effectiveAt);
        vm.expectRevert("write failed");
        vm.prank(op);
        c.activateRotation(a.proposalId);
        assertEq(c.activePayTo(), "0.0.123");
        assertEq(r.text(node, "quoteseal.activePayTo"), "0.0.123");
        assertEq(uint256(c.getRotationState().state), 2);
        assertEq(c.profileVersion(), 1);
    }

    function testApprovalWriteRollback() public {
        RC.RotationApproval memory a = _propose();
        r.configure(address(c), "quoteseal.rotationStatus", false, false);
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert("write failed");
        vm.prank(op);
        c.approveWithAttestation(a, sig);
        assertFalse(c.consumedApprovalNonce(a.proposalNonce));
        assertEq(c.pendingPayTo(), "");
        assertEq(r.text(node, "quoteseal.pendingPayTo"), "");
        assertEq(uint256(c.getRotationState().state), 1);
    }

    function testSilentNoopResolverRejected() public {
        RC.RotationApproval memory a = _propose();
        r.configure(address(c), "", true, false);
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.expectRevert(RC.ResolverWriteFailed.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testReentrancyRejected() public {
        RC.RotationApproval memory a = _propose();
        r.configure(address(c), "", false, true);
        _approve(a);
        assertTrue(r.reentryRejected());
        vm.warp(a.effectiveAt);
        vm.prank(op);
        c.activateRotation(a.proposalId);
        assertEq(c.activePayTo(), "0.0.456");
    }

    function testEnrollmentRequiresOwnerSignature() public {
        RC.Enrollment memory e = RC.Enrollment(c.merchantId(), address(99), 1, 5000, c.enrollmentNonce(), address(c));
        bytes memory sig = _sig(77, c.enrollmentDigest(e));
        vm.expectRevert(RC.InvalidSignature.selector);
        c.enrollOperator(e, sig);
    }

    function testEnrollmentReplayAndRevocationInvalidatesPendingSignature() public {
        RC.Enrollment memory e = RC.Enrollment(c.merchantId(), op, 1, 5000, c.enrollmentNonce(), address(c));
        bytes memory sig = _sig(OWNER_KEY, c.enrollmentDigest(e));
        vm.prank(owner);
        c.revokeOperator(op);
        vm.expectRevert(RC.InvalidInput.selector);
        c.enrollOperator(e, sig);
    }

    function testCrossContractReplay() public {
        RC.RotationApproval memory a = _propose();
        RC other = new RC(config);
        bytes memory sig = _sig(ATTESTOR_KEY, other.approvalDigest(a));
        vm.expectRevert(RC.InvalidSignature.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testCrossChainReplay() public {
        RC.RotationApproval memory a = _propose();
        bytes memory sig = _sig(ATTESTOR_KEY, c.approvalDigest(a));
        vm.chainId(block.chainid + 1);
        vm.expectRevert(RC.InvalidSignature.selector);
        vm.prank(op);
        c.approveWithAttestation(a, sig);
    }

    function testDuplicateProposal() public {
        _propose();
        vm.expectRevert(RC.InvalidState.selector);
        vm.prank(op);
        c.proposeRotation("0.0.789", 2000);
    }

    function testFuzzUnauthorizedActivation(address caller) public {
        vm.assume(caller != op);
        RC.RotationApproval memory a = _propose();
        _approve(a);
        vm.warp(a.effectiveAt);
        vm.expectRevert(RC.Unauthorized.selector);
        vm.prank(caller);
        c.activateRotation(a.proposalId);
    }

    function testFuzzInvalidPayTo(bytes memory suffix) public {
        vm.assume(suffix.length < 100);
        string memory bad = string(abi.encodePacked("0x", suffix));
        vm.expectRevert(RC.InvalidInput.selector);
        vm.prank(op);
        c.proposeRotation(bad, 2000);
    }
}

contract RotationHandler is Test {
    RC public c;
    address public op;
    address public guardian;
    uint256 public activations;
    string public lastActive = "0.0.123";
    bool public illegalActivation;
    mapping(bytes32 => bool) public cancelled;

    constructor(RC cc, address oo, address gg) {
        c = cc;
        op = oo;
        guardian = gg;
    }

    function step(uint8 action, uint32 secondsForward) external {
        vm.warp(block.timestamp + bound(secondsForward, 0, 30));
        RC.Proposal memory p = c.getRotationState();
        if (action % 5 == 0) {
            vm.prank(op);
            try c.proposeRotation(
                string(abi.encodePacked("0.0.", vm.toString(1000 + c.proposalNonce()))), uint64(block.timestamp + 1000)
            ) {}
                catch {}
        }
        if (action % 5 == 1 && p.state == RC.State.PROPOSED) {
            RC.RotationApproval memory a = RC.RotationApproval(
                c.merchantId(),
                p.id,
                op,
                address(c.resolver()),
                c.namehash(),
                keccak256(bytes(p.oldPayTo)),
                keccak256(bytes(p.newPayTo)),
                uint64(block.timestamp + 90),
                p.expiry,
                p.nonce,
                uint64(block.timestamp),
                uint64(block.timestamp + 300)
            );
            (uint8 v, bytes32 rr, bytes32 s) = vm.sign(33, c.approvalDigest(a));
            vm.prank(op);
            try c.approveWithAttestation(a, abi.encodePacked(rr, s, v)) {} catch {}
        }
        if (action % 5 == 2) {
            vm.prank(op);
            try c.activateRotation(p.id) {
                if (p.state != RC.State.PENDING_APPROVED || block.timestamp < p.effectiveAt || cancelled[p.id]) {
                    illegalActivation = true;
                }
                activations++;
                lastActive = p.newPayTo;
            } catch {}
        }
        if (action % 5 == 3) {
            vm.prank(guardian);
            try c.cancelPendingRotation(p.id, bytes32(0)) {
                cancelled[p.id] = true;
            } catch {}
        }
        if (action % 5 == 4) {
            vm.prank(address(0xBAD));
            try c.activateRotation(p.id) {} catch {}
        }
    }
}

contract RotationInvariantTest is RotationFixture {
    RotationHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new RotationHandler(c, op, guardian);
        targetContract(address(handler));
    }

    function invariantActiveChangesOnlyOnAuthorizedActivation() public view {
        assertFalse(handler.illegalActivation());
        assertEq(c.activePayTo(), handler.lastActive());
        assertEq(c.profileVersion(), handler.activations() + 1);
        assertEq(r.text(node, "quoteseal.activePayTo"), c.activePayTo());
    }

    function invariantPendingIsNeverPass() public view {
        RC.Proposal memory p = c.getRotationState();
        if (p.state == RC.State.PENDING_APPROVED) {
            assertTrue(c.consumedApprovalNonce(p.nonce));
            assertTrue(c.payoutVerdict(p.newPayTo) != RC.Verdict.PASS);
        }
        if (p.state == RC.State.CANCELLED) assertEq(c.pendingPayTo(), "");
    }
}
