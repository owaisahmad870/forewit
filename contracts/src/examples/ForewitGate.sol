// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {ForewitScores} from "../ForewitScores.sol";
import {IAgentID} from "../interfaces/IAgentID.sol";

interface IForewitProfiles {
    function profileLabelId(address forecaster) external view returns (uint256);
}

/// @title ForewitGate
/// @notice Example consumer: an Agent ID holder whose Forewit skill is at least MIN_SKILL over at least MIN_N
/// questions, proven against a fresh ForewitScores root, gets a non transferable pass. Holds no funds.
/// @dev The basic variant of docs/SCORES.md section 6 (no MIN_AGE watch window).
contract ForewitGate {
    ForewitScores public immutable SCORES;
    IAgentID public immutable AGENT_ID;
    IForewitProfiles public immutable LEDGER;
    int256 public immutable MIN_SKILL;
    uint256 public immutable MIN_N;
    uint256 public immutable MAX_AGE;

    /// @notice Epoch the pass was earned on, by tokenId (0 means no pass).
    mapping(uint256 tokenId => uint256 epoch) public passed;

    event Passed(uint256 indexed tokenId, address indexed holder, uint256 epoch, int256 skill, uint256 n);

    error NotHolder();
    error NotOptedIn();
    error BadProof();
    error BelowMinimum();
    error StaleRoot();

    constructor(ForewitScores scores, int256 minSkill, uint256 minN, uint256 maxAge) {
        SCORES = scores;
        AGENT_ID = IAgentID(scores.AGENT_ID());
        LEDGER = IForewitProfiles(scores.LEDGER());
        MIN_SKILL = minSkill;
        MIN_N = minN;
        MAX_AGE = maxAge;
    }

    /// @notice Claim the pass for your own Agent ID with a proof from the published leaves file.
    function claim(uint256 tokenId, int256 skill, uint256 n, bytes32[] calldata proof) external {
        // proofs are public: bind the leaf to the caller
        if (AGENT_ID.ownerOf(tokenId) != msg.sender) revert NotHolder();
        // the caller must also be the wallet that opted in this name on the ledger (narrows a reissue, review L1)
        if (LEDGER.profileLabelId(msg.sender) != tokenId) revert NotOptedIn();
        if (!SCORES.verify(tokenId, skill, n, proof)) revert BadProof();
        if (skill < MIN_SKILL || n < MIN_N) revert BelowMinimum();
        uint256 epoch = SCORES.latestEpoch();
        if (block.timestamp > SCORES.getEpoch(epoch).postedAt + MAX_AGE) revert StaleRoot();
        passed[tokenId] = epoch;
        emit Passed(tokenId, msg.sender, epoch, skill, n);
    }
}
