// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {
    AccessControlDefaultAdminRules
} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IAgentID} from "./interfaces/IAgentID.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";

/// @title ForecastLedger
/// @notice Commit reveal forecasting rounds over Predict.fun markets, gated by Binance Agent ID, scored with
/// the Brier rule against real onchain Conditional Tokens resolutions and against a market baseline.
/// @dev Non upgradeable, holds no assets, calls only view functions on immutable allowlisted contracts.
/// Nobody, including the admin, can edit commits, reveals, outcomes or scores.
contract ForecastLedger is AccessControlDefaultAdminRules, Pausable {
    // Roles and constants

    bytes32 public constant ROUND_MANAGER_ROLE = keccak256("ROUND_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_QUESTIONS = 16;
    uint256 public constant MAX_BATCH = 100;
    uint256 public constant MAX_CTFS = 4;
    uint256 public constant BPS = 10_000;
    /// @notice Brier of a worst case forecast on one question, in bps squared.
    uint256 public constant MAX_BRIER = BPS * BPS;
    /// @notice Smallest windows a BSC mainnet (chain 56) deployment accepts.
    uint256 public constant MAINNET_MIN_COMMIT_WINDOW = 2 hours;
    uint256 public constant MAX_COMMIT_WINDOW = 7 days;
    uint256 public constant MAINNET_MIN_REVEAL_WINDOW = 12 hours;
    uint256 public constant MAX_REVEAL_WINDOW = 7 days;
    /// @notice Bounds for the per round resolution wait chosen at createRound (7 days for daily rounds).
    uint256 public constant MIN_RESOLUTION_WAIT = 1 days;
    uint256 public constant MAX_RESOLUTION_WAIT = 120 days;
    uint48 public constant ADMIN_TRANSFER_DELAY = 1 days;

    bytes32 public constant COMMIT_TYPEHASH = keccak256(
        "PrescientCommit(uint256 chainId,address ledger,uint256 roundId,address forecaster,uint256 packed,bytes32 salt)"
    );
    /// @notice The market baseline is posted in clear, once, only in the last BASELINE_WINDOW before the commit deadline
    /// (security review M1, L4: no hindsight veto, no early or stale baseline).
    uint256 public constant BASELINE_WINDOW = 15 minutes;

    uint8 internal constant FLAG_REVEALED = 1;
    uint8 internal constant FLAG_SCORED = 2;
    uint8 internal constant FLAG_FORFEITED = 4;

    enum Outcome {
        Unresolved,
        Yes,
        No,
        Void
    }

    // Types

    struct Round {
        uint64 commitDeadline;
        uint64 revealDeadline;
        uint64 createdAt;
        uint8 questionCount;
        uint16 outcomeYesMask;
        uint16 voidMask;
        uint16 resolvedMask;
        bool baselineSet;
        bool isSealed;
        uint256 baselinePacked;
        uint64 resolutionWait; // after the reveal deadline, unresolved questions may be voided; fixed at creation
    }

    struct Question {
        bytes32 conditionId;
        address ctf;
        uint8 yesSlot;
    }

    /// @notice Input for createRound. marketId is the Predict.fun market id, kept in the event only.
    struct QuestionInput {
        bytes32 conditionId;
        address ctf;
        uint8 yesSlot;
        uint256 marketId;
    }

    /// @notice Cumulative sums per forecaster. Averages are computed off chain.
    struct Stats {
        uint32 roundsCommitted;
        uint32 roundsRevealed;
        uint32 roundsForfeited;
        uint32 questionsScored;
        uint64 sumBrier;
        uint64 sumBaselineBrier;
        int64 sumSkill;
        uint64 lastRound;
        uint32 baselineQuestions; // questions scored against a revealed baseline, the denominator for mean skill
    }

    // Immutables and storage

    IAgentID public immutable AGENT_ID;
    /// @notice Minimum commit and reveal windows, fixed at deploy (short only on test networks).
    uint256 public immutable MIN_COMMIT_WINDOW;
    uint256 public immutable MIN_REVEAL_WINDOW;
    address internal immutable CTF0;
    address internal immutable CTF1;
    address internal immutable CTF2;
    address internal immutable CTF3;

    uint256 public roundCount;
    mapping(uint256 roundId => Round) internal _rounds;
    mapping(uint256 roundId => Question[MAX_QUESTIONS]) internal _questions;
    mapping(uint256 roundId => mapping(address forecaster => bytes32)) public commits;
    mapping(uint256 roundId => mapping(address forecaster => uint256)) public reveals;
    mapping(uint256 roundId => mapping(address forecaster => uint8)) public flags;
    mapping(address forecaster => Stats) internal _stats;
    mapping(address forecaster => bool) public publicProfile;
    mapping(address forecaster => uint256) public profileLabelId;

    // Events

    event RoundCreated(
        uint256 indexed roundId,
        uint64 commitDeadline,
        uint64 revealDeadline,
        uint64 resolutionWait,
        QuestionInput[] questions
    );
    event Committed(uint256 indexed roundId, address indexed forecaster, bytes32 commitHash);
    event Revealed(uint256 indexed roundId, address indexed forecaster, uint256 packed, address caller);
    event BaselineSet(uint256 indexed roundId, uint256 packed);
    event QuestionFinalized(uint256 indexed roundId, uint256 indexed index, Outcome outcome, bool early, bool stale);
    event Scored(
        uint256 indexed roundId,
        address indexed forecaster,
        uint256 questions,
        uint256 brierSum,
        uint256 baselineBrierSum,
        int256 skillSum,
        bool baselineUsed
    );
    event Forfeited(
        uint256 indexed roundId,
        address indexed forecaster,
        uint256 questions,
        uint256 brierSum,
        uint256 baselineBrierSum,
        int256 skillSum,
        bool baselineUsed
    );
    event RoundSealed(uint256 indexed roundId, uint16 voidedMask);
    event ProfileUpdated(address indexed forecaster, bool isPublic, uint256 labelId);

    // Errors

    error ZeroAddress();
    error BadWindows();
    error BadResolutionWait();
    error NoCode(address target);
    error BadCtfList();
    error CtfNotAllowed(address ctf);
    error BadQuestionCount();
    error BadDeadlines();
    error BadSlotCount(uint256 index);
    error AlreadyResolved(uint256 index);
    error BadYesSlot(uint256 index);
    error DuplicateCondition(uint256 index);
    error UnknownRound();
    error CommitClosed();
    error RevealNotOpen();
    error ZeroHash();
    error NoAgentID();
    error BaselineWindow();
    error BaselineAlreadySet();
    error NoCommit();
    error AlreadyRevealed();
    error HashMismatch();
    error NonCanonical();
    error BadIndex();
    error QuestionAlreadyFinal();
    error NotResolvedOnchain();
    error TooEarly();
    error RoundNotResolved();
    error NotRevealed();
    error AlreadyProcessed();
    error BatchTooLarge();
    error LabelNotOwned();

    /// @param agentId The Agent ID ERC721.
    /// @param ctfAllowlist 1 to 4 Conditional Tokens contracts that questions may use.
    /// @param admin Default admin (two step transfer with ADMIN_TRANSFER_DELAY). Also gets PAUSER_ROLE.
    /// @param roundManager Keeper address that gets ROUND_MANAGER_ROLE.
    /// @param minCommitWindow Minimum commit window; on chain 56 at least MAINNET_MIN_COMMIT_WINDOW.
    /// @param minRevealWindow Minimum reveal window; on chain 56 at least MAINNET_MIN_REVEAL_WINDOW.
    constructor(
        address agentId,
        address[] memory ctfAllowlist,
        address admin,
        address roundManager,
        uint256 minCommitWindow,
        uint256 minRevealWindow
    ) AccessControlDefaultAdminRules(ADMIN_TRANSFER_DELAY, admin) {
        if (
            minCommitWindow == 0 || minRevealWindow == 0 || minCommitWindow > MAX_COMMIT_WINDOW
                || minRevealWindow > MAX_REVEAL_WINDOW
        ) revert BadWindows();
        if (
            block.chainid == 56
                && (minCommitWindow < MAINNET_MIN_COMMIT_WINDOW || minRevealWindow < MAINNET_MIN_REVEAL_WINDOW)
        ) revert BadWindows();
        MIN_COMMIT_WINDOW = minCommitWindow;
        MIN_REVEAL_WINDOW = minRevealWindow;
        if (agentId == address(0) || roundManager == address(0)) revert ZeroAddress();
        if (agentId.code.length == 0) revert NoCode(agentId);
        uint256 n = ctfAllowlist.length;
        if (n == 0 || n > MAX_CTFS) revert BadCtfList();
        for (uint256 i; i < n; ++i) {
            address c = ctfAllowlist[i];
            if (c == address(0)) revert ZeroAddress();
            if (c.code.length == 0) revert NoCode(c);
            for (uint256 j; j < i; ++j) {
                if (ctfAllowlist[j] == c) revert BadCtfList();
            }
        }
        AGENT_ID = IAgentID(agentId);
        CTF0 = ctfAllowlist[0];
        CTF1 = n > 1 ? ctfAllowlist[1] : address(0);
        CTF2 = n > 2 ? ctfAllowlist[2] : address(0);
        CTF3 = n > 3 ? ctfAllowlist[3] : address(0);
        _grantRole(ROUND_MANAGER_ROLE, roundManager);
        _grantRole(PAUSER_ROLE, admin);
    }

    // Round management

    /// @notice Create a round of 1 to 16 binary questions. Round manager only, not while paused.
    /// @dev Every question must be on an allowlisted CTF, have exactly 2 outcome slots and be unresolved.
    /// @param resolutionWait Seconds after the reveal deadline before an unresolved question may be voided,
    /// between MIN_RESOLUTION_WAIT and MAX_RESOLUTION_WAIT. Published in RoundCreated before any commit.
    /// @return roundId The new round id, starting at 1.
    function createRound(
        QuestionInput[] calldata questions,
        uint64 commitDeadline,
        uint64 revealDeadline,
        uint64 resolutionWait
    ) external onlyRole(ROUND_MANAGER_ROLE) whenNotPaused returns (uint256 roundId) {
        uint256 n = questions.length;
        if (n == 0 || n > MAX_QUESTIONS) revert BadQuestionCount();
        if (resolutionWait < MIN_RESOLUTION_WAIT || resolutionWait > MAX_RESOLUTION_WAIT) revert BadResolutionWait();
        if (
            commitDeadline < block.timestamp + MIN_COMMIT_WINDOW || commitDeadline > block.timestamp + MAX_COMMIT_WINDOW
                || revealDeadline < uint256(commitDeadline) + MIN_REVEAL_WINDOW
                || revealDeadline > uint256(commitDeadline) + MAX_REVEAL_WINDOW
        ) revert BadDeadlines();

        roundId = ++roundCount;
        for (uint256 i; i < n; ++i) {
            QuestionInput calldata q = questions[i];
            if (!isAllowedCtf(q.ctf)) revert CtfNotAllowed(q.ctf);
            if (q.yesSlot > 1) revert BadYesSlot(i);
            for (uint256 j; j < i; ++j) {
                if (questions[j].conditionId == q.conditionId) revert DuplicateCondition(i);
            }
            IConditionalTokens ctf = IConditionalTokens(q.ctf);
            if (ctf.getOutcomeSlotCount(q.conditionId) != 2) revert BadSlotCount(i);
            if (ctf.payoutDenominator(q.conditionId) != 0) revert AlreadyResolved(i);
            _questions[roundId][i] = Question({conditionId: q.conditionId, ctf: q.ctf, yesSlot: q.yesSlot});
        }
        Round storage r = _rounds[roundId];
        r.commitDeadline = commitDeadline;
        r.revealDeadline = revealDeadline;
        r.createdAt = uint64(block.timestamp);
        r.questionCount = uint8(n);
        r.resolutionWait = resolutionWait;
        emit RoundCreated(roundId, commitDeadline, revealDeadline, resolutionWait, questions);
    }

    /// @notice Post the market baseline (order book mid prices in bps) in clear. Round manager only, once, and only in the
    /// last BASELINE_WINDOW before the commit deadline: before any reveal or outcome exists, so it cannot be withheld or
    /// chosen with hindsight. A round without a baseline is scored with skill 0 for everyone (decided blind, flagged off chain).
    function setBaseline(uint256 roundId, uint256 packed) external onlyRole(ROUND_MANAGER_ROLE) {
        Round storage r = _round(roundId);
        if (block.timestamp >= r.commitDeadline || block.timestamp + BASELINE_WINDOW < r.commitDeadline) {
            revert BaselineWindow();
        }
        if (r.baselineSet) revert BaselineAlreadySet();
        _checkCanonical(packed, r.questionCount);
        r.baselineSet = true;
        r.baselinePacked = packed;
        emit BaselineSet(roundId, packed);
    }

    /// @notice Pause new rounds and new commits. Never blocks reveal, finalize, score or forfeit.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpause.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Forecaster actions

    /// @notice Commit a hidden forecast. Caller must hold an Agent ID. Can be overwritten before the deadline.
    /// @param commitHash computeCommitHash(roundId, msg.sender, packed, salt).
    function commit(uint256 roundId, bytes32 commitHash) external whenNotPaused {
        Round storage r = _round(roundId);
        if (block.timestamp >= r.commitDeadline) revert CommitClosed();
        if (commitHash == bytes32(0)) revert ZeroHash();
        // slither-disable-next-line incorrect-equality
        if (AGENT_ID.balanceOf(msg.sender) == 0) revert NoAgentID(); // any balance above zero passes
        if (commits[roundId][msg.sender] == bytes32(0)) {
            Stats storage s = _stats[msg.sender];
            s.roundsCommitted += 1;
            s.lastRound = uint64(roundId);
        }
        commits[roundId][msg.sender] = commitHash;
        emit Committed(roundId, msg.sender, commitHash);
    }

    /// @notice Reveal your own forecast after the commit deadline and at or before the reveal deadline.
    /// @dev Agent ID is checked only at commit, so a burned or reissued Agent ID never forces a forfeit.
    /// @param packed 16 probabilities of 16 bits in bps; slot i is question i; unused slots are zero.
    function reveal(uint256 roundId, uint256 packed, bytes32 salt) external {
        _reveal(roundId, msg.sender, packed, salt);
    }

    /// @notice Reveal on behalf of a forecaster (opt in auto reveal). The hash binds the forecaster address,
    /// so a front runner can only perform the same reveal.
    function revealFor(uint256 roundId, address forecaster, uint256 packed, bytes32 salt) external {
        _reveal(roundId, forecaster, packed, salt);
    }

    /// @notice Opt in or out of a public profile, optionally binding your Agent ID name (label without ".ai").
    /// @dev An empty label, or isPublic false, clears the binding (opting out always removes the public name).
    /// Off chain readers must recheck ownerOf before showing a name.
    function setPublicProfile(bool isPublic, string calldata label) external {
        uint256 labelId = 0;
        if (isPublic && bytes(label).length != 0) {
            labelId = uint256(keccak256(bytes(label)));
            address owner = address(0);
            try AGENT_ID.ownerOf(labelId) returns (address o) {
                owner = o;
            } catch {}
            if (owner != msg.sender) revert LabelNotOwned();
        }
        publicProfile[msg.sender] = isPublic;
        profileLabelId[msg.sender] = labelId;
        emit ProfileUpdated(msg.sender, isPublic, labelId);
    }

    // Resolution

    /// @notice Record the onchain outcome of question `index`. Callable by anyone once the CTF has resolved.
    /// @dev Yes when the Yes slot gets the full payout, No when it gets zero, Void for any split. A resolution
    /// observed before the commit deadline voids the question, since late committers could have seen it.
    function finalizeQuestion(uint256 roundId, uint256 index) external {
        Round storage r = _round(roundId);
        Question storage q = _question(r, roundId, index);
        IConditionalTokens ctf = IConditionalTokens(q.ctf);
        uint256 den = ctf.payoutDenominator(q.conditionId);
        if (den == 0) revert NotResolvedOnchain();
        if (block.timestamp < r.commitDeadline) {
            _setOutcome(r, roundId, index, Outcome.Void, true, false);
            return;
        }
        if (!r.isSealed) {
            // Resolved before anyone sealed the round: the seal voids it with every other early resolution.
            _seal(r, roundId);
            return;
        }
        uint256 num = ctf.payoutNumerators(q.conditionId, q.yesSlot);
        Outcome o = num == den ? Outcome.Yes : num == 0 ? Outcome.No : Outcome.Void;
        _setOutcome(r, roundId, index, o, false, false);
    }

    /// @notice Seal a round once its commit deadline has passed: every question already resolved onchain at this
    /// moment becomes Void, so nobody can score on an answer that was public while commits were open.
    /// Callable by anyone, once; the first reveal, baseline reveal or finalize after the deadline also seals.
    function sealRound(uint256 roundId) external {
        Round storage r = _round(roundId);
        if (block.timestamp < r.commitDeadline) revert TooEarly();
        _seal(r, roundId);
    }

    /// @notice Void a question still unresolved onchain resolutionWait seconds after the reveal deadline (set per round).
    /// Callable by anyone. Can only ever set Void.
    function voidStale(uint256 roundId, uint256 index) external {
        Round storage r = _round(roundId);
        Question storage q = _question(r, roundId, index);
        if (block.timestamp <= uint256(r.revealDeadline) + r.resolutionWait) revert TooEarly();
        // A CTF that reverts or returns malformed data must not keep the round from resolving: treat it as unresolved.
        (, uint256 den) = _tryDenominator(q.ctf, q.conditionId);
        if (den != 0) revert AlreadyResolved(index);
        _setOutcome(r, roundId, index, Outcome.Void, false, true);
    }

    // Scoring

    /// @notice Score a revealed forecaster on a fully resolved round, after the reveal deadline. Callable by anyone.
    function score(uint256 roundId, address forecaster) external {
        Round storage r = _round(roundId);
        _checkScorable(r);
        uint8 f = flags[roundId][forecaster];
        if (f & FLAG_REVEALED == 0) revert NotRevealed();
        if (f & FLAG_SCORED != 0) revert AlreadyProcessed();
        _applyScore(r, roundId, forecaster, false);
    }

    /// @notice Apply the worst case score to a forecaster who committed but never revealed. Callable by anyone.
    function forfeit(uint256 roundId, address forecaster) external {
        Round storage r = _round(roundId);
        _checkScorable(r);
        if (commits[roundId][forecaster] == bytes32(0)) revert NoCommit();
        uint8 f = flags[roundId][forecaster];
        if (f & FLAG_REVEALED != 0) revert AlreadyRevealed();
        if (f & FLAG_FORFEITED != 0) revert AlreadyProcessed();
        _applyScore(r, roundId, forecaster, true);
    }

    /// @notice Score up to MAX_BATCH forecasters. Skips anyone not eligible instead of reverting.
    /// @return processed Number of forecasters scored.
    function scoreBatch(uint256 roundId, address[] calldata forecasters) external returns (uint256 processed) {
        Round storage r = _round(roundId);
        _checkScorable(r);
        if (forecasters.length > MAX_BATCH) revert BatchTooLarge();
        for (uint256 i; i < forecasters.length; ++i) {
            uint8 f = flags[roundId][forecasters[i]];
            if (f & FLAG_REVEALED != 0 && f & FLAG_SCORED == 0) {
                _applyScore(r, roundId, forecasters[i], false);
                ++processed;
            }
        }
    }

    /// @notice Forfeit up to MAX_BATCH non revealers. Skips anyone not eligible instead of reverting.
    /// @return processed Number of forecasters forfeited.
    function forfeitBatch(uint256 roundId, address[] calldata forecasters) external returns (uint256 processed) {
        Round storage r = _round(roundId);
        _checkScorable(r);
        if (forecasters.length > MAX_BATCH) revert BatchTooLarge();
        for (uint256 i; i < forecasters.length; ++i) {
            address a = forecasters[i];
            uint8 f = flags[roundId][a];
            if (commits[roundId][a] != bytes32(0) && f & (FLAG_REVEALED | FLAG_FORFEITED) == 0) {
                _applyScore(r, roundId, a, true);
                ++processed;
            }
        }
    }

    // Views

    /// @notice The commit hash a forecaster must submit, bound to this chain, this contract, the round and the forecaster.
    function computeCommitHash(uint256 roundId, address forecaster, uint256 packed, bytes32 salt)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(COMMIT_TYPEHASH, block.chainid, address(this), roundId, forecaster, packed, salt));
    }

    /// @notice True when `ctf` is one of the immutable allowlisted Conditional Tokens contracts.
    function isAllowedCtf(address ctf) public view returns (bool) {
        return ctf != address(0) && (ctf == CTF0 || ctf == CTF1 || ctf == CTF2 || ctf == CTF3);
    }

    /// @notice The allowlisted CTFs (unused entries are zero).
    function getCtfAllowlist() external view returns (address[MAX_CTFS] memory) {
        return [CTF0, CTF1, CTF2, CTF3];
    }

    /// @notice Round data. Reverts for an unknown round.
    function getRound(uint256 roundId) external view returns (Round memory) {
        return _round(roundId);
    }

    /// @notice The questions of a round.
    function getQuestions(uint256 roundId) external view returns (Question[] memory qs) {
        Round storage r = _round(roundId);
        qs = new Question[](r.questionCount);
        for (uint256 i; i < qs.length; ++i) {
            qs[i] = _questions[roundId][i];
        }
    }

    /// @notice Outcome of question `index`.
    function getOutcome(uint256 roundId, uint256 index) public view returns (Outcome) {
        Round storage r = _round(roundId);
        if (index >= r.questionCount) revert BadIndex();
        uint16 bit = uint16(uint256(1) << index);
        if (r.resolvedMask & bit == 0) return Outcome.Unresolved;
        if (r.voidMask & bit != 0) return Outcome.Void;
        return r.outcomeYesMask & bit != 0 ? Outcome.Yes : Outcome.No;
    }

    /// @notice Commit hash of a forecaster for a round (zero if none).
    function getCommit(uint256 roundId, address forecaster) external view returns (bytes32) {
        return commits[roundId][forecaster];
    }

    /// @notice Revealed packed vector and status flags (1 revealed, 2 scored, 4 forfeited).
    function getReveal(uint256 roundId, address forecaster) external view returns (uint256 packed, uint8 status) {
        return (reveals[roundId][forecaster], flags[roundId][forecaster]);
    }

    /// @notice Cumulative stats of a forecaster.
    function getStats(address forecaster) external view returns (Stats memory) {
        return _stats[forecaster];
    }

    /// @notice Probability in bps of slot `index` in a packed vector.
    function unpack(uint256 packed, uint256 index) public pure returns (uint256) {
        return (packed >> (16 * index)) & 0xffff;
    }

    /// @dev The admin's PAUSER_ROLE moves with the admin seat on a completed two step transfer (security review L8).
    function _acceptDefaultAdminTransfer() internal override {
        address previous = defaultAdmin();
        super._acceptDefaultAdminTransfer();
        if (hasRole(PAUSER_ROLE, previous)) {
            _revokeRole(PAUSER_ROLE, previous);
            _grantRole(PAUSER_ROLE, defaultAdmin());
        }
    }

    // Internal

    function _round(uint256 roundId) internal view returns (Round storage r) {
        r = _rounds[roundId];
        if (r.commitDeadline == 0) revert UnknownRound();
    }

    function _question(Round storage r, uint256 roundId, uint256 index) internal view returns (Question storage) {
        if (index >= r.questionCount) revert BadIndex();
        if (r.resolvedMask & (uint256(1) << index) != 0) revert QuestionAlreadyFinal();
        return _questions[roundId][index];
    }

    function _checkRevealWindow(Round storage r) internal view {
        if (block.timestamp < r.commitDeadline || block.timestamp > r.revealDeadline) revert RevealNotOpen();
    }

    /// @dev Unused slots must be zero and every slot at most BPS.
    function _checkCanonical(uint256 packed, uint256 n) internal pure {
        if (n < MAX_QUESTIONS && packed >> (16 * n) != 0) revert NonCanonical();
        for (uint256 i; i < n; ++i) {
            if (unpack(packed, i) > BPS) revert NonCanonical();
        }
    }

    function _reveal(uint256 roundId, address forecaster, uint256 packed, bytes32 salt) internal {
        Round storage r = _round(roundId);
        _checkRevealWindow(r);
        _seal(r, roundId);
        bytes32 c = commits[roundId][forecaster];
        if (c == bytes32(0)) revert NoCommit();
        if (flags[roundId][forecaster] & FLAG_REVEALED != 0) revert AlreadyRevealed();
        if (computeCommitHash(roundId, forecaster, packed, salt) != c) revert HashMismatch();
        _checkCanonical(packed, r.questionCount);
        reveals[roundId][forecaster] = packed;
        flags[roundId][forecaster] |= FLAG_REVEALED;
        _stats[forecaster].roundsRevealed += 1;
        emit Revealed(roundId, forecaster, packed, msg.sender);
    }

    /// @dev Caller guarantees block.timestamp >= commitDeadline. At most MAX_QUESTIONS view calls, once per round.
    function _seal(Round storage r, uint256 roundId) internal {
        if (r.isSealed) return;
        r.isSealed = true;
        uint16 voided = 0;
        uint256 n = r.questionCount;
        for (uint256 i; i < n; ++i) {
            uint16 bit = uint16(uint256(1) << i);
            if (r.resolvedMask & bit != 0) continue;
            Question storage q = _questions[roundId][i];
            // A CTF that reverts or returns malformed data must never block reveals: treat it as unresolved.
            (, uint256 den) = _tryDenominator(q.ctf, q.conditionId);
            if (den != 0) {
                voided |= bit;
                _setOutcome(r, roundId, i, Outcome.Void, true, false);
            }
        }
        emit RoundSealed(roundId, voided);
    }

    /// @dev payoutDenominator without trusting the callee: a revert, or return data shorter than one word, gives
    /// (false, 0) instead of reverting the caller (Solidity try/catch would not catch a decode failure). At most
    /// 32 bytes are copied back, so oversized return data cannot cost the caller memory.
    function _tryDenominator(address ctf, bytes32 conditionId) internal view returns (bool ok, uint256 den) {
        bytes memory data = abi.encodeCall(IConditionalTokens.payoutDenominator, (conditionId));
        assembly ("memory-safe") {
            ok := staticcall(gas(), ctf, add(data, 0x20), mload(data), 0x00, 0x20)
            ok := and(ok, gt(returndatasize(), 0x1f))
            den := mul(mload(0x00), ok)
        }
    }

    function _setOutcome(Round storage r, uint256 roundId, uint256 index, Outcome o, bool early, bool stale) internal {
        uint16 bit = uint16(uint256(1) << index);
        r.resolvedMask |= bit;
        if (o == Outcome.Void) r.voidMask |= bit;
        else if (o == Outcome.Yes) r.outcomeYesMask |= bit;
        emit QuestionFinalized(roundId, index, o, early, stale);
    }

    /// @dev Scoring needs the reveal window closed (so the baseline status is final) and every question resolved.
    function _checkScorable(Round storage r) internal view {
        if (block.timestamp <= r.revealDeadline) revert TooEarly();
        if (r.resolvedMask != uint16((uint256(1) << r.questionCount) - 1)) revert RoundNotResolved();
    }

    /// @dev Brier per question is (p minus o) squared with p and o in bps. Forfeits use MAX_BRIER.
    /// Bounds: at most 16 questions times 1e8 per round, so uint64 and int64 sums have far more than 1000x headroom.
    function _applyScore(Round storage r, uint256 roundId, address forecaster, bool isForfeit) internal {
        uint256 n = r.questionCount;
        uint256 packed = reveals[roundId][forecaster];
        bool useBaseline = r.baselineSet;
        uint256 questions = 0;
        uint256 brierSum = 0;
        uint256 baseSum = 0;
        for (uint256 i; i < n; ++i) {
            uint16 bit = uint16(uint256(1) << i);
            if (r.voidMask & bit != 0) continue;
            uint256 o = r.outcomeYesMask & bit != 0 ? BPS : 0;
            brierSum += isForfeit ? MAX_BRIER : _sq(unpack(packed, i), o);
            if (useBaseline) baseSum += _sq(unpack(r.baselinePacked, i), o);
            ++questions;
        }
        int256 skill = useBaseline ? int256(baseSum) - int256(brierSum) : int256(0);

        Stats storage s = _stats[forecaster];
        s.questionsScored += uint32(questions);
        s.sumBrier += uint64(brierSum);
        if (useBaseline) {
            s.baselineQuestions += uint32(questions);
            s.sumBaselineBrier += uint64(baseSum);
            s.sumSkill += int64(skill);
        }
        if (isForfeit) {
            s.roundsForfeited += 1;
            flags[roundId][forecaster] |= FLAG_FORFEITED;
            emit Forfeited(roundId, forecaster, questions, brierSum, baseSum, skill, useBaseline);
        } else {
            flags[roundId][forecaster] |= FLAG_SCORED;
            emit Scored(roundId, forecaster, questions, brierSum, baseSum, skill, useBaseline);
        }
    }

    function _sq(uint256 p, uint256 o) internal pure returns (uint256) {
        uint256 d = p > o ? p - o : o - p;
        return d * d;
    }
}
