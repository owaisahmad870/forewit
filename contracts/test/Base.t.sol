// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Test} from "forge-std/Test.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";
import {MockAgentID} from "../src/mocks/MockAgentID.sol";
import {MockConditionalTokens} from "../src/mocks/MockConditionalTokens.sol";

/// @dev Shared setup: one ledger over two mock CTFs, a mock Agent ID, and helpers for whole rounds.
abstract contract Base is Test {
    ForecastLedger internal ledger;
    MockAgentID internal aid;
    MockConditionalTokens internal ctfA;
    MockConditionalTokens internal ctfB;

    address internal admin = makeAddr("admin");
    address internal keeper = makeAddr("keeper");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal nobody = makeAddr("nobody");

    uint64 internal constant COMMIT_WINDOW = 20 hours;
    uint64 internal constant REVEAL_WINDOW = 24 hours;
    uint256 internal condNonce;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        aid = new MockAgentID();
        ctfA = new MockConditionalTokens();
        ctfB = new MockConditionalTokens();
        address[] memory list = new address[](2);
        list[0] = address(ctfA);
        list[1] = address(ctfB);
        ledger = new ForecastLedger(address(aid), list, admin, keeper, 2 hours, 12 hours);
        aid.mintTo(alice, "alice");
        aid.mintTo(bob, "bob");
        aid.mintTo(carol, "carol");
    }

    // Helpers

    function _newCondition(MockConditionalTokens ctf) internal returns (bytes32 c) {
        c = keccak256(abi.encode("cond", ++condNonce));
        ctf.prepare(c, 2);
    }

    function _inputs(uint256 n) internal returns (ForecastLedger.QuestionInput[] memory qs) {
        qs = new ForecastLedger.QuestionInput[](n);
        for (uint256 i; i < n; ++i) {
            MockConditionalTokens c = i % 2 == 0 ? ctfA : ctfB;
            qs[i] = ForecastLedger.QuestionInput({
                conditionId: _newCondition(c), ctf: address(c), yesSlot: uint8(i % 2), marketId: 1000 + i
            });
        }
    }

    function _createRound(uint256 n) internal returns (uint256 roundId, ForecastLedger.QuestionInput[] memory qs) {
        qs = _inputs(n);
        vm.prank(keeper);
        roundId = ledger.createRound(
            qs, uint64(block.timestamp) + COMMIT_WINDOW, uint64(block.timestamp) + COMMIT_WINDOW + REVEAL_WINDOW, 7 days
        );
    }

    function _pack(uint256[] memory ps) internal pure returns (uint256 packed) {
        for (uint256 i; i < ps.length; ++i) {
            packed |= ps[i] << (16 * i);
        }
    }

    function _commit(uint256 roundId, address who, uint256 packed, bytes32 salt) internal {
        bytes32 h = ledger.computeCommitHash(roundId, who, packed, salt);
        vm.prank(who);
        ledger.commit(roundId, h);
    }

    function _commitBaseline(uint256 roundId, uint256 packed, bytes32 salt) internal {
        bytes32 h = ledger.computeCommitHash(roundId, ledger.BASELINE(), packed, salt);
        vm.prank(keeper);
        ledger.commitBaseline(roundId, h);
    }

    function _toReveal(uint256 roundId) internal {
        vm.warp(ledger.getRound(roundId).commitDeadline);
    }

    function _toScoring(uint256 roundId) internal {
        vm.warp(uint256(ledger.getRound(roundId).revealDeadline) + 1);
    }

    /// @dev Resolve question i: yes=true pays the Yes slot in full.
    function _resolve(ForecastLedger.QuestionInput memory q, bool yes) internal {
        uint256[] memory p = new uint256[](2);
        p[yes ? q.yesSlot : 1 - q.yesSlot] = 1;
        MockConditionalTokens(q.ctf).resolve(q.conditionId, p);
    }

    function _resolveSplit(ForecastLedger.QuestionInput memory q) internal {
        uint256[] memory p = new uint256[](2);
        p[0] = 1;
        p[1] = 1;
        MockConditionalTokens(q.ctf).resolve(q.conditionId, p);
    }

    function _resolveAndFinalize(uint256 roundId, ForecastLedger.QuestionInput[] memory qs, bool[] memory yes)
        internal
    {
        ledger.sealRound(roundId); // idempotent; must precede resolutions or they count as early
        for (uint256 i; i < qs.length; ++i) {
            _resolve(qs[i], yes[i]);
            ledger.finalizeQuestion(roundId, i);
        }
    }

    /// @dev Reference Brier in bps squared.
    function _brier(uint256 p, bool yes) internal pure returns (uint256) {
        uint256 o = yes ? 10_000 : 0;
        uint256 d = p > o ? p - o : o - p;
        return d * d;
    }
}
