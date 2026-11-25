// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Test} from "forge-std/Test.sol";
import {OpenForecasts} from "../src/OpenForecasts.sol";
import {MockAgentID} from "../src/mocks/MockAgentID.sol";
import {MockConditionalTokens} from "../src/mocks/MockConditionalTokens.sol";

contract OpenForecastsTest is Test {
    OpenForecasts of_;
    MockAgentID aid;
    MockConditionalTokens ctf;
    address admin = address(0xA11CE);
    address keeper = address(0xBEEF);
    address alice = address(0xA1);
    address bob = address(0xB0);
    address nobody = address(0xC0);
    bytes32 cid = keccak256("btc 15m up");
    bytes32 salt = keccak256("salt");
    bytes32 key;

    function setUp() public {
        aid = new MockAgentID();
        ctf = new MockConditionalTokens();
        address[] memory list = new address[](1);
        list[0] = address(ctf);
        of_ = new OpenForecasts(address(aid), list, admin, keeper);
        vm.prank(alice);
        aid.mint("alice");
        vm.prank(bob);
        aid.mint("bob");
        ctf.prepare(cid, 2);
        key = of_.marketKey(address(ctf), cid);
        vm.warp(1_800_000_000);
    }

    function _commit(address who, uint8 slot, uint16 bps) internal {
        bytes32 h = of_.computeCommitHash(address(ctf), cid, slot, who, bps, salt);
        vm.prank(who);
        of_.commit(address(ctf), cid, slot, 42, h, 0, hex"46574152");
    }

    function _resolve(uint256 p0, uint256 p1) internal {
        uint256[] memory p = new uint256[](2);
        p[0] = p0;
        p[1] = p1;
        ctf.resolve(cid, p);
        vm.warp(block.timestamp + 121); // past the void window, so scoring is allowed
        of_.finalize(address(ctf), cid);
    }

    function test_fullPath_commit_baseline_resolve_reveal_score() public {
        _commit(alice, 0, 8000);
        vm.prank(keeper);
        of_.setBaseline(key, alice, 6000);
        vm.warp(block.timestamp + 15 minutes);
        _resolve(1, 0); // slot 0 wins
        of_.revealFor(key, alice, 8000, salt, address(ctf), cid); // anyone, e.g. the keeper from the sealed copy
        of_.score(key, alice);
        OpenForecasts.Stats memory s = of_.getStats(alice);
        assertEq(s.scored, 1);
        assertEq(s.sumBrier, 2000 * 2000);
        assertEq(s.sumBaselineBrier, 4000 * 4000);
        assertEq(s.sumSkill, int64(int256(4000 * 4000 - 2000 * 2000)));
        assertEq(s.baselineCount, 1);
    }

    function test_reveal_binds_the_sender() public {
        _commit(bob, 1, 3000);
        _resolve(1, 0);
        vm.expectRevert(OpenForecasts.NoCommit.selector);
        of_.reveal(key, 3000, salt, address(ctf), cid);
        vm.prank(bob);
        of_.reveal(key, 3000, salt, address(ctf), cid);
        of_.score(key, bob);
        assertEq(of_.getStats(bob).sumBrier, 3000 * 3000);
    }

    function test_no_reveal_before_resolution_and_wrong_salt_fails() public {
        _commit(alice, 0, 8000);
        vm.expectRevert(OpenForecasts.NotFinalized.selector);
        of_.revealFor(key, alice, 8000, salt, address(ctf), cid);
        _resolve(1, 0);
        vm.expectRevert(OpenForecasts.HashMismatch.selector);
        of_.revealFor(key, alice, 7999, salt, address(ctf), cid);
    }

    function test_one_commit_per_wallet_per_market() public {
        _commit(alice, 0, 8000);
        bytes32 h = of_.computeCommitHash(address(ctf), cid, 1, alice, 5000, salt);
        vm.prank(alice);
        vm.expectRevert(OpenForecasts.AlreadyCommitted.selector);
        of_.commit(address(ctf), cid, 1, 42, h, 0, "");
    }

    function test_commit_gates() public {
        bytes32 h = keccak256("h");
        vm.prank(nobody);
        vm.expectRevert(OpenForecasts.NoAgentID.selector);
        of_.commit(address(ctf), cid, 0, 42, h, 0, "");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OpenForecasts.CtfNotAllowed.selector, address(0xDEAD)));
        of_.commit(address(0xDEAD), cid, 0, 42, h, 0, "");
        vm.prank(alice);
        vm.expectRevert(OpenForecasts.BadSlot.selector);
        of_.commit(address(ctf), cid, 2, 42, h, 0, "");
        bytes32 three = keccak256("three way");
        ctf.prepare(three, 3);
        vm.prank(alice);
        vm.expectRevert(OpenForecasts.NotBinary.selector);
        of_.commit(address(ctf), three, 0, 42, h, 0, "");
        vm.prank(alice);
        vm.expectRevert(OpenForecasts.SealedTooLarge.selector);
        of_.commit(address(ctf), cid, 0, 42, h, 0, new bytes(2113));
        uint256[] memory p = new uint256[](2);
        p[0] = 1;
        ctf.resolve(cid, p);
        vm.prank(alice);
        vm.expectRevert(OpenForecasts.AlreadyResolved.selector); // a resolved market takes no new forecast
        of_.commit(address(ctf), cid, 0, 42, h, 0, "");
    }

    function test_baseline_only_by_keeper_once_and_within_120s() public {
        _commit(alice, 0, 8000);
        vm.prank(alice);
        vm.expectRevert();
        of_.setBaseline(key, alice, 6000);
        vm.warp(block.timestamp + 121);
        vm.prank(keeper);
        vm.expectRevert(OpenForecasts.TooLate.selector);
        of_.setBaseline(key, alice, 6000);
    }

    function test_no_baseline_means_accuracy_only() public {
        _commit(alice, 0, 8000);
        _resolve(1, 0);
        of_.revealFor(key, alice, 8000, salt, address(ctf), cid);
        of_.score(key, alice);
        OpenForecasts.Stats memory s = of_.getStats(alice);
        assertEq(s.baselineCount, 0);
        assertEq(s.sumSkill, 0);
        assertEq(s.sumBrier, 2000 * 2000);
    }

    function test_void_only_within_10_minutes_and_never_scored() public {
        _commit(alice, 0, 8000);
        vm.prank(keeper);
        of_.voidForecast(key, alice, 1);
        _resolve(1, 0);
        vm.expectRevert(OpenForecasts.AlreadyDone.selector);
        of_.score(key, alice);
        _commitOther();
        bytes32 k2 = of_.marketKey(address(ctf), keccak256("other"));
        vm.warp(block.timestamp + 10 minutes + 1);
        vm.prank(keeper);
        vm.expectRevert(OpenForecasts.TooLate.selector);
        of_.voidForecast(k2, bob, 1);
    }

    function _commitOther() internal {
        bytes32 c2 = keccak256("other");
        ctf.prepare(c2, 2);
        bytes32 h = of_.computeCommitHash(address(ctf), c2, 0, bob, 5000, salt);
        vm.prank(bob);
        of_.commit(address(ctf), c2, 0, 42, h, 0, "");
    }

    function test_unrevealed_is_a_forfeit_after_the_window() public {
        _commit(alice, 0, 8000);
        _resolve(0, 1);
        vm.expectRevert(OpenForecasts.TooEarly.selector);
        of_.score(key, alice);
        vm.warp(block.timestamp + 3 days + 1);
        vm.expectRevert(OpenForecasts.RevealClosed.selector);
        of_.revealFor(key, alice, 8000, salt, address(ctf), cid);
        of_.score(key, alice);
        OpenForecasts.Stats memory s = of_.getStats(alice);
        assertEq(s.forfeited, 1);
        assertEq(s.sumBrier, 1e8);
    }

    function test_split_payout_is_void_for_everyone() public {
        _commit(alice, 0, 8000);
        _resolve(1, 1);
        of_.revealFor(key, alice, 8000, salt, address(ctf), cid);
        of_.score(key, alice);
        assertEq(of_.getStats(alice).scored, 0);
    }

    function test_finalize_needs_an_onchain_payout_and_runs_once() public {
        vm.expectRevert(OpenForecasts.NotResolvedOnchain.selector);
        of_.finalize(address(ctf), cid);
        _resolve(1, 0);
        vm.expectRevert(OpenForecasts.AlreadyFinalized.selector);
        of_.finalize(address(ctf), cid);
    }

    function test_pause_stops_commits_only() public {
        _commit(alice, 0, 8000);
        vm.prank(admin);
        of_.pause();
        bytes32 h = keccak256("h");
        vm.prank(bob);
        vm.expectRevert();
        of_.commit(address(ctf), cid, 0, 42, h, 0, "");
        _resolve(1, 0);
        of_.revealFor(key, alice, 8000, salt, address(ctf), cid); // reveals and scoring never pause
        of_.score(key, alice);
    }

    function test_void_and_baseline_never_after_reveal_or_finalize() public {
        _commit(alice, 0, 8000);
        _resolve(1, 0);
        vm.prank(keeper);
        vm.expectRevert(); // past the window and finalized
        of_.voidForecast(key, alice, 1);
    }

    function test_reveal_window_starts_at_the_sealed_time_when_the_market_resolves_early() public {
        bytes32 h = of_.computeCommitHash(address(ctf), cid, 0, alice, 8000, salt);
        vm.prank(alice);
        of_.commit(address(ctf), cid, 0, 42, h, uint64(block.timestamp + 30 days), hex"46574152");
        _resolve(1, 0); // resolves on day 0
        vm.warp(block.timestamp + 10 days);
        vm.expectRevert(OpenForecasts.TooEarly.selector); // no forfeit: the sealed copy is not open yet
        of_.score(key, alice);
        vm.warp(block.timestamp + 21 days); // day 31: sealed copy open, inside its 3 day window
        of_.revealFor(key, alice, 8000, salt, address(ctf), cid);
        of_.score(key, alice);
        assertEq(of_.getStats(alice).forfeited, 0);
    }

    function test_no_reveal_delay_without_a_sealed_copy() public {
        bytes32 h = of_.computeCommitHash(address(ctf), cid, 0, alice, 8000, salt);
        vm.prank(alice);
        vm.expectRevert(OpenForecasts.BadRevealStart.selector);
        of_.commit(address(ctf), cid, 0, 42, h, uint64(block.timestamp + 30 days), "");
    }

    function test_reveal_rejects_probabilities_outside_1_to_99_percent() public {
        bytes32 h = of_.computeCommitHash(address(ctf), cid, 0, alice, 10_000, salt);
        vm.prank(alice);
        of_.commit(address(ctf), cid, 0, 42, h, 0, "");
        _resolve(1, 0);
        vm.expectRevert(OpenForecasts.BadBps.selector);
        of_.revealFor(key, alice, 10_000, salt, address(ctf), cid);
    }

    function testFuzz_brier_and_skill(uint16 bps, uint16 base, bool yes) public {
        bps = uint16(bound(bps, 100, 9900));
        base = uint16(bound(base, 0, 10_000));
        _commit(alice, 0, bps);
        vm.prank(keeper);
        of_.setBaseline(key, alice, base);
        _resolve(yes ? 1 : 0, yes ? 0 : 1);
        of_.revealFor(key, alice, bps, salt, address(ctf), cid);
        of_.score(key, alice);
        uint256 o = yes ? 10_000 : 0;
        uint256 b = bps > o ? bps - o : o - bps;
        uint256 m = base > o ? base - o : o - base;
        OpenForecasts.Stats memory s = of_.getStats(alice);
        assertEq(s.sumBrier, b * b);
        assertEq(int256(s.sumSkill), int256(m * m) - int256(b * b));
    }
}
