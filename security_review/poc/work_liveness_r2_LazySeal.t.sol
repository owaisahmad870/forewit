// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "../Base.t.sol";
import {ForecastLedger} from "../../src/ForecastLedger.sol";

/// @dev Review PoC (Low): the seal is lazy. A round nobody touches in the reveal window is sealed by the first
/// finalize, which voids questions that resolved long after the commit deadline, so a forfeit costs nothing.
contract LazySealPoc is Base {
    function test_poc_unsealedRound_lateFinalizeVoidsAll_forfeitIsFree() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        uint256[] memory ps = new uint256[](2);
        ps[0] = 9000;
        ps[1] = 9000;
        _commit(id, alice, _pack(ps), bytes32(uint256(1)));
        // Nobody reveals or seals. Questions resolve honestly, days after the commit deadline.
        uint256 snap = vm.snapshotState();
        // Counterfactual: she reveals (which seals), same later resolutions, and pays the real Brier.
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, _pack(ps), bytes32(uint256(1)));
        _toScoring(id);
        vm.warp(block.timestamp + 2 days);
        _resolve(qs[0], false);
        _resolve(qs[1], false);
        ledger.finalizeQuestion(id, 0);
        ledger.finalizeQuestion(id, 1);
        ledger.score(id, alice);
        assertEq(ledger.getStats(alice).sumBrier, 2 * 9000 * 9000);
        vm.revertToState(snap);

        _toScoring(id);
        vm.warp(block.timestamp + 2 days);
        _resolve(qs[0], false);
        _resolve(qs[1], false);
        ledger.finalizeQuestion(id, 0); // seals now and voids both as "early"
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Void));
        assertEq(uint8(ledger.getOutcome(id, 1)), uint8(ForecastLedger.Outcome.Void));
        ledger.forfeit(id, alice);
        ForecastLedger.Stats memory s = ledger.getStats(alice);
        assertEq(s.sumBrier, 0); // would have been 2 * 0.81e8 had she revealed, 2e8 for a normal forfeit
        assertEq(s.questionsScored, 0);
        assertEq(s.roundsForfeited, 1);
    }

    /// @dev Negative check: voidStale cannot be gas starved into voiding a question that is resolved onchain.
    function test_check_voidStale_gasSweep_neverVoidsResolved() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(1);
        _toReveal(id);
        ledger.sealRound(id);
        ForecastLedger.Round memory r = ledger.getRound(id);
        vm.warp(uint256(r.revealDeadline) + r.resolutionWait + 1);
        _resolve(qs[0], true);
        for (uint256 g = 5000; g < 200_000; g += 50) {
            try ledger.voidStale{gas: g}(id, 0) {
                revert("voided a resolved question");
            } catch {}
        }
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Unresolved));
    }
}
