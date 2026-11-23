// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "../Base.t.sol";
import {ForecastLedger} from "../../src/ForecastLedger.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

/// @dev PoC: the baseline reveal is discretionary and role gated, so ROUND_MANAGER (or DEFAULT_ADMIN, with no
/// delay) decides after all reveals and the outcome are public whether skill is recorded for a round.
contract AdminBaselinePoC is Base {
    bytes32 constant SALT = keccak256("s");
    uint256 constant BASE = 5000;

    /// @dev One round up to the point where everything but the baseline reveal is public and final.
    function _roundReadyForBaseline() internal returns (uint256 id) {
        ForecastLedger.QuestionInput[] memory qs;
        (id, qs) = _createRound(1);
        _commit(id, alice, 9000, SALT); // honest, better than the market
        _commit(id, bob, 1000, SALT); // keeper's friend, worse than the market
        _commit(id, carol, 5000, SALT); // never reveals, will be forfeited
        _commitBaseline(id, BASE, SALT);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 9000, SALT);
        vm.prank(bob);
        ledger.reveal(id, 1000, SALT);
        _resolve(qs[0], true); // outcome Yes, known inside the reveal window
        ledger.finalizeQuestion(id, 0);
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Yes));
    }

    function _scoreAll(uint256 id) internal {
        _toScoring(id);
        ledger.score(id, alice);
        ledger.score(id, bob);
        ledger.forfeit(id, carol);
    }

    function test_poc_keeperWithholdsBaselineAfterSeeingRevealsAndOutcome() public {
        uint256 id = _roundReadyForBaseline();
        uint256 snap = vm.snapshotState();

        // Branch 1: keeper reveals the baseline it committed.
        vm.prank(keeper);
        ledger.revealBaseline(id, BASE, SALT);
        _scoreAll(id);
        ForecastLedger.Stats memory a1 = ledger.getStats(alice);
        ForecastLedger.Stats memory b1 = ledger.getStats(bob);
        ForecastLedger.Stats memory c1 = ledger.getStats(carol);

        // Branch 2: same state, keeper simply stays silent.
        vm.revertToState(snap);
        _scoreAll(id);
        ForecastLedger.Stats memory a2 = ledger.getStats(alice);
        ForecastLedger.Stats memory b2 = ledger.getStats(bob);
        ForecastLedger.Stats memory c2 = ledger.getStats(carol);

        // Raw Brier is identical: the keeper's choice is the only variable.
        assertEq(a1.sumBrier, a2.sumBrier);
        assertEq(b1.sumBrier, b2.sumBrier);
        // Revealed: alice earns +0.24, bob -0.56, carol (forfeit) -0.75, in 1e8 units.
        assertEq(a1.sumSkill, int64(24_000_000));
        assertEq(b1.sumSkill, -int64(56_000_000));
        assertEq(c1.sumSkill, -int64(75_000_000));
        assertEq(a1.baselineQuestions, 1);
        // Withheld: alice's earned skill is gone, bob's and the forfeiter's losses are erased from the record.
        assertEq(a2.sumSkill, 0);
        assertEq(b2.sumSkill, 0);
        assertEq(c2.sumSkill, 0);
        assertEq(a2.baselineQuestions, 0);
        assertEq(b2.baselineQuestions, 0);
        assertEq(c2.baselineQuestions, 0);
    }

    /// @dev Deniable variant: commit the hash of a vector that can never pass _checkCanonical.
    function test_poc_unrevealableBaselineCommit() public {
        (uint256 id,) = _createRound(1);
        _commitBaseline(id, 10_001, SALT);
        _toReveal(id);
        vm.prank(keeper);
        vm.expectRevert(ForecastLedger.NonCanonical.selector);
        ledger.revealBaseline(id, 10_001, SALT);
    }

    /// @dev DEFAULT_ADMIN, with no delay, burns the single baseline slot before the keeper uses it.
    function test_poc_adminBurnsBaselineSlotInstantly() public {
        (uint256 id,) = _createRound(1);
        vm.startPrank(admin);
        ledger.grantRole(ledger.ROUND_MANAGER_ROLE(), admin); // same block, no timelock
        ledger.commitBaseline(id, keccak256("garbage"));
        vm.stopPrank();
        bytes32 h = ledger.computeCommitHash(id, ledger.BASELINE(), BASE, SALT);
        vm.prank(keeper);
        vm.expectRevert(ForecastLedger.AlreadyCommitted.selector);
        ledger.commitBaseline(id, h);
    }

    /// @dev DEFAULT_ADMIN revokes the keeper inside the reveal window: nobody else can reveal the baseline,
    /// even with the right vector and salt (unlike revealFor for forecasters).
    function test_poc_adminRevokesKeeperMidRound() public {
        uint256 id = _roundReadyForBaseline();
        bytes32 role = ledger.ROUND_MANAGER_ROLE();
        vm.prank(admin);
        ledger.revokeRole(role, keeper);
        vm.prank(keeper);
        vm.expectRevert();
        ledger.revealBaseline(id, BASE, SALT);
        vm.prank(alice);
        vm.expectRevert();
        ledger.revealBaseline(id, BASE, SALT);
        _scoreAll(id);
        assertEq(ledger.getStats(alice).sumSkill, 0);
        assertFalse(ledger.getRound(id).baselineRevealed);
    }

    /// @dev Checks for Low and Info claims: stale PAUSER after admin transfer, pause blocks commit overwrite.
    function test_check_stalePauserAndOverwriteBlocked() public {
        address next = makeAddr("multisig");
        vm.prank(admin);
        ledger.beginDefaultAdminTransfer(next);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(next);
        ledger.acceptDefaultAdminTransfer();
        assertEq(ledger.defaultAdmin(), next);
        assertTrue(ledger.hasRole(ledger.PAUSER_ROLE(), admin)); // old admin still pauser
        assertFalse(ledger.hasRole(ledger.PAUSER_ROLE(), next)); // new admin is not
        (uint256 id,) = _createRound(1);
        _commit(id, alice, 9000, SALT);
        vm.prank(admin);
        ledger.pause();
        bytes32 h = ledger.computeCommitHash(id, alice, 2000, SALT);
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        ledger.commit(id, h); // commit window still open, alice cannot update her forecast
        bytes32 pauser = ledger.PAUSER_ROLE();
        vm.prank(next);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, next, pauser));
        ledger.unpause(); // new admin must first grant itself PAUSER or revoke
    }

    /// @dev Check for the Low claim: one Agent ID, reissued to a new wallet, commits twice in one round (mock only).
    function test_check_reissuedAgentIdCommitsTwice() public {
        (uint256 id,) = _createRound(1);
        _commit(id, alice, 9000, SALT);
        vm.prank(alice);
        aid.burn("alice");
        address alice2 = makeAddr("alice2");
        aid.mintTo(alice2, "alice");
        _commit(id, alice2, 1000, SALT);
        assertTrue(ledger.getCommit(id, alice) != bytes32(0) && ledger.getCommit(id, alice2) != bytes32(0));
    }
}
