// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Test} from "forge-std/Test.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";
import {ForewitScores} from "../src/ForewitScores.sol";

/// @dev Rehearses moving DEFAULT_ADMIN from the live admin key to a multisig on the LIVE mainnet contracts (fork at the
/// latest block). Runs only when BSC_RPC_URL is set. SAFE is a placeholder: any address that can call accept works the same.
contract AdminHandoverForkTest is Test {
    ForecastLedger constant LEDGER = ForecastLedger(0xd11e67ff70ACD42E01d79130f280162b00Bb09B6);
    ForewitScores constant SCORES = ForewitScores(0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc);
    address constant ADMIN = 0xF3b4728B30F0F380d77dE9d025E33680F66591bD;
    address constant KEEPER = 0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18;
    address safe = makeAddr("safe");

    function setUp() public {
        string memory url = vm.envOr("BSC_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(url);
    }

    function test_liveStateBeforeHandover() public view {
        assertEq(LEDGER.defaultAdmin(), ADMIN);
        assertEq(SCORES.defaultAdmin(), ADMIN);
        assertEq(LEDGER.defaultAdminDelay(), 1 days);
        assertEq(SCORES.defaultAdminDelay(), 1 days);
        assertTrue(LEDGER.hasRole(LEDGER.PAUSER_ROLE(), ADMIN));
        assertTrue(LEDGER.hasRole(LEDGER.ROUND_MANAGER_ROLE(), KEEPER));
        assertTrue(SCORES.hasRole(SCORES.ROUND_MANAGER_ROLE(), KEEPER));
        (address pending,) = LEDGER.pendingDefaultAdmin();
        assertEq(pending, address(0));
    }

    function test_handoverToSafeOnBothContracts() public {
        vm.startPrank(ADMIN);
        LEDGER.beginDefaultAdminTransfer(safe);
        SCORES.beginDefaultAdminTransfer(safe);
        vm.stopPrank();

        // too early: the 1 day delay holds
        vm.prank(safe);
        vm.expectRevert();
        LEDGER.acceptDefaultAdminTransfer();

        vm.warp(block.timestamp + 1 days + 1);
        vm.startPrank(safe);
        LEDGER.acceptDefaultAdminTransfer();
        SCORES.acceptDefaultAdminTransfer();
        vm.stopPrank();

        assertEq(LEDGER.defaultAdmin(), safe);
        assertEq(SCORES.defaultAdmin(), safe);
        // the pauser seat moved with the admin seat; the old key holds nothing
        assertTrue(LEDGER.hasRole(LEDGER.PAUSER_ROLE(), safe));
        assertFalse(LEDGER.hasRole(LEDGER.PAUSER_ROLE(), ADMIN));
        assertFalse(LEDGER.hasRole(LEDGER.DEFAULT_ADMIN_ROLE(), ADMIN));
        assertFalse(SCORES.hasRole(SCORES.DEFAULT_ADMIN_ROLE(), ADMIN));
        // the keeper keeps running rounds
        assertTrue(LEDGER.hasRole(LEDGER.ROUND_MANAGER_ROLE(), KEEPER));
        assertTrue(SCORES.hasRole(SCORES.ROUND_MANAGER_ROLE(), KEEPER));

        // the Safe can replace a leaked keeper (the incident runbook path) and pause
        address fresh = makeAddr("freshKeeper");
        bytes32 rm = LEDGER.ROUND_MANAGER_ROLE();
        vm.startPrank(safe);
        LEDGER.revokeRole(rm, KEEPER);
        LEDGER.grantRole(rm, fresh);
        SCORES.revokeRole(SCORES.ROUND_MANAGER_ROLE(), KEEPER);
        SCORES.grantRole(SCORES.ROUND_MANAGER_ROLE(), fresh);
        LEDGER.pause();
        vm.stopPrank();
        assertTrue(LEDGER.paused());
        assertFalse(LEDGER.hasRole(rm, KEEPER));
        assertTrue(SCORES.hasRole(SCORES.ROUND_MANAGER_ROLE(), fresh));

        // the old admin key can no longer act
        vm.prank(ADMIN);
        vm.expectRevert();
        LEDGER.grantRole(rm, ADMIN);
    }

    function test_handoverCanBeCancelled() public {
        vm.startPrank(ADMIN);
        LEDGER.beginDefaultAdminTransfer(safe);
        LEDGER.cancelDefaultAdminTransfer();
        vm.stopPrank();
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(safe);
        vm.expectRevert();
        LEDGER.acceptDefaultAdminTransfer();
        assertEq(LEDGER.defaultAdmin(), ADMIN);
    }
}
