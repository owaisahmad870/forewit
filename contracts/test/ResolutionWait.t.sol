// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "./Base.t.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";

/// @dev Per round resolution wait: bounds, storage, event, and voidStale timing for daily and long horizon rounds.
contract ResolutionWaitTest is Base {
    function _create(uint64 wait) internal returns (uint256 id, ForecastLedger.QuestionInput[] memory qs) {
        qs = _inputs(2);
        uint64 cd = uint64(block.timestamp) + COMMIT_WINDOW;
        vm.prank(keeper);
        id = ledger.createRound(qs, cd, cd + REVEAL_WINDOW, wait);
    }

    function test_bounds() public {
        ForecastLedger.QuestionInput[] memory qs = _inputs(1);
        uint64 cd = uint64(block.timestamp) + COMMIT_WINDOW;
        vm.startPrank(keeper);
        vm.expectRevert(ForecastLedger.BadResolutionWait.selector);
        ledger.createRound(qs, cd, cd + REVEAL_WINDOW, 1 days - 1);
        vm.expectRevert(ForecastLedger.BadResolutionWait.selector);
        ledger.createRound(qs, cd, cd + REVEAL_WINDOW, 120 days + 1);
        vm.expectRevert(ForecastLedger.BadResolutionWait.selector);
        ledger.createRound(qs, cd, cd + REVEAL_WINDOW, 0);
        ledger.createRound(qs, cd, cd + REVEAL_WINDOW, 1 days);
        ledger.createRound(_inputs(1), cd, cd + REVEAL_WINDOW, 120 days);
        vm.stopPrank();
    }

    function test_storedAndEmitted() public {
        ForecastLedger.QuestionInput[] memory qs = _inputs(2);
        uint64 cd = uint64(block.timestamp) + COMMIT_WINDOW;
        vm.expectEmit(address(ledger));
        emit ForecastLedger.RoundCreated(1, cd, cd + REVEAL_WINDOW, 90 days, qs);
        vm.prank(keeper);
        uint256 id = ledger.createRound(qs, cd, cd + REVEAL_WINDOW, 90 days);
        assertEq(ledger.getRound(id).resolutionWait, 90 days);
    }

    function _voidAt(uint256 id, uint256 when) internal {
        vm.warp(when);
        ledger.voidStale(id, 0);
    }

    function test_dailyRound_voidsAfterSevenDays() public {
        (uint256 id,) = _create(7 days);
        uint256 limit = uint256(ledger.getRound(id).revealDeadline) + 7 days;
        vm.warp(limit);
        vm.expectRevert(ForecastLedger.TooEarly.selector);
        ledger.voidStale(id, 0);
        _voidAt(id, limit + 1);
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Void));
    }

    function test_longHorizonRound_waitsItsOwnWait() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _create(120 days);
        uint256 rd = ledger.getRound(id).revealDeadline;
        vm.warp(rd + 7 days + 1); // a daily round would be voidable here; this one is not
        vm.expectRevert(ForecastLedger.TooEarly.selector);
        ledger.voidStale(id, 0);
        vm.warp(rd + 120 days);
        vm.expectRevert(ForecastLedger.TooEarly.selector);
        ledger.voidStale(id, 0);
        // the market resolves on day 100: finalize works normally and scoring follows
        ledger.sealRound(id);
        vm.warp(rd + 100 days);
        _resolve(qs[1], true);
        ledger.finalizeQuestion(id, 1);
        _voidAt(id, rd + 120 days + 1);
        ForecastLedger.Round memory r = ledger.getRound(id);
        assertEq(r.resolvedMask, 3);
        assertEq(r.voidMask, 1);
    }
}
