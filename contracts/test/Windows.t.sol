// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "./Base.t.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";
import {DeployMainnet} from "../script/DeployMainnet.s.sol";

/// @dev Immutable minimum windows: the chain 56 guard (contract and deploy script) and fast test network windows.
contract WindowsTest is Base {
    function _deploy(uint256 c, uint256 r) internal returns (ForecastLedger) {
        address[] memory l = new address[](2);
        l[0] = address(ctfA);
        l[1] = address(ctfB);
        return new ForecastLedger(address(aid), l, admin, keeper, c, r);
    }

    function test_windows_storedImmutable() public {
        ForecastLedger f = _deploy(2 minutes, 5 minutes);
        assertEq(f.MIN_COMMIT_WINDOW(), 2 minutes);
        assertEq(f.MIN_REVEAL_WINDOW(), 5 minutes);
        assertEq(ledger.MIN_COMMIT_WINDOW(), 2 hours);
        assertEq(ledger.MIN_REVEAL_WINDOW(), 12 hours);
    }

    function test_windows_zeroOrTooLargeRevert() public {
        vm.expectRevert(ForecastLedger.BadWindows.selector);
        _deploy(0, 5 minutes);
        vm.expectRevert(ForecastLedger.BadWindows.selector);
        _deploy(2 minutes, 0);
        vm.expectRevert(ForecastLedger.BadWindows.selector);
        _deploy(7 days + 1, 12 hours);
        vm.expectRevert(ForecastLedger.BadWindows.selector);
        _deploy(2 hours, 7 days + 1);
    }

    function test_mainnetGuard_contract() public {
        vm.chainId(56);
        vm.expectRevert(ForecastLedger.BadWindows.selector);
        _deploy(2 hours - 1, 12 hours);
        vm.expectRevert(ForecastLedger.BadWindows.selector);
        _deploy(2 hours, 12 hours - 1);
        vm.expectRevert(ForecastLedger.BadWindows.selector);
        _deploy(2 minutes, 5 minutes);
        ForecastLedger ok = _deploy(2 hours, 12 hours);
        assertEq(ok.MIN_REVEAL_WINDOW(), 12 hours);
    }

    function test_mainnetGuard_roles() public {
        DeployMainnet s = new DeployMainnet();
        (address d, address a, address m) = (address(1), address(2), address(3));
        s.validateRoles(d, a, m);
        vm.expectRevert(bytes("deployer must hold no role"));
        s.validateRoles(d, d, m);
        vm.expectRevert(bytes("deployer must hold no role"));
        s.validateRoles(d, a, d);
        vm.expectRevert(bytes("admin must differ from round manager"));
        s.validateRoles(d, a, a);
        vm.expectRevert(bytes("zero role address"));
        s.validateRoles(d, address(0), m);
    }

    function test_mainnetGuard_script() public {
        DeployMainnet s = new DeployMainnet();
        s.validate(56, 2 hours, 12 hours);
        vm.expectRevert(bytes("mainnet script: chain 56 only"));
        s.validate(97, 2 hours, 12 hours);
        vm.expectRevert(bytes("commit window below 2 hours"));
        s.validate(56, 2 hours - 1, 12 hours);
        vm.expectRevert(bytes("reveal window below 12 hours"));
        s.validate(56, 2 hours, 5 minutes);
        // run() applies the guard to the env windows before touching any key
        vm.chainId(56);
        vm.setEnv("COMMIT_WINDOW", "120");
        vm.setEnv("REVEAL_WINDOW", "300");
        vm.expectRevert(bytes("commit window below 2 hours"));
        s.run();
    }

    function test_fastWindows_fullRound() public {
        ForecastLedger f = _deploy(2 minutes, 5 minutes);
        ForecastLedger.QuestionInput[] memory qs = _inputs(2);
        uint64 cd = uint64(block.timestamp + 2 minutes);
        vm.startPrank(keeper);
        vm.expectRevert(ForecastLedger.BadDeadlines.selector);
        f.createRound(qs, cd - 1, cd + 5 minutes, 7 days);
        vm.expectRevert(ForecastLedger.BadDeadlines.selector);
        f.createRound(qs, cd, cd + 5 minutes - 1, 7 days);
        uint256 id = f.createRound(qs, cd, cd + 5 minutes, 7 days);
        vm.stopPrank();
        uint256 p = 7000 | (4000 << 16);
        bytes32 h = f.computeCommitHash(id, alice, p, bytes32("s"));
        vm.prank(alice);
        f.commit(id, h);
        vm.warp(cd);
        vm.prank(alice);
        f.reveal(id, p, bytes32("s"));
        _resolve(qs[0], true);
        _resolve(qs[1], false);
        f.finalizeQuestion(id, 0);
        f.finalizeQuestion(id, 1);
        vm.warp(uint256(cd) + 5 minutes + 1);
        f.score(id, alice);
        assertEq(f.getStats(alice).sumBrier, 3000 * 3000 + 4000 * 4000);
    }
}
