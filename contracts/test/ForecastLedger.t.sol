// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "./Base.t.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";
import {MockConditionalTokens} from "../src/mocks/MockConditionalTokens.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {
    IAccessControlDefaultAdminRules
} from "@openzeppelin/contracts/access/extensions/IAccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract ForecastLedgerTest is Base {
    bytes32 internal constant SALT = keccak256("salt");

    // Constructor

    function _list(address a) internal pure returns (address[] memory l) {
        l = new address[](1);
        l[0] = a;
    }

    function test_constructor_setsState() public view {
        assertEq(address(ledger.AGENT_ID()), address(aid));
        assertTrue(ledger.hasRole(ledger.ROUND_MANAGER_ROLE(), keeper));
        assertTrue(ledger.hasRole(ledger.PAUSER_ROLE(), admin));
        assertTrue(ledger.hasRole(ledger.DEFAULT_ADMIN_ROLE(), admin));
        assertEq(ledger.defaultAdminDelay(), 1 days);
        assertEq(ledger.MAX_RESOLUTION_WAIT(), 120 days);
        assertEq(ledger.MIN_RESOLUTION_WAIT(), 1 days);
        assertTrue(ledger.isAllowedCtf(address(ctfA)));
        assertTrue(ledger.isAllowedCtf(address(ctfB)));
        assertFalse(ledger.isAllowedCtf(address(0)));
        assertFalse(ledger.isAllowedCtf(address(aid)));
        address[4] memory l = ledger.getCtfAllowlist();
        assertEq(l[0], address(ctfA));
        assertEq(l[1], address(ctfB));
        assertEq(l[2], address(0));
        assertEq(l[3], address(0));
    }

    function test_constructor_fourCtfs() public {
        address[] memory l = new address[](4);
        for (uint256 i; i < 4; ++i) {
            l[i] = address(new MockConditionalTokens());
        }
        ForecastLedger x = new ForecastLedger(address(aid), l, admin, keeper, 2 hours, 12 hours);
        for (uint256 i; i < 4; ++i) {
            assertTrue(x.isAllowedCtf(l[i]));
        }
    }

    // One deployment per test, so each constructor revert branch is measured on its own.
    function _ok() internal view returns (address[] memory) {
        return _list(address(ctfA));
    }

    function test_constructor_zeroAgentId() public {
        address[] memory l = _ok();
        vm.expectRevert(ForecastLedger.ZeroAddress.selector);
        new ForecastLedger(address(0), l, admin, keeper, 2 hours, 12 hours);
    }

    function test_constructor_zeroRoundManager() public {
        address[] memory l = _ok();
        vm.expectRevert(ForecastLedger.ZeroAddress.selector);
        new ForecastLedger(address(aid), l, admin, address(0), 2 hours, 12 hours);
    }

    function test_constructor_agentIdNoCode() public {
        address[] memory l = _ok();
        vm.expectRevert(abi.encodeWithSelector(ForecastLedger.NoCode.selector, nobody));
        new ForecastLedger(nobody, l, admin, keeper, 2 hours, 12 hours);
    }

    function test_constructor_zeroAdmin() public {
        address[] memory l = _ok();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControlDefaultAdminRules.AccessControlInvalidDefaultAdmin.selector, address(0)
            )
        );
        new ForecastLedger(address(aid), l, address(0), keeper, 2 hours, 12 hours);
    }

    function test_constructor_emptyList() public {
        address[] memory l = new address[](0);
        vm.expectRevert(ForecastLedger.BadCtfList.selector);
        new ForecastLedger(address(aid), l, admin, keeper, 2 hours, 12 hours);
    }

    function test_constructor_tooManyCtfs() public {
        address[] memory l = new address[](5);
        vm.expectRevert(ForecastLedger.BadCtfList.selector);
        new ForecastLedger(address(aid), l, admin, keeper, 2 hours, 12 hours);
    }

    function test_constructor_duplicateCtf() public {
        address[] memory l = new address[](2);
        l[0] = address(ctfA);
        l[1] = address(ctfA);
        vm.expectRevert(ForecastLedger.BadCtfList.selector);
        new ForecastLedger(address(aid), l, admin, keeper, 2 hours, 12 hours);
    }

    function test_constructor_zeroCtf() public {
        address[] memory l = _list(address(0));
        vm.expectRevert(ForecastLedger.ZeroAddress.selector);
        new ForecastLedger(address(aid), l, admin, keeper, 2 hours, 12 hours);
    }

    function test_constructor_ctfNoCode() public {
        address[] memory l = _list(nobody);
        vm.expectRevert(abi.encodeWithSelector(ForecastLedger.NoCode.selector, nobody));
        new ForecastLedger(address(aid), l, admin, keeper, 2 hours, 12 hours);
    }

    function test_rejectsBnb() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(ledger).call{value: 1}("");
        assertFalse(ok);
    }

    // createRound

    function test_createRound_success() public {
        ForecastLedger.QuestionInput[] memory qs = _inputs(3);
        uint64 cd = uint64(block.timestamp) + COMMIT_WINDOW;
        uint64 rd = cd + REVEAL_WINDOW;
        vm.expectEmit(address(ledger));
        emit ForecastLedger.RoundCreated(1, cd, rd, 7 days, qs);
        vm.prank(keeper);
        uint256 id = ledger.createRound(qs, cd, rd, 7 days);
        assertEq(id, 1);
        assertEq(ledger.roundCount(), 1);
        ForecastLedger.Round memory r = ledger.getRound(1);
        assertEq(r.commitDeadline, cd);
        assertEq(r.revealDeadline, rd);
        assertEq(r.createdAt, block.timestamp);
        assertEq(r.questionCount, 3);
        ForecastLedger.Question[] memory got = ledger.getQuestions(1);
        assertEq(got.length, 3);
        for (uint256 i; i < 3; ++i) {
            assertEq(got[i].conditionId, qs[i].conditionId);
            assertEq(got[i].ctf, qs[i].ctf);
            assertEq(got[i].yesSlot, qs[i].yesSlot);
            assertEq(uint8(ledger.getOutcome(1, i)), uint8(ForecastLedger.Outcome.Unresolved));
        }
        (uint256 id2,) = _createRound(16);
        assertEq(id2, 2);
    }

    function test_createRound_access() public {
        ForecastLedger.QuestionInput[] memory qs = _inputs(1);
        uint64 cd = uint64(block.timestamp) + COMMIT_WINDOW;
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, alice, ledger.ROUND_MANAGER_ROLE()
            )
        );
        vm.prank(alice);
        ledger.createRound(qs, cd, cd + REVEAL_WINDOW, 7 days);
        vm.prank(admin);
        ledger.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(keeper);
        ledger.createRound(qs, cd, cd + REVEAL_WINDOW, 7 days);
    }

    function _expectCreateRevert(ForecastLedger.QuestionInput[] memory qs, uint64 cd, uint64 rd, bytes memory err)
        internal
    {
        vm.expectRevert(err);
        vm.prank(keeper);
        ledger.createRound(qs, cd, rd, 7 days);
    }

    function test_createRound_reverts() public {
        uint64 t = uint64(block.timestamp);
        uint64 cd = t + COMMIT_WINDOW;
        uint64 rd = cd + REVEAL_WINDOW;
        bytes memory badCount = abi.encodeWithSelector(ForecastLedger.BadQuestionCount.selector);
        _expectCreateRevert(new ForecastLedger.QuestionInput[](0), cd, rd, badCount);
        _expectCreateRevert(_inputs(17), cd, rd, badCount);

        ForecastLedger.QuestionInput[] memory qs = _inputs(2);
        bytes memory badDl = abi.encodeWithSelector(ForecastLedger.BadDeadlines.selector);
        _expectCreateRevert(qs, t + 2 hours - 1, t + 2 hours - 1 + 12 hours, badDl);
        _expectCreateRevert(qs, t + 7 days + 1, t + 7 days + 1 + 12 hours, badDl);
        _expectCreateRevert(qs, cd, cd + 12 hours - 1, badDl);
        _expectCreateRevert(qs, cd, cd + 7 days + 1, badDl);
        // boundaries are accepted
        vm.startPrank(keeper);
        ledger.createRound(_inputs(1), t + 2 hours, t + 2 hours + 12 hours, 7 days);
        ledger.createRound(_inputs(1), t + 7 days, t + 14 days, 7 days);
        vm.stopPrank();

        ForecastLedger.QuestionInput[] memory bad = _inputs(2);
        bad[1].ctf = nobody;
        _expectCreateRevert(bad, cd, rd, abi.encodeWithSelector(ForecastLedger.CtfNotAllowed.selector, nobody));

        bad = _inputs(2);
        bad[1].yesSlot = 2;
        _expectCreateRevert(bad, cd, rd, abi.encodeWithSelector(ForecastLedger.BadYesSlot.selector, 1));

        bad = _inputs(3);
        bad[2].conditionId = bad[0].conditionId;
        bad[2].ctf = bad[0].ctf;
        _expectCreateRevert(bad, cd, rd, abi.encodeWithSelector(ForecastLedger.DuplicateCondition.selector, 2));

        bad = _inputs(2);
        bytes32 three = keccak256("three");
        ctfA.prepare(three, 3);
        bad[1].conditionId = three;
        bad[1].ctf = address(ctfA);
        _expectCreateRevert(bad, cd, rd, abi.encodeWithSelector(ForecastLedger.BadSlotCount.selector, 1));

        bad = _inputs(2);
        bad[0].conditionId = keccak256("unprepared");
        _expectCreateRevert(bad, cd, rd, abi.encodeWithSelector(ForecastLedger.BadSlotCount.selector, 0));

        bad = _inputs(2);
        _resolve(bad[1], true);
        _expectCreateRevert(bad, cd, rd, abi.encodeWithSelector(ForecastLedger.AlreadyResolved.selector, 1));
    }

    // Baseline

    function test_baseline_set() public {
        (uint256 id,) = _createRound(2);
        uint256 packed = 6000 | (3000 << 16);
        uint256 cd = ledger.getRound(id).commitDeadline;
        vm.warp(cd - 15 minutes); // first second of the window
        vm.expectEmit(address(ledger));
        emit ForecastLedger.BaselineSet(id, packed);
        vm.prank(keeper);
        ledger.setBaseline(id, packed);
        ForecastLedger.Round memory r = ledger.getRound(id);
        assertTrue(r.baselineSet);
        assertEq(r.baselinePacked, packed);
        assertFalse(r.isSealed); // posting the baseline does not seal
    }

    function test_baseline_beforeWindowReverts() public {
        (uint256 id,) = _createRound(2);
        uint256 cd = ledger.getRound(id).commitDeadline;
        vm.prank(keeper);
        vm.expectRevert(ForecastLedger.BaselineWindow.selector);
        ledger.setBaseline(id, 5000); // at round creation
        vm.warp(cd - 15 minutes - 1);
        vm.prank(keeper);
        vm.expectRevert(ForecastLedger.BaselineWindow.selector);
        ledger.setBaseline(id, 5000);
    }

    function test_baseline_atOrAfterDeadlineReverts() public {
        (uint256 id,) = _createRound(2);
        uint256 cd = ledger.getRound(id).commitDeadline;
        vm.warp(cd);
        vm.prank(keeper);
        vm.expectRevert(ForecastLedger.BaselineWindow.selector);
        ledger.setBaseline(id, 5000);
        vm.warp(cd + 12 hours); // in the reveal window: no hindsight posting
        vm.prank(keeper);
        vm.expectRevert(ForecastLedger.BaselineWindow.selector);
        ledger.setBaseline(id, 5000);
    }

    function test_baseline_twiceReverts() public {
        (uint256 id,) = _createRound(2);
        _setBaseline(id, 5000);
        vm.prank(keeper);
        vm.expectRevert(ForecastLedger.BaselineAlreadySet.selector);
        ledger.setBaseline(id, 6000);
        assertEq(ledger.getRound(id).baselinePacked, 5000);
    }

    function test_baseline_otherReverts() public {
        (uint256 id,) = _createRound(2);
        vm.warp(uint256(ledger.getRound(id).commitDeadline) - 5 minutes);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, alice, ledger.ROUND_MANAGER_ROLE()
            )
        );
        vm.prank(alice);
        ledger.setBaseline(id, 5000);
        vm.startPrank(keeper);
        vm.expectRevert(ForecastLedger.UnknownRound.selector);
        ledger.setBaseline(99, 5000);
        vm.expectRevert(ForecastLedger.NonCanonical.selector);
        ledger.setBaseline(id, 10_001);
        vm.expectRevert(ForecastLedger.NonCanonical.selector);
        ledger.setBaseline(id, 1 | (1 << 32)); // slot 2 in a 2 question round
        vm.stopPrank();
    }

    function test_missingBaseline_scoresSkillZero() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(1);
        _commit(id, alice, 8000, SALT);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 8000, SALT);
        _resolve(qs[0], true);
        ledger.finalizeQuestion(id, 0);
        _toScoring(id);
        ledger.score(id, alice);
        ForecastLedger.Stats memory s = ledger.getStats(alice);
        assertFalse(ledger.getRound(id).baselineSet);
        assertEq(s.sumBrier, 2000 * 2000);
        assertEq(s.sumSkill, 0);
        assertEq(s.baselineQuestions, 0);
    }

    // Commit

    function test_commit_success_and_overwrite() public {
        (uint256 id,) = _createRound(2);
        bytes32 h1 = keccak256("h1");
        vm.expectEmit(address(ledger));
        emit ForecastLedger.Committed(id, alice, h1);
        vm.prank(alice);
        ledger.commit(id, h1);
        assertEq(ledger.getCommit(id, alice), h1);
        assertEq(ledger.getStats(alice).roundsCommitted, 1);
        assertEq(ledger.getStats(alice).lastRound, id);

        bytes32 h2 = keccak256("h2");
        vm.prank(alice);
        ledger.commit(id, h2);
        assertEq(ledger.commits(id, alice), h2);
        assertEq(ledger.getStats(alice).roundsCommitted, 1);
    }

    function test_commit_reverts() public {
        (uint256 id,) = _createRound(2);
        vm.startPrank(alice);
        vm.expectRevert(ForecastLedger.UnknownRound.selector);
        ledger.commit(42, keccak256("h"));
        vm.expectRevert(ForecastLedger.ZeroHash.selector);
        ledger.commit(id, bytes32(0));
        vm.stopPrank();

        vm.prank(nobody);
        vm.expectRevert(ForecastLedger.NoAgentID.selector);
        ledger.commit(id, keccak256("h"));

        vm.prank(admin);
        ledger.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        ledger.commit(id, keccak256("h"));
        vm.prank(admin);
        ledger.unpause();

        _toReveal(id);
        vm.prank(alice);
        vm.expectRevert(ForecastLedger.CommitClosed.selector);
        ledger.commit(id, keccak256("h"));
    }

    // Reveal

    function test_reveal_success() public {
        (uint256 id,) = _createRound(3);
        uint256 packed = 1 | (5000 << 16) | (10_000 << 32);
        _commit(id, alice, packed, SALT);
        _toReveal(id);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.Revealed(id, alice, packed, alice);
        vm.prank(alice);
        ledger.reveal(id, packed, SALT);
        (uint256 p, uint8 f) = ledger.getReveal(id, alice);
        assertEq(p, packed);
        assertEq(f, 1);
        assertEq(ledger.getStats(alice).roundsRevealed, 1);
        assertEq(ledger.unpack(packed, 1), 5000);
        assertTrue(ledger.getRound(id).isSealed);
    }

    function test_reveal_atRevealDeadline() public {
        (uint256 id,) = _createRound(1);
        _commit(id, alice, 7000, SALT);
        vm.warp(ledger.getRound(id).revealDeadline);
        vm.prank(alice);
        ledger.reveal(id, 7000, SALT);
    }

    function test_reveal_sixteenQuestions() public {
        (uint256 id,) = _createRound(16);
        uint256 packed;
        for (uint256 i; i < 16; ++i) {
            packed |= (10_000 - i) << (16 * i);
        }
        _commit(id, alice, packed, SALT);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, packed, SALT);
    }

    function test_reveal_reverts() public {
        (uint256 id,) = _createRound(2);
        uint256 packed = 4000 | (6000 << 16);
        _commit(id, alice, packed, SALT);
        vm.prank(alice);
        vm.expectRevert(ForecastLedger.RevealNotOpen.selector);
        ledger.reveal(id, packed, SALT);

        _toReveal(id);
        vm.startPrank(alice);
        vm.expectRevert(ForecastLedger.HashMismatch.selector);
        ledger.reveal(id, packed, keccak256("other"));
        vm.expectRevert(ForecastLedger.HashMismatch.selector);
        ledger.reveal(id, packed + 1, SALT);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(ForecastLedger.NoCommit.selector);
        ledger.reveal(id, packed, SALT);
        vm.prank(alice);
        ledger.reveal(id, packed, SALT);
        vm.prank(alice);
        vm.expectRevert(ForecastLedger.AlreadyRevealed.selector);
        ledger.reveal(id, packed, SALT);

        _toScoring(id);
        vm.prank(bob);
        vm.expectRevert(ForecastLedger.RevealNotOpen.selector);
        ledger.reveal(id, packed, SALT);
    }

    function test_reveal_nonCanonical() public {
        (uint256 id,) = _createRound(2);
        uint256 over = 10_001;
        uint256 extra = 1 | (1 << 32); // slot 2 set in a 2 question round
        _commit(id, alice, over, SALT);
        _commit(id, bob, extra, SALT);
        _toReveal(id);
        vm.prank(alice);
        vm.expectRevert(ForecastLedger.NonCanonical.selector);
        ledger.reveal(id, over, SALT);
        vm.prank(bob);
        vm.expectRevert(ForecastLedger.NonCanonical.selector);
        ledger.reveal(id, extra, SALT);
    }

    function test_revealFor_thirdParty() public {
        (uint256 id,) = _createRound(2);
        uint256 packed = 2500 | (7500 << 16);
        _commit(id, alice, packed, SALT);
        _toReveal(id);
        vm.prank(nobody);
        vm.expectRevert(ForecastLedger.HashMismatch.selector);
        ledger.revealFor(id, alice, packed + 1, SALT);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.Revealed(id, alice, packed, nobody);
        vm.prank(nobody);
        ledger.revealFor(id, alice, packed, SALT);
        (uint256 p,) = ledger.getReveal(id, alice);
        assertEq(p, packed);
    }

    function test_revealFor_bindsForecaster() public {
        (uint256 id,) = _createRound(1);
        _commit(id, alice, 5000, SALT);
        bytes32 h = ledger.computeCommitHash(id, alice, 5000, SALT);
        vm.prank(bob);
        ledger.commit(id, h); // bob copies alice's hash
        _toReveal(id);
        vm.prank(bob);
        vm.expectRevert(ForecastLedger.HashMismatch.selector);
        ledger.reveal(id, 5000, SALT);
    }

    function test_reveal_afterAgentIdBurned() public {
        (uint256 id,) = _createRound(1);
        _commit(id, alice, 5000, SALT);
        _commit(id, bob, 6000, SALT);
        vm.prank(alice);
        aid.burn("alice");
        vm.prank(bob);
        aid.burn("bob");
        assertEq(aid.balanceOf(alice), 0);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 5000, SALT);
        vm.prank(carol);
        ledger.revealFor(id, bob, 6000, SALT);
        (, uint8 fa) = ledger.getReveal(id, alice);
        (, uint8 fb) = ledger.getReveal(id, bob);
        assertEq(fa, 1);
        assertEq(fb, 1);
    }

    // Profiles

    function test_profile() public {
        vm.startPrank(alice);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.ProfileUpdated(alice, true, 0);
        ledger.setPublicProfile(true, "");
        assertTrue(ledger.publicProfile(alice));
        ledger.setPublicProfile(true, "alice");
        assertEq(ledger.profileLabelId(alice), uint256(keccak256("alice")));
        vm.expectRevert(ForecastLedger.LabelNotOwned.selector);
        ledger.setPublicProfile(true, "bob");
        vm.expectRevert(ForecastLedger.LabelNotOwned.selector);
        ledger.setPublicProfile(true, "ghost");
        ledger.setPublicProfile(false, "");
        assertFalse(ledger.publicProfile(alice));
        assertEq(ledger.profileLabelId(alice), 0);
        vm.stopPrank();
    }

    // Resolution

    function test_finalize_yesNoVoid() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(4);
        _toReveal(id);
        ledger.sealRound(id);
        _resolve(qs[0], true); // yesSlot 0
        _resolve(qs[1], true); // yesSlot 1
        _resolve(qs[2], false);
        _resolveSplit(qs[3]);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.QuestionFinalized(id, 0, ForecastLedger.Outcome.Yes, false, false);
        ledger.finalizeQuestion(id, 0);
        ledger.finalizeQuestion(id, 1);
        ledger.finalizeQuestion(id, 2);
        ledger.finalizeQuestion(id, 3);
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Yes));
        assertEq(uint8(ledger.getOutcome(id, 1)), uint8(ForecastLedger.Outcome.Yes));
        assertEq(uint8(ledger.getOutcome(id, 2)), uint8(ForecastLedger.Outcome.No));
        assertEq(uint8(ledger.getOutcome(id, 3)), uint8(ForecastLedger.Outcome.Void));
        ForecastLedger.Round memory r = ledger.getRound(id);
        assertEq(r.resolvedMask, 15);
        assertEq(r.outcomeYesMask, 3);
        assertEq(r.voidMask, 8);
    }

    function test_finalize_noOnYesSlotOne() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        _toReveal(id);
        ledger.sealRound(id);
        _resolve(qs[1], false);
        ledger.finalizeQuestion(id, 1);
        assertEq(uint8(ledger.getOutcome(id, 1)), uint8(ForecastLedger.Outcome.No));
    }

    function test_finalize_reverts() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        vm.expectRevert(ForecastLedger.UnknownRound.selector);
        ledger.finalizeQuestion(9, 0);
        vm.expectRevert(ForecastLedger.BadIndex.selector);
        ledger.finalizeQuestion(id, 2);
        vm.expectRevert(ForecastLedger.NotResolvedOnchain.selector);
        ledger.finalizeQuestion(id, 0);
        _toReveal(id);
        ledger.sealRound(id);
        _resolve(qs[0], true);
        ledger.finalizeQuestion(id, 0);
        vm.expectRevert(ForecastLedger.QuestionAlreadyFinal.selector);
        ledger.finalizeQuestion(id, 0);
        vm.expectRevert(ForecastLedger.BadIndex.selector);
        ledger.getOutcome(id, 2);
    }

    function test_earlyResolution_finalizedBeforeDeadline_isVoid() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        _resolve(qs[0], true);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.QuestionFinalized(id, 0, ForecastLedger.Outcome.Void, true, false);
        ledger.finalizeQuestion(id, 0);
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Void));
    }

    function test_seal_skipsAlreadyFinalQuestions() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        _resolve(qs[0], true);
        ledger.finalizeQuestion(id, 0); // early: Void
        _toReveal(id);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.RoundSealed(id, 0);
        ledger.sealRound(id);
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Void));
    }

    function test_revertingCtf_neverBlocksRevealOrVoid() public {
        (uint256 id,) = _createRound(2); // q0 on ctfA, q1 on ctfB
        _commit(id, alice, 5000 | (5000 << 16), SALT);
        vm.mockCallRevert(address(ctfA), abi.encodeWithSelector(ctfA.payoutDenominator.selector), "broken");
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 5000 | (5000 << 16), SALT); // seals despite the broken CTF
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Unresolved));
        vm.warp(uint256(ledger.getRound(id).revealDeadline) + ledger.getRound(id).resolutionWait + 1);
        ledger.voidStale(id, 0);
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Void));
    }

    function _malformedCase(bytes memory ret) internal returns (uint256 id) {
        (id,) = _createRound(2); // q0 on ctfA, q1 on ctfB
        _commit(id, alice, 5000 | (5000 << 16), SALT);
        vm.mockCall(address(ctfA), abi.encodeWithSelector(ctfA.payoutDenominator.selector), ret);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 5000 | (5000 << 16), SALT); // seals through the malformed CTF
    }

    function test_malformedCtfData_emptyAndShort_neverBlockRevealOrVoid() public {
        bytes[3] memory bad = [bytes(""), hex"01", hex"00000000000000000000000000000000000000000000000000000000000001"];
        for (uint256 k; k < bad.length; ++k) {
            uint256 id = _malformedCase(bad[k]); // 0, 1 and 31 bytes: too short to be a word
            assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Unresolved));
            vm.warp(uint256(ledger.getRound(id).revealDeadline) + ledger.getRound(id).resolutionWait + 1);
            ledger.voidStale(id, 0);
            assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Void));
            vm.clearMockedCalls();
        }
    }

    function test_malformedCtfData_oversizedNonzero_readsFirstWord() public {
        // 64 garbage bytes with a nonzero first word read as "resolved", so the seal voids the question
        uint256 id = _malformedCase(abi.encode(uint256(0xdead), uint256(0xbeef)));
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Void));
        assertEq(uint8(ledger.getOutcome(id, 1)), uint8(ForecastLedger.Outcome.Unresolved));
    }

    function test_profile_optOutClearsName() public {
        vm.startPrank(alice);
        ledger.setPublicProfile(true, "alice");
        assertEq(ledger.profileLabelId(alice), uint256(keccak256("alice")));
        vm.expectEmit(address(ledger));
        emit ForecastLedger.ProfileUpdated(alice, false, 0);
        ledger.setPublicProfile(false, "alice"); // a label passed with false is ignored
        assertFalse(ledger.publicProfile(alice));
        assertEq(ledger.profileLabelId(alice), 0);
        ledger.setPublicProfile(false, "bob"); // not owned, but ignored when opting out
        assertEq(ledger.profileLabelId(alice), 0);
        vm.stopPrank();
    }

    function test_earlyResolution_sealVoidsItLater() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(3);
        _resolve(qs[1], false); // resolves while commits are open; nobody finalizes
        vm.expectRevert(ForecastLedger.TooEarly.selector);
        ledger.sealRound(id);
        _toReveal(id);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.RoundSealed(id, 2);
        ledger.sealRound(id);
        ledger.sealRound(id); // idempotent
        assertEq(uint8(ledger.getOutcome(id, 1)), uint8(ForecastLedger.Outcome.Void));
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Unresolved));
        _resolve(qs[0], true);
        ledger.finalizeQuestion(id, 0);
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Yes));
    }

    function test_earlyResolution_finalizeOnUnsealedRoundSeals() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        _resolve(qs[0], true);
        _toReveal(id);
        ledger.finalizeQuestion(id, 0); // seals: q0 was already resolved, so Void
        assertTrue(ledger.getRound(id).isSealed);
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Void));
    }

    function test_earlyResolution_firstRevealSeals() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        _commit(id, alice, 5000 | (5000 << 16), SALT);
        _resolve(qs[1], true);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 5000 | (5000 << 16), SALT);
        assertEq(uint8(ledger.getOutcome(id, 1)), uint8(ForecastLedger.Outcome.Void));
    }

    function test_voidStale() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        uint256 limit = uint256(ledger.getRound(id).revealDeadline) + ledger.getRound(id).resolutionWait;
        vm.warp(limit);
        vm.expectRevert(ForecastLedger.TooEarly.selector);
        ledger.voidStale(id, 0);
        vm.warp(limit + 1);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.QuestionFinalized(id, 0, ForecastLedger.Outcome.Void, false, true);
        ledger.voidStale(id, 0);
        vm.expectRevert(ForecastLedger.QuestionAlreadyFinal.selector);
        ledger.voidStale(id, 0);
        _resolve(qs[1], true);
        vm.expectRevert(abi.encodeWithSelector(ForecastLedger.AlreadyResolved.selector, 1));
        ledger.voidStale(id, 1);
        vm.expectRevert(ForecastLedger.BadIndex.selector);
        ledger.voidStale(id, 2);
    }

    // Scoring

    function _round2(bool withBaseline) internal returns (uint256 id, uint256 pa, uint256 pb, uint256 base) {
        ForecastLedger.QuestionInput[] memory qs;
        (id, qs) = _createRound(3);
        pa = 8000 | (3000 << 16) | (9000 << 32);
        pb = 2000 | (6000 << 16) | (100 << 32);
        base = 6000 | (5000 << 16) | (5000 << 32);
        _commit(id, alice, pa, SALT);
        _commit(id, bob, pb, SALT);
        _commit(id, carol, pa, keccak256("carol")); // never reveals
        if (withBaseline) _setBaseline(id, base);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, pa, SALT);
        vm.prank(bob);
        ledger.reveal(id, pb, SALT);
        // q0 Yes, q1 No, q2 split (Void)
        ledger.sealRound(id);
        _resolve(qs[0], true);
        ledger.finalizeQuestion(id, 0);
        _resolve(qs[1], false);
        ledger.finalizeQuestion(id, 1);
        _resolveSplit(qs[2]);
        ledger.finalizeQuestion(id, 2);
    }

    function test_score_withBaseline() public {
        (uint256 id,,,) = _round2(true);
        vm.expectRevert(ForecastLedger.TooEarly.selector);
        ledger.score(id, alice);
        _toScoring(id);
        uint256 own = _brier(8000, true) + _brier(3000, false);
        uint256 base = _brier(6000, true) + _brier(5000, false);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.Scored(id, alice, 2, own, base, int256(base) - int256(own), true);
        ledger.score(id, alice);
        ForecastLedger.Stats memory s = ledger.getStats(alice);
        assertEq(s.questionsScored, 2);
        assertEq(s.sumBrier, own);
        assertEq(s.sumBaselineBrier, base);
        assertEq(s.sumSkill, int64(int256(base) - int256(own)));
        assertEq(s.baselineQuestions, 2);
        vm.expectRevert(ForecastLedger.AlreadyProcessed.selector);
        ledger.score(id, alice);

        uint256 ownB = _brier(2000, true) + _brier(6000, false);
        ledger.score(id, bob);
        assertEq(ledger.getStats(bob).sumSkill, int64(int256(base) - int256(ownB)));
        assertLt(ledger.getStats(bob).sumSkill, 0);
        (, uint8 f) = ledger.getReveal(id, bob);
        assertEq(f, 3);
    }

    function test_score_withoutBaseline() public {
        (uint256 id,,,) = _round2(false);
        _toScoring(id);
        uint256 own = _brier(8000, true) + _brier(3000, false);
        vm.expectEmit(address(ledger));
        emit ForecastLedger.Scored(id, alice, 2, own, 0, 0, false);
        ledger.score(id, alice);
        assertEq(ledger.getStats(alice).sumBaselineBrier, 0);
        assertEq(ledger.getStats(alice).sumSkill, 0);
        assertEq(ledger.getStats(alice).baselineQuestions, 0);
    }

    function test_score_reverts() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(2);
        _commit(id, alice, 5000, SALT);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 5000, SALT);
        _resolve(qs[0], true);
        ledger.finalizeQuestion(id, 0);
        _toScoring(id);
        vm.expectRevert(ForecastLedger.RoundNotResolved.selector);
        ledger.score(id, alice);
        vm.expectRevert(ForecastLedger.RoundNotResolved.selector);
        ledger.forfeit(id, alice);
        _resolve(qs[1], true);
        ledger.finalizeQuestion(id, 1);
        vm.expectRevert(ForecastLedger.NotRevealed.selector);
        ledger.score(id, bob);
        vm.expectRevert(ForecastLedger.UnknownRound.selector);
        ledger.score(7, alice);
    }

    function test_forfeit() public {
        (uint256 id,,,) = _round2(true);
        _toScoring(id);
        uint256 base = _brier(6000, true) + _brier(5000, false);
        uint256 worst = 2 * 1e8;
        vm.expectEmit(address(ledger));
        emit ForecastLedger.Forfeited(id, carol, 2, worst, base, int256(base) - int256(worst), true);
        ledger.forfeit(id, carol);
        ForecastLedger.Stats memory s = ledger.getStats(carol);
        assertEq(s.roundsForfeited, 1);
        assertEq(s.questionsScored, 2);
        assertEq(s.sumBrier, worst);
        vm.expectRevert(ForecastLedger.AlreadyProcessed.selector);
        ledger.forfeit(id, carol);
        vm.expectRevert(ForecastLedger.AlreadyRevealed.selector);
        ledger.forfeit(id, alice);
        vm.expectRevert(ForecastLedger.NoCommit.selector);
        ledger.forfeit(id, nobody);
        (, uint8 f) = ledger.getReveal(id, carol);
        assertEq(f, 4);
    }

    function test_forfeit_tooEarly() public {
        (uint256 id,,,) = _round2(true);
        vm.expectRevert(ForecastLedger.TooEarly.selector);
        ledger.forfeit(id, carol);
    }

    function test_allVoidRound() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(1);
        _commit(id, alice, 9000, SALT);
        _commit(id, bob, 9000, keccak256("b"));
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, 9000, SALT);
        _resolveSplit(qs[0]);
        ledger.finalizeQuestion(id, 0);
        _toScoring(id);
        ledger.score(id, alice);
        ledger.forfeit(id, bob);
        assertEq(ledger.getStats(alice).questionsScored, 0);
        assertEq(ledger.getStats(bob).sumBrier, 0);
    }

    function test_batches() public {
        (uint256 id,,,) = _round2(true);
        address[] memory all = new address[](4);
        all[0] = alice;
        all[1] = bob;
        all[2] = carol;
        all[3] = nobody;
        vm.expectRevert(ForecastLedger.TooEarly.selector);
        ledger.scoreBatch(id, all);
        _toScoring(id);
        ledger.score(id, alice);
        assertEq(ledger.scoreBatch(id, all), 1); // only bob left
        assertEq(ledger.scoreBatch(id, all), 0);
        assertEq(ledger.forfeitBatch(id, all), 1); // only carol
        assertEq(ledger.forfeitBatch(id, all), 0);

        address[] memory big = new address[](101);
        vm.expectRevert(ForecastLedger.BatchTooLarge.selector);
        ledger.scoreBatch(id, big);
        vm.expectRevert(ForecastLedger.BatchTooLarge.selector);
        ledger.forfeitBatch(id, big);
    }

    function test_forfeitBatch_tooEarly() public {
        (uint256 id,,,) = _round2(true);
        vm.expectRevert(ForecastLedger.TooEarly.selector);
        ledger.forfeitBatch(id, new address[](0));
    }

    // Pause never traps users

    function test_pause_neverBlocksRevealFinalizeScore() public {
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(1);
        _commit(id, alice, 7000, SALT);
        _commit(id, bob, 7000, keccak256("b"));
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, alice, ledger.PAUSER_ROLE()
            )
        );
        vm.prank(alice);
        ledger.pause();
        vm.prank(admin);
        ledger.pause();
        assertTrue(ledger.paused());
        _toReveal(id);
        ledger.sealRound(id);
        vm.prank(alice);
        ledger.reveal(id, 7000, SALT);
        _resolve(qs[0], true);
        ledger.finalizeQuestion(id, 0);
        _toScoring(id);
        ledger.score(id, alice);
        ledger.forfeit(id, bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, alice, ledger.PAUSER_ROLE()
            )
        );
        vm.prank(alice);
        ledger.unpause();
    }

    // Admin

    function test_adminTransfer_movesPauserRole() public {
        address next = makeAddr("multisig");
        vm.prank(admin);
        ledger.beginDefaultAdminTransfer(next);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(next);
        ledger.acceptDefaultAdminTransfer();
        assertTrue(ledger.hasRole(ledger.PAUSER_ROLE(), next));
        assertFalse(ledger.hasRole(ledger.PAUSER_ROLE(), admin));
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, admin, ledger.PAUSER_ROLE()
            )
        );
        vm.prank(admin);
        ledger.pause(); // the old admin key can no longer pause
        vm.prank(next);
        ledger.pause();
        assertTrue(ledger.paused());
    }

    function test_adminTransfer_leavesOtherPausersAlone() public {
        address next = makeAddr("multisig");
        vm.startPrank(admin);
        ledger.grantRole(ledger.PAUSER_ROLE(), keeper);
        ledger.revokeRole(ledger.PAUSER_ROLE(), admin); // admin gave the pause role away before the transfer
        ledger.beginDefaultAdminTransfer(next);
        vm.stopPrank();
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(next);
        ledger.acceptDefaultAdminTransfer();
        assertTrue(ledger.hasRole(ledger.PAUSER_ROLE(), keeper));
        assertFalse(ledger.hasRole(ledger.PAUSER_ROLE(), next));
    }

    function test_adminTwoStepTransfer() public {
        address next = makeAddr("multisig");
        vm.prank(admin);
        ledger.beginDefaultAdminTransfer(next);
        vm.prank(next);
        vm.expectRevert();
        ledger.acceptDefaultAdminTransfer();
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(next);
        ledger.acceptDefaultAdminTransfer();
        assertEq(ledger.defaultAdmin(), next);
    }

    // Views

    function test_views_unknownRound() public {
        vm.expectRevert(ForecastLedger.UnknownRound.selector);
        ledger.getRound(1);
        vm.expectRevert(ForecastLedger.UnknownRound.selector);
        ledger.getQuestions(1);
        vm.expectRevert(ForecastLedger.UnknownRound.selector);
        ledger.sealRound(1);
        vm.expectRevert(ForecastLedger.UnknownRound.selector);
        ledger.voidStale(1, 0);
        vm.expectRevert(ForecastLedger.UnknownRound.selector);
        ledger.forfeit(1, alice);
    }
}
