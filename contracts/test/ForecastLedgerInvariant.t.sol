// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Test} from "forge-std/Test.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";
import {MockAgentID} from "../src/mocks/MockAgentID.sol";
import {MockConditionalTokens} from "../src/mocks/MockConditionalTokens.sol";

/// @dev Drives random sequences of every public action over a few rounds and keeps ghost totals.
contract Handler is Test {
    ForecastLedger public ledger;
    MockConditionalTokens public ctf;
    address public keeper;
    address public admin;
    address[] public actors;
    uint256[] public roundIds;

    mapping(uint256 => mapping(address => uint256)) public packedOf;
    mapping(uint256 => mapping(uint256 => uint8)) public ghostOutcome; // first finalized outcome
    uint256 public ghostQuestionsScored;
    uint256 public scoreCalls;
    uint256 public forfeitCalls;
    uint256 public revealCalls;
    uint256 public revealsWhilePaused;
    uint256 public validRevealFailures;

    constructor(ForecastLedger l, MockConditionalTokens c, address k, address a, address[] memory acts) {
        ledger = l;
        ctf = c;
        keeper = k;
        admin = a;
        actors = acts;
    }

    function _actor(uint256 s) internal view returns (address) {
        return actors[s % actors.length];
    }

    function _round(uint256 s) internal view returns (uint256) {
        return roundIds.length == 0 ? 0 : roundIds[s % roundIds.length];
    }

    function createRound(uint8 nRaw) external {
        if (roundIds.length >= 4) return;
        _createRound(bound(nRaw, 1, 4));
    }

    function _createRound(uint256 n) internal {
        ForecastLedger.QuestionInput[] memory qs = new ForecastLedger.QuestionInput[](n);
        for (uint256 i; i < n; ++i) {
            bytes32 c = keccak256(abi.encode(roundIds.length, i));
            ctf.prepare(c, 2);
            qs[i] = ForecastLedger.QuestionInput(c, address(ctf), uint8(i % 2), i);
        }
        if (ledger.paused()) return;
        vm.prank(keeper);
        roundIds.push(
            ledger.createRound(qs, uint64(block.timestamp + 20 hours), uint64(block.timestamp + 44 hours), 7 days)
        );
    }

    function commit(uint256 actorSeed, uint256 roundSeed, uint256 probSeed) external {
        uint256 id = _round(roundSeed);
        if (id == 0) return;
        _commit(id, _actor(actorSeed), probSeed);
    }

    function _commit(uint256 id, address a, uint256 probSeed) internal {
        uint256 n = ledger.getRound(id).questionCount;
        uint256 packed;
        for (uint256 i; i < n; ++i) {
            packed |= (uint256(keccak256(abi.encode(probSeed, i))) % 10_001) << (16 * i);
        }
        bytes32 h = ledger.computeCommitHash(id, a, packed, bytes32(uint256(uint160(a))));
        vm.prank(a);
        try ledger.commit(id, h) {
            packedOf[id][a] = packed;
        } catch {}
    }

    function reveal(uint256 actorSeed, uint256 roundSeed, bool viaRelayer) external {
        uint256 id = _round(roundSeed);
        if (id == 0) return;
        _reveal(id, _actor(actorSeed), viaRelayer);
    }

    function _reveal(uint256 id, address a, bool viaRelayer) internal {
        ForecastLedger.Round memory r = ledger.getRound(id);
        (, uint8 f) = ledger.getReveal(id, a);
        bool valid = ledger.commits(id, a) != bytes32(0) && f == 0 && block.timestamp >= r.commitDeadline
            && block.timestamp <= r.revealDeadline;
        vm.prank(viaRelayer ? keeper : a);
        try ledger.revealFor(id, a, packedOf[id][a], bytes32(uint256(uint160(a)))) {
            ++revealCalls;
            if (ledger.paused()) ++revealsWhilePaused;
        } catch {
            if (valid) ++validRevealFailures;
        }
    }

    function resolveAndFinalize(uint256 roundSeed, uint8 idxRaw, uint8 kind) external {
        uint256 id = _round(roundSeed);
        if (id == 0) return;
        _resolveAndFinalize(id, bound(idxRaw, 0, ledger.getRound(id).questionCount - 1), kind);
    }

    /// @dev Progress forcing step: close commits, reveal everyone, seal, resolve all, close reveals.
    uint256 internal lastSettled; // round the last settle worked on (it may open a fresh one)

    function _settle(uint256 id, uint256 seed) internal {
        ForecastLedger.Round memory r = ledger.getRound(id);
        if (block.timestamp > r.revealDeadline && roundIds.length < 12) {
            // reveal window already gone: open a fresh round with commits so this step still makes progress
            if (ledger.paused()) {
                vm.prank(admin);
                ledger.unpause();
            }
            _createRound(1 + seed % 4);
            id = roundIds[roundIds.length - 1];
            for (uint256 i; i < actors.length; ++i) {
                _commit(id, actors[i], seed + i);
            }
            r = ledger.getRound(id);
        }
        if (block.timestamp < r.commitDeadline) vm.warp(r.commitDeadline);
        if (block.timestamp <= r.revealDeadline) {
            for (uint256 i; i < actors.length; ++i) {
                if (uint256(keccak256(abi.encode(seed, i))) % 4 != 0) _reveal(id, actors[i], i % 2 == 0);
            }
        }
        try ledger.sealRound(id) {} catch {}
        for (uint256 i; i < r.questionCount; ++i) {
            if (ledger.getOutcome(id, i) == ForecastLedger.Outcome.Unresolved) {
                _resolveAndFinalize(id, i, uint8(uint256(keccak256(abi.encode(seed, "k", i)))));
            }
        }
        if (block.timestamp <= r.revealDeadline) vm.warp(uint256(r.revealDeadline) + 1);
        lastSettled = id;
    }

    function _resolveAndFinalize(uint256 id, uint256 idx, uint8 kind) internal {
        ForecastLedger.Round memory r = ledger.getRound(id);
        ForecastLedger.Question[] memory qs = ledger.getQuestions(id);
        if (ctf.payoutDenominator(qs[idx].conditionId) == 0) {
            uint256[] memory p = new uint256[](2);
            kind = uint8(bound(kind, 0, 2));
            if (kind == 2) (p[0], p[1]) = (1, 1);
            else p[kind] = 1;
            ctf.resolve(qs[idx].conditionId, p);
        }
        try ledger.finalizeQuestion(id, idx) {} catch {}
        for (uint256 i; i < r.questionCount; ++i) {
            uint8 o = uint8(ledger.getOutcome(id, i));
            if (ghostOutcome[id][i] == 0 && o != 0) ghostOutcome[id][i] = o;
        }
    }

    function voidStale(uint256 roundSeed, uint8 idxRaw) external {
        uint256 id = _round(roundSeed);
        if (id == 0) return;
        uint256 idx = bound(idxRaw, 0, ledger.getRound(id).questionCount - 1);
        try ledger.voidStale(id, idx) {
            ghostOutcome[id][idx] = uint8(ForecastLedger.Outcome.Void);
        } catch {}
    }

    function _nonVoid(uint256 id) internal view returns (uint256 q) {
        ForecastLedger.Round memory r = ledger.getRound(id);
        for (uint256 i; i < r.questionCount; ++i) {
            if (r.voidMask & (1 << i) == 0) ++q;
        }
    }

    /// @dev Scoring steps always settle first (early scoring reverts are covered by unit tests), then target an
    /// eligible actor when there is one, so every run reaches the scoring paths.
    function _pick(uint256 id, uint256 seed, bool wantRevealed) internal view returns (address) {
        for (uint256 k; k < actors.length; ++k) {
            address a = actors[(seed + k) % actors.length];
            (, uint8 f) = ledger.getReveal(id, a);
            if (ledger.commits(id, a) == bytes32(0)) continue;
            if (wantRevealed ? (f & 1 != 0 && f & 2 == 0) : f == 0) return a;
        }
        return actors[seed % actors.length];
    }

    function score(uint256 actorSeed, uint256 roundSeed) external {
        uint256 id = _round(roundSeed);
        if (id == 0) return;
        _settle(id, actorSeed);
        id = lastSettled;
        try ledger.score(id, _pick(id, actorSeed, true)) {
            ++scoreCalls;
            ghostQuestionsScored += _nonVoid(id);
        } catch {}
    }

    function forfeit(uint256 actorSeed, uint256 roundSeed) external {
        uint256 id = _round(roundSeed);
        if (id == 0) return;
        _settle(id, actorSeed);
        id = lastSettled;
        try ledger.forfeit(id, _pick(id, actorSeed, false)) {
            ++forfeitCalls;
            ghostQuestionsScored += _nonVoid(id);
        } catch {}
    }

    function batch(uint256 roundSeed) external {
        uint256 id = _round(roundSeed);
        if (id == 0) return;
        _settle(id, roundSeed);
        id = lastSettled;
        try ledger.scoreBatch(id, actors) returns (uint256 k) {
            scoreCalls += k;
            ghostQuestionsScored += k * _nonVoid(id);
        } catch {}
        try ledger.forfeitBatch(id, actors) returns (uint256 k) {
            forfeitCalls += k;
            ghostQuestionsScored += k * _nonVoid(id);
        } catch {}
    }

    function togglePause() external {
        vm.prank(admin);
        if (ledger.paused()) ledger.unpause();
        else ledger.pause();
    }

    function warp(uint32 secs) external {
        vm.warp(block.timestamp + bound(secs, 1 minutes, 6 hours));
    }

    function roundCount() external view returns (uint256) {
        return roundIds.length;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract ForecastLedgerInvariantTest is Test {
    ForecastLedger internal ledger;
    Handler internal handler;
    address[] internal actors;

    function setUp() public {
        vm.warp(1_800_000_000);
        MockAgentID aid = new MockAgentID();
        MockConditionalTokens ctf = new MockConditionalTokens();
        address[] memory list = new address[](1);
        list[0] = address(ctf);
        address admin = makeAddr("admin");
        address keeper = makeAddr("keeper");
        ledger = new ForecastLedger(address(aid), list, admin, keeper, 2 hours, 12 hours);
        for (uint256 i; i < 5; ++i) {
            address a = makeAddr(string(abi.encode("actor", i)));
            if (i < 4) aid.mintTo(a, string(abi.encode("label", i))); // actor 4 has no Agent ID
            actors.push(a);
        }
        handler = new Handler(ledger, ctf, keeper, admin, actors);
        // seed one open round with commits so every run can reach reveal and scoring
        handler.createRound(3);
        for (uint256 i; i < actors.length; ++i) {
            handler.commit(i, 0, i * 7919);
        }
        targetContract(address(handler));
    }

    /// Sum of questionsScored equals the non void questions over every scored or forfeited entry.
    function invariant_questionsScoredMatchesGhost() public view {
        uint256 sum;
        for (uint256 i; i < actors.length; ++i) {
            sum += ledger.getStats(actors[i]).questionsScored;
        }
        assertEq(sum, handler.ghostQuestionsScored());
    }

    /// Flags are consistent: scored implies revealed, forfeited implies not revealed, never both.
    function invariant_flagsConsistent() public view {
        for (uint256 r = 1; r <= ledger.roundCount(); ++r) {
            for (uint256 i; i < actors.length; ++i) {
                (, uint8 f) = ledger.getReveal(r, actors[i]);
                if (f & 2 != 0) assertTrue(f & 1 != 0);
                if (f & 4 != 0) assertTrue(f & 1 == 0);
                assertFalse(f & 2 != 0 && f & 4 != 0);
                if (f & 4 != 0) assertTrue(ledger.commits(r, actors[i]) != bytes32(0));
            }
        }
    }

    /// Outcomes never change once set.
    function invariant_outcomesImmutable() public view {
        for (uint256 r = 1; r <= ledger.roundCount(); ++r) {
            uint256 n = ledger.getRound(r).questionCount;
            for (uint256 i; i < n; ++i) {
                uint8 g = handler.ghostOutcome(r, i);
                if (g != 0) assertEq(uint8(ledger.getOutcome(r, i)), g);
            }
        }
    }

    /// A valid reveal never fails, paused or not; the actor without an Agent ID never holds a commit.
    function invariant_revealNeverBlockedAndGateHolds() public view {
        assertEq(handler.validRevealFailures(), 0);
        address noId = actors[4];
        for (uint256 r = 1; r <= ledger.roundCount(); ++r) {
            assertEq(ledger.commits(r, noId), bytes32(0));
        }
    }

    /// The campaign must actually reach the scoring paths, or the invariants above pass vacuously.
    function afterInvariant() public view {
        assertGt(handler.revealCalls(), 0, "no reveals");
        assertGt(handler.scoreCalls() + handler.forfeitCalls(), 0, "no scores or forfeits");
    }
}
