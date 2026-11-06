// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IQuoteSealResolver, IQuoteSealRegistry} from "./interfaces/IENSContext.sol";

/// @notice Single-merchant, non-upgradeable payout controller. OIDC is verified by
/// the backend attestor, not this contract. All authorities are immutable.
contract RotationController is EIP712, ReentrancyGuard {
    using Strings for uint256;

    enum State {
        STABLE,
        PROPOSED,
        PENDING_APPROVED,
        ACTIVATED,
        CANCELLED
    }
    enum Verdict {
        PASS,
        BLOCK,
        HOLD
    }

    struct Config {
        bytes32 merchantId;
        address owner;
        address guardian;
        address attestor;
        address registry;
        address rootRegistry;
        address resolver;
        bytes dnsName;
        bytes32 namehash;
        uint64 nameExpiry;
        uint64 delay;
        uint64 maxAuthAge;
        uint64 attestationTTL;
        string initialPayTo;
        uint256 initialProfileVersion;
    }

    struct Proposal {
        bytes32 id;
        address operator;
        string oldPayTo;
        string newPayTo;
        uint64 proposedAt;
        uint64 effectiveAt;
        uint64 expiry;
        uint256 nonce;
        State state;
    }

    struct RotationApproval {
        bytes32 merchantId;
        bytes32 proposalId;
        address operator;
        address resolver;
        bytes32 namehash;
        bytes32 oldPayToHash;
        bytes32 newPayToHash;
        uint64 effectiveAt;
        uint64 proposalExpiry;
        uint256 proposalNonce;
        uint64 authTime;
        uint64 attestationExpiry;
    }

    struct Enrollment {
        bytes32 merchantId;
        address operator;
        uint256 role;
        uint64 expiry;
        uint256 nonce;
        address controller;
    }

    bytes32 public constant APPROVAL_TYPEHASH = keccak256(
        "RotationApproval(bytes32 merchantId,bytes32 proposalId,address operator,address resolver,bytes32 namehash,bytes32 oldPayToHash,bytes32 newPayToHash,uint64 effectiveAt,uint64 proposalExpiry,uint256 proposalNonce,uint64 authTime,uint64 attestationExpiry)"
    );
    bytes32 public constant ENROLLMENT_TYPEHASH = keccak256(
        "OperatorEnrollment(bytes32 merchantId,address operator,uint256 role,uint64 expiry,uint256 nonce,address controller)"
    );
    uint256 public constant ROTATION_OPERATOR = 1;
    string public constant ACTIVE_KEY = "quoteseal.activePayTo";
    string public constant VERSION_KEY = "quoteseal.profileVersion";
    bytes32 public immutable merchantId;
    bytes32 public immutable namehash;
    address public immutable owner;
    address public immutable guardian;
    address public immutable attestor;
    IQuoteSealRegistry public immutable registry;
    IQuoteSealRegistry public immutable rootRegistry;
    IQuoteSealResolver public immutable resolver;
    bytes32 public immutable resolverCodehash;
    uint64 public immutable nameExpiry;
    uint64 public immutable rotationDelay;
    uint64 public immutable maxAuthAge;
    uint64 public immutable attestationTTL;
    bytes public dnsName;
    string public label;
    string public activePayTo;
    string public pendingPayTo;
    uint256 public profileVersion;
    uint256 public proposalNonce;
    uint256 public enrollmentNonce;
    mapping(address => uint64) public operatorExpiry;
    mapping(uint256 => bool) public consumedApprovalNonce;
    Proposal private _proposal;
    bool public paused;

    error Unauthorized();
    error InvalidInput();
    error InvalidState();
    error InvalidApproval();
    error InvalidSignature();
    error Expired();
    error TrustAnchorChanged();
    error ResolverWriteFailed();
    error Paused();

    event MerchantConfigured(
        bytes32 indexed merchantId,
        bytes32 indexed namehash,
        address resolver,
        address registry,
        address owner,
        address guardian,
        address attestor
    );
    event OperatorEnrolled(address indexed operator, uint256 role, uint64 expiry, uint256 nonce);
    event OperatorRevoked(address indexed operator, uint256 enrollmentNonce);
    event RotationProposed(
        bytes32 indexed proposalId,
        address indexed operator,
        string oldPayTo,
        string newPayTo,
        uint64 expiry,
        uint256 nonce
    );
    event RotationApproved(
        bytes32 indexed proposalId, address indexed operator, uint64 effectiveAt, uint256 nonce, bytes32 approvalDigest
    );
    event RotationActivated(bytes32 indexed proposalId, string activePayTo, uint256 profileVersion);
    event RotationCancelled(bytes32 indexed proposalId, address indexed caller, bytes32 reasonCode);
    event EmergencyPaused(address indexed guardian, bytes32 reasonCode);
    event Resumed(address indexed guardian);

    constructor(Config memory c) EIP712("QuoteSeal", "1") {
        if (
            c.merchantId == 0 || c.owner == address(0) || c.guardian == address(0) || c.attestor == address(0)
                || c.guardian == c.owner || c.attestor == c.owner || c.attestor == c.guardian
                || c.rootRegistry.code.length == 0 || c.registry.code.length == 0 || c.resolver.code.length == 0
                || c.delay == 0 || c.maxAuthAge == 0 || c.attestationTTL == 0 || c.nameExpiry <= block.timestamp
                || c.initialProfileVersion == 0
        ) revert InvalidInput();
        (bytes32 node, string memory leaf) = _parseName(c.dnsName);
        if (node != c.namehash) revert InvalidInput();
        _validatePayTo(c.initialPayTo);
        merchantId = c.merchantId;
        namehash = node;
        owner = c.owner;
        guardian = c.guardian;
        attestor = c.attestor;
        registry = IQuoteSealRegistry(c.registry);
        rootRegistry = IQuoteSealRegistry(c.rootRegistry);
        resolver = IQuoteSealResolver(c.resolver);
        resolverCodehash = c.resolver.codehash;
        nameExpiry = c.nameExpiry;
        rotationDelay = c.delay;
        maxAuthAge = c.maxAuthAge;
        attestationTTL = c.attestationTTL;
        dnsName = c.dnsName;
        label = leaf;
        activePayTo = c.initialPayTo;
        profileVersion = c.initialProfileVersion;
        _checkContext();
        emit MerchantConfigured(merchantId, namehash, c.resolver, c.registry, owner, guardian, attestor);
    }

    modifier running() {
        if (paused) revert Paused();
        _;
    }

    function enrollOperator(Enrollment calldata e, bytes calldata ownerSignature) external nonReentrant running {
        _checkContext();
        if (
            e.merchantId != merchantId || e.controller != address(this) || e.operator == address(0)
                || e.operator == guardian || e.operator == attestor || e.role != ROTATION_OPERATOR
                || e.expiry <= block.timestamp || e.nonce != enrollmentNonce
        ) revert InvalidInput();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(ENROLLMENT_TYPEHASH, e)));
        if (!SignatureChecker.isValidSignatureNow(owner, digest, ownerSignature)) revert InvalidSignature();
        enrollmentNonce++;
        operatorExpiry[e.operator] = e.expiry;
        emit OperatorEnrolled(e.operator, e.role, e.expiry, e.nonce);
    }

    /// @dev Revocation invalidates outstanding owner-signed enrollment authorizations too.
    function revokeOperator(address operator) external nonReentrant {
        if (msg.sender != owner) revert Unauthorized();
        if (operator == address(0)) revert InvalidInput();
        delete operatorExpiry[operator];
        enrollmentNonce++;
        emit OperatorRevoked(operator, enrollmentNonce);
    }

    function proposeRotation(string calldata newPayTo, uint64 proposalExpiry)
        external
        nonReentrant
        running
        returns (bytes32 id)
    {
        _requireOperator(msg.sender);
        _checkContext();
        if (_proposal.state == State.PROPOSED || _proposal.state == State.PENDING_APPROVED) revert InvalidState();
        _validatePayTo(newPayTo);
        if (
            _hash(newPayTo) == _hash(activePayTo) || proposalExpiry <= block.timestamp + rotationDelay
                || proposalExpiry >= nameExpiry
        ) revert InvalidInput();
        uint256 nonce = ++proposalNonce;
        id = _computeProposalId(msg.sender, newPayTo, proposalExpiry, nonce);
        uint64 proposedAt = uint64(block.timestamp);
        uint64 effectiveAt = proposedAt + rotationDelay;
        _proposal = Proposal(
            id, msg.sender, activePayTo, newPayTo, proposedAt, effectiveAt, proposalExpiry, nonce, State.PROPOSED
        );
        emit RotationProposed(id, msg.sender, activePayTo, newPayTo, proposalExpiry, nonce);
    }

    /// @notice Returns the ID proposeRotation would assign with the current state and next nonce.
    /// @dev This is a preview only; callers must use the ID emitted by RotationProposed as authoritative.
    function previewProposalId(address operator, string calldata newPayTo, uint64 proposalExpiry)
        external
        view
        returns (bytes32)
    {
        return _computeProposalId(operator, newPayTo, proposalExpiry, proposalNonce + 1);
    }

    function approveWithAttestation(RotationApproval calldata a, bytes calldata signature)
        external
        nonReentrant
        running
    {
        Proposal storage p = _proposal;
        _requireOperator(msg.sender);
        if (msg.sender != p.operator) revert Unauthorized();
        _checkContext();
        if (p.state != State.PROPOSED) revert InvalidState();
        if (block.timestamp >= p.expiry || block.timestamp >= a.attestationExpiry) revert Expired();
        if (
            a.merchantId != merchantId || a.proposalId != p.id || a.operator != p.operator
                || a.resolver != address(resolver) || a.namehash != namehash || a.oldPayToHash != _hash(p.oldPayTo)
                || a.oldPayToHash != _hash(activePayTo) || a.newPayToHash != _hash(p.newPayTo)
                || a.proposalExpiry != p.expiry || a.proposalNonce != p.nonce || consumedApprovalNonce[a.proposalNonce]
                || a.effectiveAt != p.effectiveAt || a.effectiveAt < p.proposedAt + rotationDelay
                || a.effectiveAt >= p.expiry || a.authTime < p.proposedAt || a.authTime > block.timestamp
                || block.timestamp - a.authTime > maxAuthAge || a.attestationExpiry <= a.authTime
                || a.attestationExpiry > uint256(a.authTime) + attestationTTL || a.attestationExpiry > p.expiry
        ) revert InvalidApproval();
        bytes32 digest = approvalDigest(a);
        if (!SignatureChecker.isValidSignatureNow(attestor, digest, signature)) revert InvalidSignature();
        consumedApprovalNonce[a.proposalNonce] = true;
        p.state = State.PENDING_APPROVED;
        p.effectiveAt = a.effectiveAt;
        pendingPayTo = p.newPayTo;
        emit RotationApproved(p.id, p.operator, p.effectiveAt, p.nonce, digest);
        // Approval is recorded before any pending metadata becomes observable externally.
        _write("quoteseal.pendingPayTo", pendingPayTo);
        _write("quoteseal.pendingEffectiveAt", uint256(p.effectiveAt).toString());
        _write("quoteseal.rotationStatus", "pending");
        _checkContext();
    }

    function activateRotation(bytes32 proposalId) external nonReentrant running {
        Proposal storage p = _proposal;
        _requireOperator(msg.sender);
        if (msg.sender != p.operator) revert Unauthorized();
        if (p.id != proposalId || p.state != State.PENDING_APPROVED || block.timestamp < p.effectiveAt) {
            revert InvalidState();
        }
        if (block.timestamp >= p.expiry) revert Expired();
        _checkContext();
        p.state = State.ACTIVATED;
        activePayTo = p.newPayTo;
        delete pendingPayTo;
        ++profileVersion;
        _write(ACTIVE_KEY, activePayTo);
        _write(VERSION_KEY, profileVersion.toString());
        _write("quoteseal.pendingPayTo", "");
        _write("quoteseal.pendingEffectiveAt", "");
        _write("quoteseal.rotationStatus", "stable");
        _checkContext();
        emit RotationActivated(p.id, activePayTo, profileVersion);
    }

    /// @dev No resolver interaction: compromised resolver cannot prevent emergency cancellation.
    /// Informational ENS pending mirrors may remain stale; contract state is authoritative.
    function cancelPendingRotation(bytes32 proposalId, bytes32 reasonCode) external nonReentrant {
        Proposal storage p = _proposal;
        if (msg.sender != guardian) {
            _requireOperator(msg.sender);
            if (msg.sender != p.operator) revert Unauthorized();
        }
        if (p.id != proposalId || (p.state != State.PROPOSED && p.state != State.PENDING_APPROVED)) {
            revert InvalidState();
        }
        p.state = State.CANCELLED;
        delete pendingPayTo;
        emit RotationCancelled(p.id, msg.sender, reasonCode);
    }

    function emergencyPause(bytes32 reasonCode) external nonReentrant {
        if (msg.sender != guardian) revert Unauthorized();
        if (paused) revert InvalidState();
        paused = true;
        emit EmergencyPaused(msg.sender, reasonCode);
    }

    /// @notice Guardian-controlled recovery; no payout or trust-anchor override.
    function unpause() external nonReentrant {
        if (msg.sender != guardian) revert Unauthorized();
        if (!paused) revert InvalidState();
        _checkContext();
        paused = false;
        emit Resumed(msg.sender);
    }

    function getRotationState() external view returns (Proposal memory) {
        return _proposal;
    }

    function approvalDigest(RotationApproval calldata a) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(APPROVAL_TYPEHASH, a)));
    }

    function enrollmentDigest(Enrollment calldata e) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ENROLLMENT_TYPEHASH, e)));
    }

    /// @notice Payout-state semantics only; buyer must still verify ENS, origin, amount and RPC integrity.
    function payoutVerdict(string calldata payTo) external view returns (Verdict) {
        if (paused) return Verdict.HOLD;
        if (_hash(payTo) == _hash(activePayTo)) return Verdict.PASS;
        if (
            _proposal.state == State.PENDING_APPROVED && block.timestamp < _proposal.expiry
                && _hash(payTo) == _hash(pendingPayTo)
        ) return Verdict.HOLD;
        return Verdict.BLOCK;
    }

    function _requireOperator(address account) private view {
        if (operatorExpiry[account] <= block.timestamp) revert Unauthorized();
    }

    function _checkContext() private view {
        if (
            _nameRegistry() != address(registry) || address(resolver).codehash != resolverCodehash
                || registry.getResolver(label) != address(resolver) || registry.findOwner(label) != owner
                || registry.findExpiry(label) != nameExpiry || block.timestamp >= nameExpiry
                || resolver.getAlias(dnsName).length != 0
        ) revert TrustAnchorChanged();
        if (
            _hash(resolver.text(namehash, ACTIVE_KEY)) != _hash(activePayTo)
                || _hash(resolver.text(namehash, VERSION_KEY)) != _hash(profileVersion.toString())
        ) revert TrustAnchorChanged();
        bytes memory result = resolver.resolve(dnsName, abi.encodeCall(IQuoteSealResolver.text, (namehash, ACTIVE_KEY)));
        if (_hash(abi.decode(result, (string))) != _hash(activePayTo)) revert TrustAnchorChanged();
    }

    /// @dev Follow the pinned root's concrete subregistry path; wildcard/alias resolution is out of scope.
    function _nameRegistry() private view returns (address current) {
        bytes memory dns = dnsName;
        string[] memory parts = new string[](128);
        uint256 count = 0;
        uint256 pos = 0;
        while (dns[pos] != 0) {
            uint256 len = uint8(dns[pos++]);
            bytes memory part = new bytes(len);
            for (uint256 i; i < len; ++i) {
                part[i] = dns[pos + i];
            }
            parts[count++] = string(part);
            pos += len;
        }
        current = address(rootRegistry);
        while (count > 1) {
            current = IQuoteSealRegistry(current).getSubregistry(parts[--count]);
            if (current.code.length == 0) revert TrustAnchorChanged();
        }
    }

    function _write(string memory key, string memory value) private {
        resolver.setText(namehash, key, value);
        if (_hash(resolver.text(namehash, key)) != _hash(value)) revert ResolverWriteFailed();
    }

    function _hash(string memory value) private pure returns (bytes32) {
        return keccak256(bytes(value));
    }

    function _computeProposalId(address operator, string memory newPayTo, uint64 proposalExpiry, uint256 nonce)
        private
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                address(this),
                block.chainid,
                merchantId,
                nonce,
                operator,
                _hash(activePayTo),
                _hash(newPayTo),
                proposalExpiry
            )
        );
    }

    /// @dev MVP restricts to canonical numeric Hedera 0.0.N IDs, not aliases or EVM addresses.
    function _validatePayTo(string memory value) private pure {
        bytes memory b = bytes(value);
        if (b.length < 5 || b.length > 23 || b[0] != "0" || b[1] != "." || b[2] != "0" || b[3] != "." || b[4] == "0") {
            revert InvalidInput();
        }
        uint256 n = 0;
        for (uint256 i = 4; i < b.length; ++i) {
            if (b[i] < "0" || b[i] > "9") revert InvalidInput();
            n = n * 10 + uint8(b[i]) - 48;
        }
        if (n > 9223372036854775807) revert InvalidInput();
    }

    /// @dev Require lowercase ASCII DNS labels; off-chain ENS normalization must precede deployment.
    function _parseName(bytes memory dns) private pure returns (bytes32 node, string memory leaf) {
        if (dns.length < 3 || dns.length > 255) revert InvalidInput();
        bytes32[] memory hashes = new bytes32[](128);
        uint256 count = 0;
        uint256 pos = 0;
        while (pos < dns.length && dns[pos] != 0) {
            uint256 len = uint8(dns[pos++]);
            if (len == 0 || len > 63 || pos + len >= dns.length) revert InvalidInput();
            bytes memory part = new bytes(len);
            for (uint256 i; i < len; ++i) {
                bytes1 c = dns[pos + i];
                if (!((c >= "a" && c <= "z") || (c >= "0" && c <= "9") || (c == "-" && i > 0 && i + 1 < len))) {
                    revert InvalidInput();
                }
                part[i] = c;
            }
            if (count == 0) leaf = string(part);
            hashes[count++] = keccak256(part);
            pos += len;
        }
        if (count == 0 || pos != dns.length - 1 || dns[pos] != 0) revert InvalidInput();
        while (count > 0) node = keccak256(abi.encode(node, hashes[--count]));
    }
}
