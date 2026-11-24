// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {
    AccessControlDefaultAdminRules
} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @notice The one ForecastLedger read ForewitScores needs.
interface IForecastLedgerAgentID {
    function AGENT_ID() external view returns (address);
}

/// @title ForewitScores
/// @notice Append only history of Merkle roots over Forewit skill scores, one leaf (tokenId, skill, n) per opted in
/// Agent ID holder (docs/SCORES.md). Anyone verifies a score with verify(tokenId, skill, n, proof).
/// @dev Non upgradeable, holds no funds (no payable function, no receive), never calls out after the constructor.
/// skill = sumSkill / (baselineQuestions + SHRINK_K) truncated toward zero, n = baselineQuestions, both from
/// ForecastLedger events up to snapshotBlock. Leaves follow the OpenZeppelin StandardMerkleTree layout.
contract ForewitScores is AccessControlDefaultAdminRules {
    bytes32 public constant ROUND_MANAGER_ROLE = keccak256("ROUND_MANAGER_ROLE");
    uint48 public constant ADMIN_TRANSFER_DELAY = 1 days;
    /// @notice Shrink constant of the score definition (documentation for consumers; verify does not use it).
    uint256 public constant SHRINK_K = 20;
    /// @notice Version of the score definition and leaf encoding.
    uint256 public constant SCORE_VERSION = 1;

    /// @dev Two storage slots: root, then the packed fields.
    struct Epoch {
        bytes32 root;
        uint64 snapshotBlock;
        uint64 roundId;
        uint32 leafCount;
        uint48 postedAt;
        bool revoked;
    }

    address public immutable LEDGER;
    address public immutable AGENT_ID;

    Epoch[] internal _epochs;

    event RootPosted(
        uint256 indexed epoch, uint256 indexed roundId, bytes32 root, uint64 snapshotBlock, uint32 leafCount
    );
    event RootRevoked(uint256 indexed epoch, string reason);

    error ZeroAddress();
    error NoCode(address target);
    error AgentIdMismatch();
    error ZeroRoot();
    error ZeroLeafCount();
    error BadSnapshotBlock();
    error UnknownEpoch();
    error AlreadyRevoked();
    error NotAuthorized();
    error KeeperRevokeTooOld();

    /// @param admin Default admin (two step transfer with ADMIN_TRANSFER_DELAY).
    /// @param keeper Address that gets ROUND_MANAGER_ROLE.
    /// @param ledger The ForecastLedger whose events define the scores.
    /// @param agentId Expected Agent ID; must equal ledger.AGENT_ID() (guards a wrong ledger address at deploy).
    constructor(address admin, address keeper, address ledger, address agentId)
        AccessControlDefaultAdminRules(ADMIN_TRANSFER_DELAY, admin)
    {
        if (keeper == address(0) || ledger == address(0) || agentId == address(0)) revert ZeroAddress();
        if (ledger.code.length == 0) revert NoCode(ledger);
        if (IForecastLedgerAgentID(ledger).AGENT_ID() != agentId) revert AgentIdMismatch();
        LEDGER = ledger;
        AGENT_ID = agentId;
        _grantRole(ROUND_MANAGER_ROLE, keeper);
    }

    /// @notice Append a root. Keeper only. snapshotBlock must be in the past and above the previous epoch's.
    /// @param roundId The round whose settlement triggered the post (a label; ordering follows snapshotBlock).
    function postRoot(uint64 roundId, uint64 snapshotBlock, bytes32 root, uint32 leafCount)
        external
        onlyRole(ROUND_MANAGER_ROLE)
    {
        if (root == bytes32(0)) revert ZeroRoot();
        if (leafCount == 0) revert ZeroLeafCount();
        uint256 count = _epochs.length;
        if (snapshotBlock >= block.number || (count != 0 && snapshotBlock <= _epochs[count - 1].snapshotBlock)) {
            revert BadSnapshotBlock();
        }
        _epochs.push(
            Epoch({
                root: root,
                snapshotBlock: snapshotBlock,
                roundId: roundId,
                leafCount: leafCount,
                postedAt: uint48(block.timestamp),
                revoked: false
            })
        );
        emit RootPosted(count + 1, roundId, root, snapshotBlock, leafCount);
    }

    /// @notice Irreversibly mark an epoch as revoked. The admin may revoke any epoch; the keeper only the newest two
    /// (a bad root and the corrected root that supersedes it), so a stolen hot keeper key cannot erase history.
    function revokeRoot(uint256 epoch, string calldata reason) external {
        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        if (!isAdmin && !hasRole(ROUND_MANAGER_ROLE, msg.sender)) revert NotAuthorized();
        if (!_known(epoch)) revert UnknownEpoch();
        if (!isAdmin && epoch + 1 < _epochs.length) revert KeeperRevokeTooOld();
        Epoch storage e = _epochs[epoch - 1];
        if (e.revoked) revert AlreadyRevoked();
        e.revoked = true;
        emit RootRevoked(epoch, reason);
    }

    /// @notice Id of the latest epoch (0 before the first post). Epoch ids start at 1.
    function latestEpoch() external view returns (uint256) {
        return _epochs.length;
    }

    /// @notice One epoch record. Reverts for an unknown epoch.
    function getEpoch(uint256 epoch) external view returns (Epoch memory) {
        if (!_known(epoch)) revert UnknownEpoch();
        return _epochs[epoch - 1];
    }

    /// @notice True only if the latest epoch exists, is not revoked and the proof matches its root. No fallback.
    function verify(uint256 tokenId, int256 skill, uint256 n, bytes32[] calldata proof) external view returns (bool) {
        return verifyAt(_epochs.length, tokenId, skill, n, proof);
    }

    /// @notice Same check against one named epoch. False when the epoch is unknown or revoked.
    function verifyAt(uint256 epoch, uint256 tokenId, int256 skill, uint256 n, bytes32[] calldata proof)
        public
        view
        returns (bool)
    {
        if (!_known(epoch)) return false;
        Epoch storage e = _epochs[epoch - 1];
        if (e.revoked) return false;
        return MerkleProof.verifyCalldata(proof, e.root, leafHash(tokenId, skill, n));
    }

    /// @dev Epoch ids run from 1 to _epochs.length; epoch 0 wraps to the maximum and is unknown.
    function _known(uint256 epoch) internal view returns (bool) {
        unchecked {
            return epoch - 1 < _epochs.length;
        }
    }

    /// @notice The StandardMerkleTree leaf hash of (tokenId, skill, n): double hashed against second preimages.
    function leafHash(uint256 tokenId, int256 skill, uint256 n) public pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(tokenId, skill, n))));
    }
}
