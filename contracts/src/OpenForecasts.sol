// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {
    AccessControlDefaultAdminRules
} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IAgentID} from "./interfaces/IAgentID.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";

/// @title OpenForecasts (Forewit v2)
/// @notice Any binary Predict.fun market, any time: one hidden forecast per wallet per market, gated by Binance
/// Agent ID, revealed after the market resolves onchain, scored with the Brier rule against the onchain Conditional
/// Tokens payout and, when the keeper posted it in time, against the market price at the moment of the commit.
/// Rules: docs/OPEN_FORECASTS.md (pre registered 25 Nov 2026).
/// @dev Non upgradeable, holds no assets, calls only view functions on immutable allowlisted contracts. Nobody,
/// including the admin, can edit a commit, a reveal, an outcome or a score. The keeper can post one market price per
/// forecast within BASELINE_WINDOW of the commit, and void a forecast only within VOID_WINDOW of the commit.
contract OpenForecasts is AccessControlDefaultAdminRules, Pausable {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_BRIER = BPS * BPS;
    uint256 public constant MAX_CTFS = 4;
    uint256 public constant MAX_SEALED = 2112; // 7 header bytes plus up to 2048 bytes of time locked ciphertext
    /// @notice The keeper must post the market price within this time of the commit block (rule: 120 seconds).
    uint256 public constant BASELINE_WINDOW = 120;
    /// @notice The keeper may void a forecast (committed after the market ended, or the book was closed) only this soon,
    /// the same as the price window, so even a 5 minute market cannot be voided with hindsight (review L1).
    uint256 public constant VOID_WINDOW = 120;
    /// @notice Latest a forecaster may ask the reveal window to start (sealed copies open at the market end).
    uint256 public constant MAX_REVEAL_DELAY = 120 days;
    uint256 public constant MIN_BPS = 100;
    uint256 public constant MAX_BPS = 9900;
    /// @notice Reveals stay open this long after the market's onchain resolution is recorded here.
    uint256 public constant REVEAL_WINDOW = 3 days;
    uint48 public constant ADMIN_TRANSFER_DELAY = 1 days;

    bytes32 public constant COMMIT_TYPEHASH = keccak256(
        "ForewitOpenCommit(uint256 chainId,address ledger,address ctf,bytes32 conditionId,uint8 slot,address forecaster,uint16 bps,bytes32 salt)"
    );

    enum Outcome {
        Unresolved,
        Yes,
        No,
        Void
    }

    struct Market {
        uint64 resolvedAt; // 0 until finalize
        bool split; // payout split between slots: every forecast on it is Void
        uint8 winningSlot; // the slot that got the full payout (valid when resolvedAt > 0 and !split)
    }

    struct Forecast {
        bytes32 commitHash;
        uint64 committedAt;
        uint8 slot; // the outcome slot this forecast gives a probability for
        uint8 flags; // 1 revealed, 2 scored, 4 forfeited, 8 void, 16 baseline set
        uint16 bps; // revealed probability for `slot`, in basis points
        uint16 baselineBps; // market price for `slot` at the commit, in basis points
        uint64 revealNotBefore; // when the sealed copy opens; the reveal window never closes before 3 days after it
    }

    struct Stats {
        uint32 forecasts;
        uint32 scored;
        uint32 forfeited;
        uint32 baselineCount;
        uint64 sumBrier;
        uint64 sumBaselineBrier;
        int64 sumSkill;
    }

    uint8 internal constant F_REVEALED = 1;
    uint8 internal constant F_SCORED = 2;
    uint8 internal constant F_FORFEITED = 4;
    uint8 internal constant F_VOID = 8;
    uint8 internal constant F_BASELINE = 16;

    IAgentID public immutable AGENT_ID;
    address[MAX_CTFS] internal _ctfs;

    mapping(bytes32 key => Market) public markets;
    mapping(bytes32 key => mapping(address forecaster => Forecast)) public forecasts;
    mapping(address forecaster => Stats) internal _stats;

    event Committed(
        bytes32 indexed key,
        address indexed forecaster,
        address ctf,
        bytes32 conditionId,
        uint8 slot,
        uint256 marketId,
        bytes32 commitHash,
        uint64 revealNotBefore,
        bytes sealedCopy
    );
    event BaselineSet(bytes32 indexed key, address indexed forecaster, uint16 bps);
    event ForecastVoided(bytes32 indexed key, address indexed forecaster, uint8 reason);
    event MarketFinalized(bytes32 indexed key, Outcome slot0, bool split);
    event Revealed(bytes32 indexed key, address indexed forecaster, uint16 bps, address caller);
    event Scored(
        bytes32 indexed key,
        address indexed forecaster,
        uint256 brier,
        uint256 baselineBrier,
        int256 skill,
        bool baselineUsed,
        bool forfeited
    );

    error NoAgentID();
    error CtfNotAllowed(address ctf);
    error BadSlot();
    error NotBinary();
    error AlreadyResolved();
    error AlreadyCommitted();
    error ZeroHash();
    error SealedTooLarge();
    error NoCommit();
    error NotResolvedOnchain();
    error NotFinalized();
    error AlreadyFinalized();
    error RevealClosed();
    error HashMismatch();
    error BadBps();
    error AlreadyRevealed();
    error AlreadyDone();
    error TooLate();
    error TooEarly();
    error ZeroAddress();
    error NoCode(address target);
    error BadCtfList();

    constructor(address agentId, address[] memory ctfAllowlist, address admin, address keeper)
        AccessControlDefaultAdminRules(ADMIN_TRANSFER_DELAY, admin)
    {
        if (agentId == address(0) || keeper == address(0)) revert ZeroAddress();
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
            _ctfs[i] = c;
        }
        AGENT_ID = IAgentID(agentId);
        _grantRole(KEEPER_ROLE, keeper);
        _grantRole(PAUSER_ROLE, admin);
    }

    // Views

    function marketKey(address ctf, bytes32 conditionId) public pure returns (bytes32) {
        return keccak256(abi.encode(ctf, conditionId));
    }

    function computeCommitHash(
        address ctf,
        bytes32 conditionId,
        uint8 slot,
        address forecaster,
        uint16 bps,
        bytes32 salt
    ) public view returns (bytes32) {
        return keccak256(abi.encode(COMMIT_TYPEHASH, block.chainid, address(this), ctf, conditionId, slot, forecaster, bps, salt));
    }

    function isAllowedCtf(address ctf) public view returns (bool) {
        for (uint256 i; i < MAX_CTFS; ++i) {
            if (_ctfs[i] == ctf && ctf != address(0)) return true;
        }
        return false;
    }

    function getCtfAllowlist() external view returns (address[MAX_CTFS] memory) {
        return _ctfs;
    }

    function getStats(address forecaster) external view returns (Stats memory) {
        return _stats[forecaster];
    }

    // Admin

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // Forecaster

    /// @notice Commit a hidden forecast for one outcome slot of a binary market. Once per wallet per market.
    /// @param marketId The Predict.fun market id, emitted only so the keeper can read the market price at the commit;
    /// the contract trusts only ctf and conditionId.
    /// @param revealNotBefore When the sealed copy opens (the market end plus a margin). The reveal window closes 3 days
    /// after the later of the onchain resolution and this time (capped at 120 days after the commit), so a market that
    /// resolves early can never turn a sealed copy into a forfeit (review M4).
    /// @param sealedCopy The forecast and salt sealed with the drand time lock to the market's end (opt in; may be
    /// empty). Emitted so the keeper can reveal for the forecaster after resolution; nobody can read it earlier.
    function commit(
        address ctf,
        bytes32 conditionId,
        uint8 slot,
        uint256 marketId,
        bytes32 commitHash,
        uint64 revealNotBefore,
        bytes calldata sealedCopy
    ) external whenNotPaused {
        if (commitHash == bytes32(0)) revert ZeroHash();
        if (sealedCopy.length > MAX_SEALED) revert SealedTooLarge();
        if (slot > 1) revert BadSlot();
        if (!isAllowedCtf(ctf)) revert CtfNotAllowed(ctf);
        // slither-disable-next-line incorrect-equality
        if (AGENT_ID.balanceOf(msg.sender) == 0) revert NoAgentID();
        bytes32 key = marketKey(ctf, conditionId);
        if (markets[key].resolvedAt != 0) revert AlreadyResolved();
        if (IConditionalTokens(ctf).getOutcomeSlotCount(conditionId) != 2) revert NotBinary();
        if (IConditionalTokens(ctf).payoutDenominator(conditionId) != 0) revert AlreadyResolved();
        Forecast storage f = forecasts[key][msg.sender];
        if (f.commitHash != bytes32(0)) revert AlreadyCommitted();
        f.commitHash = commitHash;
        f.committedAt = uint64(block.timestamp);
        f.slot = slot;
        uint256 cap = block.timestamp + MAX_REVEAL_DELAY;
        f.revealNotBefore = uint64(revealNotBefore > cap ? cap : revealNotBefore);
        _stats[msg.sender].forecasts += 1;
        emit Committed(key, msg.sender, ctf, conditionId, slot, marketId, commitHash, f.revealNotBefore, sealedCopy);
    }

    /// @notice Reveal your own forecast after the market resolved onchain (finalize first).
    function reveal(bytes32 key, uint16 bps, bytes32 salt, address ctf, bytes32 conditionId) external {
        _reveal(key, msg.sender, bps, salt, ctf, conditionId);
    }

    /// @notice Reveal for a forecaster (the keeper does this from the sealed copy). The hash binds the forecaster,
    /// so a front runner can only perform the same reveal.
    function revealFor(bytes32 key, address forecaster, uint16 bps, bytes32 salt, address ctf, bytes32 conditionId)
        external
    {
        _reveal(key, forecaster, bps, salt, ctf, conditionId);
    }

    // Keeper

    /// @notice Post the market price for the forecast's slot, once, within BASELINE_WINDOW of the commit.
    function setBaseline(bytes32 key, address forecaster, uint16 bps) external onlyRole(KEEPER_ROLE) {
        Forecast storage f = _forecast(key, forecaster);
        if (bps > BPS) revert BadBps();
        if (block.timestamp > uint256(f.committedAt) + BASELINE_WINDOW) revert TooLate();
        if (f.flags & (F_BASELINE | F_VOID | F_REVEALED) != 0 || markets[key].resolvedAt != 0) revert AlreadyDone();
        f.baselineBps = bps;
        f.flags |= F_BASELINE;
        emit BaselineSet(key, forecaster, bps);
    }

    /// @notice Void a forecast committed after the market ended or while its book was closed (reason codes in
    /// docs/OPEN_FORECASTS.md). Only within VOID_WINDOW of the commit, so it can never be used with hindsight.
    function voidForecast(bytes32 key, address forecaster, uint8 reason) external onlyRole(KEEPER_ROLE) {
        Forecast storage f = _forecast(key, forecaster);
        if (block.timestamp > uint256(f.committedAt) + VOID_WINDOW) revert TooLate();
        if (f.flags & (F_VOID | F_SCORED | F_REVEALED) != 0 || markets[key].resolvedAt != 0) revert AlreadyDone();
        f.flags |= F_VOID;
        emit ForecastVoided(key, forecaster, reason);
    }

    // Anyone

    /// @notice Record the onchain payout of a market. Callable by anyone once the CTF reports a payout.
    function finalize(address ctf, bytes32 conditionId) external {
        if (!isAllowedCtf(ctf)) revert CtfNotAllowed(ctf);
        bytes32 key = marketKey(ctf, conditionId);
        Market storage m = markets[key];
        if (m.resolvedAt != 0) revert AlreadyFinalized();
        IConditionalTokens t = IConditionalTokens(ctf);
        uint256 den = t.payoutDenominator(conditionId);
        if (den == 0) revert NotResolvedOnchain();
        uint256 n0 = t.payoutNumerators(conditionId, 0);
        m.resolvedAt = uint64(block.timestamp);
        Outcome o0;
        if (n0 == den) {
            m.winningSlot = 0;
            o0 = Outcome.Yes;
        } else if (n0 == 0) {
            m.winningSlot = 1;
            o0 = Outcome.No;
        } else {
            m.split = true;
            o0 = Outcome.Void;
        }
        emit MarketFinalized(key, o0, m.split);
    }

    /// @notice Score one forecast: after its reveal, or as a forfeit once the reveal window closed. Anyone may call.
    function score(bytes32 key, address forecaster) external {
        Market storage m = markets[key];
        if (m.resolvedAt == 0) revert NotFinalized();
        Forecast storage f = _forecast(key, forecaster);
        if (f.flags & (F_SCORED | F_VOID) != 0) revert AlreadyDone();
        bool revealed = f.flags & F_REVEALED != 0;
        // a void may still land within VOID_WINDOW of the commit: never score before it closes (review L12)
        if (block.timestamp <= uint256(f.committedAt) + VOID_WINDOW) revert TooEarly();
        if (!revealed && block.timestamp <= _revealDeadline(m, f)) revert TooEarly();
        f.flags |= F_SCORED;
        if (m.split) {
            // a split payout is Void for everyone: marked done, never counted
            emit Scored(key, forecaster, 0, 0, 0, false, false);
            return;
        }
        uint256 o = f.slot == m.winningSlot ? BPS : 0;
        uint256 brier = revealed ? _sq(f.bps, o) : MAX_BRIER;
        bool baselineUsed = f.flags & F_BASELINE != 0;
        uint256 baseBrier = baselineUsed ? _sq(f.baselineBps, o) : 0;
        int256 skill = baselineUsed ? int256(baseBrier) - int256(brier) : int256(0);
        Stats storage s = _stats[forecaster];
        s.scored += 1;
        s.sumBrier += uint64(brier);
        if (!revealed) {
            s.forfeited += 1;
            f.flags |= F_FORFEITED;
        }
        if (baselineUsed) {
            s.baselineCount += 1;
            s.sumBaselineBrier += uint64(baseBrier);
            s.sumSkill += int64(skill);
        }
        emit Scored(key, forecaster, brier, baseBrier, skill, baselineUsed, !revealed);
    }

    // Internal

    function _reveal(bytes32 key, address forecaster, uint16 bps, bytes32 salt, address ctf, bytes32 conditionId)
        internal
    {
        if (marketKey(ctf, conditionId) != key) revert HashMismatch();
        Market storage m = markets[key];
        if (m.resolvedAt == 0) revert NotFinalized();
        Forecast storage f = _forecast(key, forecaster);
        if (block.timestamp > _revealDeadline(m, f)) revert RevealClosed();
        if (f.flags & (F_REVEALED | F_SCORED) != 0) revert AlreadyRevealed();
        if (bps < MIN_BPS || bps > MAX_BPS) revert BadBps();
        if (computeCommitHash(ctf, conditionId, f.slot, forecaster, bps, salt) != f.commitHash) revert HashMismatch();
        f.bps = bps;
        f.flags |= F_REVEALED;
        emit Revealed(key, forecaster, bps, msg.sender);
    }

    function _revealDeadline(Market storage m, Forecast storage f) internal view returns (uint256) {
        uint256 start = m.resolvedAt > f.revealNotBefore ? m.resolvedAt : f.revealNotBefore;
        return start + REVEAL_WINDOW;
    }

    function _forecast(bytes32 key, address forecaster) internal view returns (Forecast storage f) {
        f = forecasts[key][forecaster];
        if (f.commitHash == bytes32(0)) revert NoCommit();
    }

    function _sq(uint256 p, uint256 o) internal pure returns (uint256) {
        uint256 d = p > o ? p - o : o - p;
        return d * d;
    }
}
