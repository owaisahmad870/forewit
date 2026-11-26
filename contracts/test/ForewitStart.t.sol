// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Test} from "forge-std/Test.sol";
import {ForewitStart} from "../src/ForewitStart.sol";
import {MockAgentID} from "../src/mocks/MockAgentID.sol";

contract ForewitStartTest is Test {
    ForewitStart s;
    MockAgentID aid;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol"); // no Agent ID

    event Started(address indexed player, uint256 indexed number, uint64 at);

    function setUp() public {
        aid = new MockAgentID();
        s = new ForewitStart(address(aid));
        vm.prank(alice);
        aid.mint("alice");
        vm.prank(bob);
        aid.mint("bob");
    }

    function test_start_records_number_time_and_event() public {
        vm.warp(1_800_000_000);
        vm.expectEmit(true, true, false, true);
        emit Started(alice, 1, 1_800_000_000);
        vm.prank(alice);
        assertEq(s.start(), 1);
        assertEq(s.startedAt(alice), 1_800_000_000);
        assertEq(s.playerNumber(alice), 1);
        assertEq(s.starts(), 1);
    }

    function test_mint_is_the_same_call_and_numbers_increase() public {
        vm.prank(alice);
        s.mint();
        vm.prank(bob);
        assertEq(s.start(), 2);
        assertEq(s.starts(), 2);
    }

    function test_once_per_wallet_through_either_name() public {
        vm.startPrank(alice);
        s.start();
        vm.expectRevert(ForewitStart.AlreadyStarted.selector);
        s.mint();
        vm.expectRevert(ForewitStart.AlreadyStarted.selector);
        s.start();
        vm.stopPrank();
        assertEq(s.starts(), 1);
    }

    function test_needs_agent_id() public {
        vm.prank(carol);
        vm.expectRevert(ForewitStart.NoAgentID.selector);
        s.start();
        vm.prank(carol);
        vm.expectRevert(ForewitStart.NoAgentID.selector);
        s.mint();
        assertEq(s.starts(), 0);
    }

    function test_rejects_value() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(s).call{value: 1}(abi.encodeWithSignature("start()"));
        assertFalse(ok);
        vm.prank(alice);
        (ok,) = address(s).call{value: 1}("");
        assertFalse(ok, "no receive or fallback");
        assertEq(address(s).balance, 0);
    }

    function test_constructor_rejects_bad_agent_id() public {
        vm.expectRevert(ForewitStart.ZeroAddress.selector);
        new ForewitStart(address(0));
        vm.expectRevert(ForewitStart.ZeroAddress.selector);
        new ForewitStart(makeAddr("eoa"));
    }

    function test_selectors_are_the_ones_agents_call() public pure {
        assertEq(ForewitStart.start.selector, bytes4(0xbe9a6555));
        assertEq(ForewitStart.mint.selector, bytes4(0x1249c58b));
    }

    function testFuzz_numbers_unique(uint8 n) public {
        n = uint8(bound(n, 1, 40));
        for (uint256 i = 1; i <= n; i++) {
            address w = address(uint160(0x1000 + i));
            vm.prank(w);
            aid.mint(string(abi.encodePacked("w", vm.toString(i))));
            vm.prank(w);
            assertEq(s.start(), s.starts());
            assertEq(s.playerNumber(w), i);
        }
    }
}
