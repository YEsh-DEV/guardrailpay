// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RotationController
 * @notice Enforces timelocked, authenticated payout rotations for ENSv2 merchant profiles.
 * @dev Manages the rotation lifecycle: PROPOSED -> APPROVED -> ACTIVE (or REVOKED).
 */
contract RotationController {
    enum RotationStatus { NONE, PROPOSED, APPROVED, ACTIVE, REVOKED }

    struct Rotation {
        uint256 id;
        string currentPayTo;
        string pendingPayTo;
        uint256 proposedAt;
        uint256 approvedAt;
        uint256 effectiveAt;
        RotationStatus status;
        address proposer;
        address approver;
    }

    address public owner;
    address public treasury;
    address public approver; // World ID verified operator relayer
    uint256 public rotationDelay; // delay in seconds (e.g. 90 seconds for demo)

    string public activePayTo;
    uint256 public rotationCount;
    mapping(uint256 => Rotation) public rotations;

    event RotationProposed(uint256 indexed id, string currentPayTo, string pendingPayTo, address indexed proposer);
    event RotationApproved(uint256 indexed id, uint256 effectiveAt, address indexed approver);
    event RotationActivated(uint256 indexed id, string newActivePayTo);
    event RotationRevoked(uint256 indexed id, address indexed revoker);
    event TreasuryUpdated(address indexed newTreasury);
    event ApproverUpdated(address indexed newApprover);
    event DelayUpdated(uint256 newDelay);

    error Unauthorized();
    error InvalidStatus(RotationStatus current, RotationStatus required);
    error DelayNotMet(uint256 currentTimestamp, uint256 effectiveAt);
    error EmptyPayTo();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyTreasury() {
        if (msg.sender != treasury && msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyApprover() {
        if (msg.sender != approver && msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(
        address _treasury,
        address _approver,
        uint256 _rotationDelay,
        string memory _initialPayTo
    ) {
        owner = msg.sender;
        treasury = _treasury;
        approver = _approver;
        rotationDelay = _rotationDelay;
        activePayTo = _initialPayTo;
    }

    /**
     * @notice Propose a new payTo payout address (called by treasury)
     */
    function proposeRotation(string calldata newPayTo) external onlyTreasury returns (uint256) {
        if (bytes(newPayTo).length == 0) revert EmptyPayTo();

        rotationCount++;
        uint256 id = rotationCount;

        rotations[id] = Rotation({
            id: id,
            currentPayTo: activePayTo,
            pendingPayTo: newPayTo,
            proposedAt: block.timestamp,
            approvedAt: 0,
            effectiveAt: 0,
            status: RotationStatus.PROPOSED,
            proposer: msg.sender,
            approver: address(0)
        });

        emit RotationProposed(id, activePayTo, newPayTo, msg.sender);
        return id;
    }

    /**
     * @notice Approve a proposed rotation after World ID verification (called by authorized approver)
     */
    function approveRotation(uint256 id) external onlyApprover {
        Rotation storage r = rotations[id];
        if (r.status != RotationStatus.PROPOSED) {
            revert InvalidStatus(r.status, RotationStatus.PROPOSED);
        }

        r.approvedAt = block.timestamp;
        r.effectiveAt = block.timestamp + rotationDelay;
        r.status = RotationStatus.APPROVED;
        r.approver = msg.sender;

        emit RotationApproved(id, r.effectiveAt, msg.sender);
    }

    /**
     * @notice Activate the approved rotation once the timelock delay has elapsed
     */
    function activate(uint256 id) external {
        Rotation storage r = rotations[id];
        if (r.status != RotationStatus.APPROVED) {
            revert InvalidStatus(r.status, RotationStatus.APPROVED);
        }
        if (block.timestamp < r.effectiveAt) {
            revert DelayNotMet(block.timestamp, r.effectiveAt);
        }

        r.status = RotationStatus.ACTIVE;
        activePayTo = r.pendingPayTo;

        emit RotationActivated(id, activePayTo);
    }

    /**
     * @notice Emergency revocation of a pending rotation
     */
    function revoke(uint256 id) external onlyTreasury {
        Rotation storage r = rotations[id];
        if (r.status == RotationStatus.ACTIVE || r.status == RotationStatus.REVOKED) {
            revert InvalidStatus(r.status, RotationStatus.PROPOSED);
        }

        r.status = RotationStatus.REVOKED;
        emit RotationRevoked(id, msg.sender);
    }

    // Configuration setters
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setApprover(address _approver) external onlyOwner {
        approver = _approver;
        emit ApproverUpdated(_approver);
    }

    function setDelay(uint256 _delay) external onlyOwner {
        rotationDelay = _delay;
        emit DelayUpdated(_delay);
    }

    function getRotation(uint256 id) external view returns (Rotation memory) {
        return rotations[id];
    }
}
