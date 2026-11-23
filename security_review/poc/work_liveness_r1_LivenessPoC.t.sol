// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "../Base.t.sol";
import {ForecastLedger} from "../../src/ForecastLedger.sol";
import {IConditionalTokens} from "../../src/interfaces/IConditionalTokens.sol";

contract GasBurner {
    fallback() external {
        while (true) {}
    }
}

contract LivenessPoC is Base {
    bytes32 constant SALT = keccak256("salt");

    /// MEDIUM: the round manager decides, after outcomes are public, whether the round's skill exists at all.
    function test_poc_keeperWithholdsBaselineAfterSeeingOutcome() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(1);
        _commit(id, alice, 2000, SALT); // alice says 20% yes
        _commitBaseline(id, 9000, SALT); // market says 90% yes
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 2000, SALT);
        // The market resolves inside the reveal window (12 h to 7 days long), before the keeper reveals.
        _resolve(qs[0], true);
        ledger.finalizeQuestion(id, 0);

        uint256 snap = vm.snapshotState();
        // Branch A, honest keeper: alice's skill is strongly negative.
        vm.prank(keeper);
        ledger.revealBaseline(id, 9000, SALT);
        _toScoring(id);
        ledger.score(id, alice);
        ForecastLedger.Stats memory a = ledger.getStats(alice);
        assertEq(a.sumSkill, int64(int256(1000 * 1000) - int256(8000 * 8000)));
        assertEq(a.baselineQuestions, 1);

        vm.revertToState(snap);
        // Branch B, keeper simply stays silent: the same round leaves no skill record for anyone.
        _toScoring(id);
        vm.prank(keeper);
        vm.expectRevert(ForecastLedger.RevealNotOpen.selector); // and it can never be repaired later
        ledger.revealBaseline(id, 9000, SALT);
        ledger.score(id, alice);
        ForecastLedger.Stats memory b = ledger.getStats(alice);
        assertEq(b.sumSkill, 0);
        assertEq(b.baselineQuestions, 0);
        assertEq(b.questionsScored, 1);
    }

    /// LOW: an allowlisted CTF whose payoutDenominator burns gas blocks every reveal (the seal runs inside the
    /// first reveal and forwards 63/64 of the gas to each of the 16 calls), then everyone can be forfeited.
    function test_poc_gasBurningCtfBlocksRevealAndForcesForfeit() public {
        (uint256 id,) = _createRound(16);
        _commit(id, alice, 0, SALT);
        bytes memory burner = address(new GasBurner()).code;
        vm.etch(address(ctfA), burner);
        vm.etch(address(ctfB), burner);
        _toReveal(id);
        vm.prank(alice);
        (bool ok,) = address(ledger).call{gas: 100_000_000}(abi.encodeCall(ledger.reveal, (id, 0, SALT)));
        assertFalse(ok, "reveal blocked");
        (ok,) = address(ledger).call{gas: 100_000_000}(abi.encodeCall(ledger.sealRound, (id)));
        assertFalse(ok, "seal blocked");
        // voidStale makes a single call, so it still works, and the honest forecaster is forfeited.
        vm.warp(uint256(ledger.getRound(id).revealDeadline) + 7 days + 1);
        for (uint256 i; i < 16; ++i) {
            ledger.voidStale{gas: 3_000_000}(id, i);
        }
        ledger.forfeit(id, alice);
        assertEq(ledger.getStats(alice).roundsForfeited, 1);
    }

    /// LOW: denominator set but payoutNumerators reverting: neither finalizeQuestion nor voidStale can ever
    /// resolve the question, so the round is frozen for good.
    function test_poc_numeratorRevertFreezesRound() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(1);
        _commit(id, alice, 5000, SALT);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 5000, SALT);
        vm.mockCall(qs[0].ctf, abi.encodeCall(IConditionalTokens.payoutDenominator, (qs[0].conditionId)), abi.encode(1));
        vm.mockCallRevert(qs[0].ctf, abi.encodeWithSelector(IConditionalTokens.payoutNumerators.selector), "");
        vm.warp(uint256(ledger.getRound(id).revealDeadline) + 7 days + 1);
        vm.expectRevert();
        ledger.finalizeQuestion(id, 0);
        vm.expectRevert(abi.encodeWithSelector(ForecastLedger.AlreadyResolved.selector, 0));
        ledger.voidStale(id, 0);
        vm.expectRevert(ForecastLedger.RoundNotResolved.selector);
        ledger.score(id, alice);
    }

    /// INFO (negative result): with a cheap CTF view, no gas limit lets a caller seal a round while skipping
    /// the void of an early resolved question (63/64 rule). Either the whole call reverts or the void happens.
    function test_check_gasStarvedSealCannotSkipVoid() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        _resolve(qs[1], true); // resolved while commits are open
        _toReveal(id);
        uint256 sealedCount;
        for (uint256 g = 5_000; g < 200_000; g += 53) {
            uint256 snap = vm.snapshotState();
            vm.cool(address(ctfA));
            vm.cool(address(ctfB));
            vm.cool(address(ledger));
            (bool ok,) = address(ledger).call{gas: g}(abi.encodeCall(ledger.sealRound, (id)));
            if (ok) {
                ++sealedCount;
                assertEq(uint8(ledger.getOutcome(id, 1)), uint8(ForecastLedger.Outcome.Void), "void skipped");
            }
            vm.revertToState(snap);
        }
        assertGt(sealedCount, 0);
    }
}
