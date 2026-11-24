// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Test} from "forge-std/Test.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";
import {IAgentID} from "../src/interfaces/IAgentID.sol";
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";

/// @dev BSC mainnet fork at the latest block (our RPCs keep no archive state). Runs only when BSC_RPC_URL is set.
/// Uses the real Agent ID, real holders and real open Predict.fun conditions. Predict.fun's CTF rejects
/// prepareCondition from outside callers, so resolution is simulated by mocking only the two payout reads.
contract ForecastLedgerForkTest is Test {
    address constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    address constant CTF = 0x22DA1810B194ca018378464a58f6Ac2B10C9d244;
    address constant YB_CTF = 0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F;
    address constant YB_NR_CTF = 0xF64b0b318AAf83BD9071110af24D24445719A07F;
    // Holders minted on 23 Nov 2026 (Transfer logs), labels from tokenURI.
    address constant H1 = 0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5; // ghy123456
    address constant H2 = 0xC570B69Fa6a25e802f69AF0B564Dd577Ad81d772;
    address constant H3 = 0x35c22B3E37449Bae654509d4917B1b54B04176eb;
    bytes32 constant RESOLVED = 0xd3b9db96de881083b81790eeae9f6c453ccd9bb6536912e8f78709f7630c54fc;

    ForecastLedger ledger;
    address keeper = makeAddr("keeper");
    address admin = makeAddr("admin");

    function setUp() public {
        string memory url = vm.envOr("BSC_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(url);
        address[] memory list = new address[](3);
        list[0] = CTF;
        list[1] = YB_CTF;
        list[2] = YB_NR_CTF;
        ledger = new ForecastLedger(AGENT_ID, list, admin, keeper, 2 hours, 12 hours);
    }

    function test_fork_agentIdFacts() public view {
        IAgentID a = IAgentID(AGENT_ID);
        assertEq(a.balanceOf(H1), 1);
        assertEq(a.balanceOf(H2), 1);
        assertEq(a.balanceOf(address(0xdEaD)), 0);
        assertEq(a.ownerOf(uint256(keccak256("ghy123456"))), H1);
    }

    function test_fork_realResolvedCondition() public {
        IConditionalTokens c = IConditionalTokens(CTF);
        assertEq(c.getOutcomeSlotCount(RESOLVED), 2);
        assertEq(c.payoutDenominator(RESOLVED), 1);
        assertEq(c.payoutNumerators(RESOLVED, 0), 0);
        assertEq(c.payoutNumerators(RESOLVED, 1), 1);
        ForecastLedger.QuestionInput[] memory qs = new ForecastLedger.QuestionInput[](1);
        qs[0] = ForecastLedger.QuestionInput(RESOLVED, CTF, 0, 1);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(ForecastLedger.AlreadyResolved.selector, 0));
        ledger.createRound(qs, uint64(block.timestamp + 20 hours), uint64(block.timestamp + 44 hours), 7 days);
    }

    /// @dev First condition in the list that is still open (2 slots, unresolved) at the fork block.
    function _open(address ctf, bytes32[6] memory cands) internal view returns (bytes32) {
        for (uint256 i; i < cands.length; ++i) {
            IConditionalTokens c = IConditionalTokens(ctf);
            if (c.getOutcomeSlotCount(cands[i]) == 2 && c.payoutDenominator(cands[i]) == 0) return cands[i];
        }
        return bytes32(0);
    }

    /// @dev Simulate the oracle report: only the payout reads are mocked, everything else is the live contract.
    function _mockResolve(address ctf, bytes32 cond, uint256 a, uint256 b) internal {
        vm.mockCall(ctf, abi.encodeCall(IConditionalTokens.payoutDenominator, (cond)), abi.encode(a + b));
        vm.mockCall(ctf, abi.encodeCall(IConditionalTokens.payoutNumerators, (cond, 0)), abi.encode(a));
        vm.mockCall(ctf, abi.encodeCall(IConditionalTokens.payoutNumerators, (cond, 1)), abi.encode(b));
    }

    function test_fork_fullRound() public {
        // Open conditions taken from ConditionPreparation logs on 23 Nov 2026 (block about 135270000).
        bytes32[6] memory std = [
            bytes32(0x17ee387775b7d70442c5c8cc1d5790f9ff938356cea54d0f438d5b94aa52f797),
            0xe5b3e23ba93b542e5fd947ec950c6b7c742ccd7e22ff31cdbf04062457718f4e,
            0x7989cde1d531586ee1650fbe4545e8a22833b172b2f086560d35d4da3c191ffe,
            0x8ae26f826b32ed571e041f63d521dc09f2cfb1e4013a4141ee3556db3f604dc9,
            0xd1fe625bc00558a27dcaa3e2012cdf47be69af0828fbf6c92fdfc5555e2b3b92,
            0x40feb871b36ebb7680ce245bd82befbc9a4c31794192a9ff97172ef0bbefa92d
        ];
        bytes32[6] memory yb = [
            bytes32(0xdd426617a2764705411c033903afbaff5339c1bb172d8c640de51f5c02ef50c7),
            0x3b700331d4b21afc0a3533b14aae3765246c2c888a6e19e74720ac834c5a10bc,
            0x52c39a38987b04d118d82003becf9734dcd4c2a4d3ecae298bb38ed667b41676,
            0xe8bd54b20478c0c47436c271935f6fc780f0ed6410df466f1cdea06aa4e1276f,
            0x0685b885eca8f2744d4726be03cd0af5fcc8c1d078e19e406cd72c33acdcf151,
            0x69eba4d9197d8a824adad9ecd4f05338371553ed0e2cd16e6bddb2ca9c762ae4
        ];
        bytes32 c0 = _open(CTF, std);
        bytes32 c1 = _open(YB_CTF, yb);
        if (c0 == bytes32(0) || c1 == bytes32(0)) vm.skip(true); // all candidates resolved since; refresh the list
        bytes32 c2;
        for (uint256 i; i < 6; ++i) {
            if (std[i] != c0 && IConditionalTokens(CTF).payoutDenominator(std[i]) == 0) {
                c2 = std[i];
                break;
            }
        }
        if (c2 == bytes32(0)) vm.skip(true);
        address[3] memory ctfs = [CTF, YB_CTF, CTF];
        bytes32[3] memory conds = [c0, c1, c2];
        ForecastLedger.QuestionInput[] memory qs = new ForecastLedger.QuestionInput[](3);
        for (uint256 i; i < 3; ++i) {
            qs[i] = ForecastLedger.QuestionInput(conds[i], ctfs[i], 0, 100 + i);
        }
        vm.prank(keeper);
        uint256 id =
            ledger.createRound(qs, uint64(block.timestamp + 20 hours), uint64(block.timestamp + 44 hours), 7 days);

        uint256 p1 = 9000 | (2000 << 16) | (5000 << 32);
        uint256 p2 = 4000 | (6000 << 16) | (5000 << 32);
        uint256 base = 7000 | (3000 << 16) | (5000 << 32);
        bytes32 s = keccak256("salt");
        _commitAs(id, H1, p1, s);
        _commitAs(id, H2, p2, s);
        _commitAs(id, H3, p1, s); // will forfeit
        vm.prank(address(0xdEaD));
        vm.expectRevert(ForecastLedger.NoAgentID.selector);
        ledger.commit(id, keccak256("x"));
        vm.warp(block.timestamp + 20 hours - 5 minutes);
        vm.prank(keeper);
        ledger.setBaseline(id, base);

        vm.warp(block.timestamp + 5 minutes);
        vm.prank(H1);
        ledger.reveal(id, p1, s);
        ledger.revealFor(id, H2, p2, s);

        _mockResolve(CTF, c0, 1, 0); // Yes
        _mockResolve(YB_CTF, c1, 0, 1); // No
        _mockResolve(CTF, c2, 1, 1); // split, Void
        for (uint256 i; i < 3; ++i) {
            ledger.finalizeQuestion(id, i);
        }
        assertEq(uint8(ledger.getOutcome(id, 0)), uint8(ForecastLedger.Outcome.Yes));
        assertEq(uint8(ledger.getOutcome(id, 1)), uint8(ForecastLedger.Outcome.No));
        assertEq(uint8(ledger.getOutcome(id, 2)), uint8(ForecastLedger.Outcome.Void));

        vm.warp(block.timestamp + 24 hours + 1);
        address[] memory all = new address[](3);
        (all[0], all[1], all[2]) = (H1, H2, H3);
        assertEq(ledger.scoreBatch(id, all), 2);
        assertEq(ledger.forfeitBatch(id, all), 1);

        uint256 own1 = 1000 * 1000 + 2000 * 2000;
        uint256 b = 3000 * 3000 + 3000 * 3000;
        ForecastLedger.Stats memory st = ledger.getStats(H1);
        assertEq(st.questionsScored, 2);
        assertEq(st.sumBrier, own1);
        assertEq(st.sumSkill, int64(int256(b) - int256(own1)));
        assertEq(ledger.getStats(H3).sumBrier, 2e8);
    }

    function _commitAs(uint256 id, address who, uint256 packed, bytes32 salt) internal {
        bytes32 h = ledger.computeCommitHash(id, who, packed, salt);
        vm.prank(who);
        ledger.commit(id, h);
    }
}
