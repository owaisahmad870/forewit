// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "./Base.t.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";

contract ForecastLedgerFuzzTest is Base {
    function _refCanonical(uint256 packed, uint256 n) internal pure returns (bool) {
        for (uint256 i; i < 16; ++i) {
            uint256 p = (packed >> (16 * i)) & 0xffff;
            if (i >= n && p != 0) return false;
            if (p > 10_000) return false;
        }
        return true;
    }

    /// Reveal succeeds exactly when the vector is canonical for the round size.
    function testFuzz_canonicalPacking(uint256 packed, uint8 nRaw, bool biasValid) public {
        uint256 n = bound(nRaw, 1, 16);
        if (biasValid) {
            // keep only the first n slots and clamp them, so valid vectors are well covered
            uint256 v;
            for (uint256 i; i < n; ++i) {
                v |= (((packed >> (16 * i)) & 0xffff) % 10_001) << (16 * i);
            }
            packed = v;
        }
        (uint256 id,) = _createRound(n);
        _commit(id, alice, packed, bytes32(uint256(7)));
        _toReveal(id);
        vm.prank(alice);
        if (!_refCanonical(packed, n)) vm.expectRevert(ForecastLedger.NonCanonical.selector);
        ledger.reveal(id, packed, bytes32(uint256(7)));
    }

    /// Any change to round, forecaster, packed, salt or chain changes the hash.
    function testFuzz_hashBinding(uint256 roundId, address who, uint256 packed, bytes32 salt, uint8 which) public {
        bytes32 h = ledger.computeCommitHash(roundId, who, packed, salt);
        bytes32 expected =
            keccak256(abi.encode(ledger.COMMIT_TYPEHASH(), block.chainid, address(ledger), roundId, who, packed, salt));
        assertEq(h, expected);
        which = uint8(bound(which, 0, 4));
        bytes32 h2;
        if (which == 0) h2 = ledger.computeCommitHash(roundId ^ 1, who, packed, salt);
        if (which == 1) h2 = ledger.computeCommitHash(roundId, address(uint160(who) ^ 1), packed, salt);
        if (which == 2) h2 = ledger.computeCommitHash(roundId, who, packed ^ 1, salt);
        if (which == 3) h2 = ledger.computeCommitHash(roundId, who, packed, salt ^ bytes32(uint256(1)));
        if (which == 4) {
            vm.chainId(block.chainid + 1);
            h2 = ledger.computeCommitHash(roundId, who, packed, salt);
        }
        assertTrue(h2 != h);
    }

    struct Case {
        uint256 n;
        uint256 packed;
        uint256 base;
        uint16 yesMask;
        uint16 voidMask;
    }

    function _setupCase(uint256 seed, uint8 nRaw, bool withBaseline) internal returns (uint256 id, Case memory c) {
        c.n = bound(nRaw, 1, 16);
        ForecastLedger.QuestionInput[] memory qs;
        (id, qs) = _createRound(c.n);
        for (uint256 i; i < c.n; ++i) {
            c.packed |= (uint256(keccak256(abi.encode(seed, "p", i))) % 10_001) << (16 * i);
            c.base |= (uint256(keccak256(abi.encode(seed, "b", i))) % 10_001) << (16 * i);
        }
        c.yesMask = uint16(uint256(keccak256(abi.encode(seed, "y"))));
        c.voidMask =
            uint16(uint256(keccak256(abi.encode(seed, "v")))) & uint16(uint256(keccak256(abi.encode(seed, "w"))));
        _commit(id, alice, c.packed, bytes32(seed));
        _commit(id, bob, c.packed, bytes32(seed ^ 1));
        if (withBaseline) _setBaseline(id, c.base);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, c.packed, bytes32(seed));
        for (uint256 i; i < c.n; ++i) {
            if (c.voidMask & (1 << i) != 0) _resolveSplit(qs[i]);
            else _resolve(qs[i], c.yesMask & (1 << i) != 0);
            ledger.finalizeQuestion(id, i);
        }
        _toScoring(id);
    }

    /// Onchain Brier, baseline Brier and skill equal a straightforward reference.
    function testFuzz_brierMatchesReference(uint256 seed, uint8 nRaw, bool withBaseline) public {
        (uint256 id, Case memory c) = _setupCase(seed, nRaw, withBaseline);
        ledger.score(id, alice);
        uint256 own;
        uint256 base;
        uint256 q;
        for (uint256 i; i < c.n; ++i) {
            if (c.voidMask & (1 << i) != 0) continue;
            bool yes = c.yesMask & (1 << i) != 0;
            own += _brier((c.packed >> (16 * i)) & 0xffff, yes);
            base += _brier((c.base >> (16 * i)) & 0xffff, yes);
            ++q;
        }
        ForecastLedger.Stats memory s = ledger.getStats(alice);
        assertEq(s.questionsScored, q);
        assertEq(s.sumBrier, own);
        assertEq(s.sumBaselineBrier, withBaseline ? base : 0);
        assertEq(s.baselineQuestions, withBaseline ? q : 0);
        assertEq(int256(s.sumSkill), withBaseline ? int256(base) - int256(own) : int256(0));
    }

    /// Forfeiting is never better than revealing the same committed forecast.
    function testFuzz_forfeitNeverBeatsReveal(uint256 seed, uint8 nRaw, bool withBaseline) public {
        (uint256 id,) = _setupCase(seed, nRaw, withBaseline);
        ledger.score(id, alice);
        ledger.forfeit(id, bob);
        ForecastLedger.Stats memory a = ledger.getStats(alice);
        ForecastLedger.Stats memory b = ledger.getStats(bob);
        assertEq(a.questionsScored, b.questionsScored);
        assertLe(a.sumBrier, b.sumBrier);
        assertGe(a.sumSkill, b.sumSkill);
    }

    /// Golden vector, computed independently with viem 2.58.4 (TypeScript side of the parity check).
    /// The agent CLI must reproduce exactly this hash; see notes/knowledge.md.
    function test_goldenCommitHash() public {
        address target = 0x1111111111111111111111111111111111111111;
        address[] memory l = new address[](1);
        l[0] = address(ctfA);
        deployCodeTo(
            "ForecastLedger.sol:ForecastLedger", abi.encode(address(aid), l, admin, keeper, 2 hours, 12 hours), target
        );
        vm.chainId(56);
        ForecastLedger g = ForecastLedger(target);
        assertEq(g.COMMIT_TYPEHASH(), 0xd05256df5fe0aeb27c2c0e470434c7b5edc625923ab60448c2bd569c610d4371);
        uint256 packed = 9000 | (2000 << 16) | (10_000 << 32);
        assertEq(packed, 42_949_804_041_000);
        bytes32 h = g.computeCommitHash(7, 0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5, packed, keccak256("golden"));
        assertEq(h, 0x343e0813665598bb9ba88edb81220fe30cefbae1b52416242dc72e11c1d192b8);
    }

    /// Golden scoring vectors from scripts/golden_vectors.mjs (plain JavaScript reference). Round of 4 questions,
    /// outcomes Yes, No, Void (split), Yes; forecast [8000, 3000, 9000, 6500]; baseline [6000, 5000, 5000, 7000].
    function _goldenRound(bool withBaseline) internal returns (uint256 id) {
        ForecastLedger.QuestionInput[] memory qs;
        (id, qs) = _createRound(4);
        uint256 p = 8000 | (3000 << 16) | (9000 << 32) | (6500 << 48);
        uint256 b = 6000 | (5000 << 16) | (5000 << 32) | (7000 << 48);
        assertEq(p, 1_829_626_003_521_544_000);
        assertEq(b, 1_970_346_312_138_758_000);
        _commit(id, alice, p, bytes32("a"));
        _commit(id, bob, p, bytes32("b")); // same forecast, never revealed
        if (withBaseline) _setBaseline(id, b);
        _toReveal(id);
        vm.prank(alice);
        ledger.reveal(id, p, bytes32("a"));
        _resolve(qs[0], true);
        _resolve(qs[1], false);
        _resolveSplit(qs[2]);
        _resolve(qs[3], true);
        for (uint256 i; i < 4; ++i) {
            ledger.finalizeQuestion(id, i);
        }
        _toScoring(id);
        ledger.score(id, alice);
        ledger.forfeit(id, bob);
    }

    function test_goldenScoring_withBaseline() public {
        _goldenRound(true);
        ForecastLedger.Stats memory a = ledger.getStats(alice);
        assertEq(a.questionsScored, 3);
        assertEq(a.sumBrier, 25_250_000);
        assertEq(a.sumBaselineBrier, 50_000_000);
        assertEq(a.sumSkill, 24_750_000);
        assertEq(a.baselineQuestions, 3);
        ForecastLedger.Stats memory f = ledger.getStats(bob);
        assertEq(f.questionsScored, 3);
        assertEq(f.sumBrier, 300_000_000);
        assertEq(f.sumBaselineBrier, 50_000_000);
        assertEq(f.sumSkill, -250_000_000);
        assertEq(f.roundsForfeited, 1);
    }

    function test_goldenScoring_noBaseline() public {
        _goldenRound(false);
        ForecastLedger.Stats memory a = ledger.getStats(alice);
        assertEq(a.questionsScored, 3);
        assertEq(a.sumBrier, 25_250_000);
        assertEq(a.sumBaselineBrier, 0);
        assertEq(a.sumSkill, 0);
        assertEq(a.baselineQuestions, 0);
        assertEq(ledger.getStats(bob).sumBrier, 300_000_000);
    }

    /// Overflow headroom: a whole round of worst case scores fits in the stats widths with a 1e9x margin.
    function test_headroom() public pure {
        uint256 perRound = 16 * 1e8;
        assertGt(uint256(type(uint64).max) / perRound, 1e9);
        assertGt(uint256(uint64(type(int64).max)) / perRound, 1e9);
    }
}
