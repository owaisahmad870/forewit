// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "../Base.t.sol";
import {ForecastLedger} from "../../src/ForecastLedger.sol";

/// Reviewer probes (score lens). Not exploits of High or Medium severity.
contract ProbeTest is Base {
    bytes32 constant S = keccak256("s");

    /// Duplicates inside one batch are processed once (no double scoring).
    function test_probe_duplicateInBatch_scoredOnce() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(1);
        _commit(id, alice, 7000, S);
        _commit(id, bob, 7000, S);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 7000, S);
        bool[] memory yes = new bool[](1);
        yes[0] = true;
        _resolveAndFinalize(id, qs, yes);
        _toScoring(id);
        address[] memory dup = new address[](4);
        (dup[0], dup[1], dup[2], dup[3]) = (alice, alice, bob, bob);
        assertEq(ledger.scoreBatch(id, dup), 1);
        assertEq(ledger.forfeitBatch(id, dup), 1);
        assertEq(ledger.getStats(alice).questionsScored, 1);
        assertEq(ledger.getStats(bob).questionsScored, 1);
        vm.expectRevert(ForecastLedger.AlreadyProcessed.selector);
        ledger.forfeit(id, bob);
    }

    /// Low: the baseline may be committed at round creation; a forecaster who copies the market later
    /// (here 20 h later, market moved 5000 to 8000 bps, outcome Yes) books positive skill with zero insight.
    function test_probe_lastLook_marketCopyHasPositiveSkill() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(1);
        _commitBaseline(id, 5000, S); // accepted in the first second of the round
        vm.warp(block.timestamp + COMMIT_WINDOW - 1);
        _commit(id, alice, 8000, S); // copy of the later market price
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 8000, S);
        vm.prank(keeper);
        ledger.revealBaseline(id, 5000, S);
        bool[] memory yes = new bool[](1);
        yes[0] = true;
        _resolveAndFinalize(id, qs, yes);
        _toScoring(id);
        ledger.score(id, alice);
        assertEq(int256(ledger.getStats(alice).sumSkill), int256(5000 * 5000) - int256(2000 * 2000));
    }

    /// Low: Stats show no penalty for a non revealer until every question is final and someone calls forfeit.
    function test_probe_lazyForfeit_statsCleanWhileOneQuestionPending() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        _commit(id, bob, 1 | (1 << 16), S);
        _toReveal(id);
        ledger.sealRound(id);
        _resolve(qs[0], true);
        ledger.finalizeQuestion(id, 0);
        _toScoring(id);
        vm.warp(block.timestamp + 6 days); // question 1 still pending, wait not over
        vm.expectRevert(ForecastLedger.RoundNotResolved.selector);
        ledger.forfeit(id, bob);
        ForecastLedger.Stats memory s = ledger.getStats(bob);
        assertEq(s.roundsForfeited, 0);
        assertEq(s.sumBrier, 0);
        assertEq(s.questionsScored, 0);
    }
}
