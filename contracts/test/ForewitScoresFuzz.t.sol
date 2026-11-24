// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Test} from "forge-std/Test.sol";
import {ScoresBase} from "./ForewitScores.t.sol";
import {ForewitScores} from "../src/ForewitScores.sol";
import {Hashes} from "@openzeppelin/contracts/utils/cryptography/Hashes.sol";

/// @dev Fuzz: random trees of 1 to 64 leaves, proof forgery, second preimage, revoked roots, roles, value.
contract ForewitScoresFuzzTest is ScoresBase {
    struct Set {
        uint256[] t;
        int256[] s;
        uint256[] n;
        bytes32[] tree;
    }

    function _set(uint256 seed, uint256 count) internal pure returns (Set memory x) {
        x.t = new uint256[](count);
        x.s = new int256[](count);
        x.n = new uint256[](count);
        bytes32[] memory leaves = new bytes32[](count);
        for (uint256 i; i < count; ++i) {
            x.t[i] = uint256(keccak256(abi.encode(seed, i))); // distinct tokenIds
            x.s[i] = int256(uint256(keccak256(abi.encode(seed, i, 1)))) % 1e8;
            x.n[i] = uint256(keccak256(abi.encode(seed, i, 2))) % 10_000;
            leaves[i] = _leaf(x.t[i], x.s[i], x.n[i]);
        }
        x.tree = _tree(leaves);
    }

    function testFuzz_everyLeafVerifies_anyBitFlipFails(uint256 seed, uint8 countRaw, uint8 bit) public {
        uint256 count = bound(countRaw, 1, 64);
        Set memory x = _set(seed, count);
        _post(x.tree[0], 10, uint32(count));
        uint256 flip = uint256(1) << bit;
        for (uint256 i; i < count; ++i) {
            bytes32[] memory p = _proof(x.tree, _leaf(x.t[i], x.s[i], x.n[i]));
            assertTrue(scores.verify(x.t[i], x.s[i], x.n[i], p));
            assertFalse(scores.verify(x.t[i] ^ flip, x.s[i], x.n[i], p));
            assertFalse(scores.verify(x.t[i], x.s[i] ^ int256(flip), x.n[i], p));
            assertFalse(scores.verify(x.t[i], x.s[i], x.n[i] ^ flip, p));
            if (p.length != 0) {
                uint256 k = uint256(keccak256(abi.encode(seed, i))) % p.length;
                p[k] = bytes32(uint256(p[k]) ^ flip);
                assertFalse(scores.verify(x.t[i], x.s[i], x.n[i], p));
            }
        }
    }

    function testFuzz_forgedProofFails(uint256 seed, uint8 countRaw, uint256 t, int256 s, uint256 n, bytes32[] memory p)
        public
    {
        uint256 count = bound(countRaw, 1, 64);
        Set memory x = _set(seed, count);
        _post(x.tree[0], 10, uint32(count));
        for (uint256 i; i < count; ++i) {
            vm.assume(_leaf(t, s, n) != _leaf(x.t[i], x.s[i], x.n[i]));
        }
        assertFalse(scores.verify(t, s, n, p));
    }

    /// @dev An internal node (64 byte preimage) never passes as a leaf: a leaf is a double hash of 96 bytes.
    function testFuzz_secondPreimage_internalNodeIsNoLeaf(uint256 seed, uint8 countRaw, uint256 n) public {
        uint256 count = bound(countRaw, 3, 64); // from 3 leaves on, node 1 is internal with children 3 and 4
        Set memory x = _set(seed, count);
        _post(x.tree[0], 10, uint32(count));
        bytes32[] memory p = new bytes32[](1);
        p[0] = x.tree[2]; // the sibling that proves node 1
        assertEq(Hashes.commutativeKeccak256(x.tree[1], p[0]), x.tree[0]);
        (bytes32 l, bytes32 r) = (x.tree[3], x.tree[4]);
        (bytes32 lo, bytes32 hi) = l < r ? (l, r) : (r, l);
        assertEq(keccak256(abi.encode(lo, hi)), x.tree[1]);
        assertFalse(scores.verify(uint256(lo), int256(uint256(hi)), n, p));
        assertFalse(scores.verify(uint256(hi), int256(uint256(lo)), n, p));
    }

    function testFuzz_revokedNeverVerifies(uint256 seed, uint8 countRaw, bool byAdmin) public {
        uint256 count = bound(countRaw, 1, 64);
        Set memory x = _set(seed, count);
        _post(x.tree[0], 10, uint32(count));
        vm.prank(byAdmin ? admin : keeper);
        scores.revokeRoot(1, "fuzz");
        for (uint256 i; i < count; ++i) {
            bytes32[] memory p = _proof(x.tree, _leaf(x.t[i], x.s[i], x.n[i]));
            assertFalse(scores.verify(x.t[i], x.s[i], x.n[i], p));
            assertFalse(scores.verifyAt(1, x.t[i], x.s[i], x.n[i], p));
        }
    }

    function testFuzz_onlyRolesWrite(address who, bytes32 root) public {
        vm.assume(who != keeper && who != admin && root != bytes32(0));
        vm.prank(who);
        vm.expectRevert();
        scores.postRoot(1, 10, root, 1);
        _post(root, 10, 1);
        vm.prank(who);
        vm.expectRevert(ForewitScores.NotAuthorized.selector);
        scores.revokeRoot(1, "x");
    }

    function testFuzz_rejectsValue(uint256 value, bytes calldata data) public {
        value = bound(value, 1, 1e30);
        vm.deal(keeper, value);
        vm.prank(keeper);
        (bool ok,) = address(scores).call{value: value}(data);
        assertFalse(ok);
        assertEq(address(scores).balance, 0);
    }
}

/// @dev Random posts and revokes by the keeper and the admin.
contract ScoresHandler is Test {
    ForewitScores internal scores;
    address internal keeper;
    address internal admin;
    uint256 public maxCount;
    bool public broken;

    constructor(ForewitScores s, address k, address a) {
        scores = s;
        keeper = k;
        admin = a;
    }

    /// @dev Every root is the single leaf (0, 0, 0), so an epoch verifies that leaf exactly when it is not revoked.
    function post(uint64 gap, uint64 roundId) external {
        uint256 latest = scores.latestEpoch();
        uint64 prev = latest == 0 ? 0 : scores.getEpoch(latest).snapshotBlock;
        uint64 snap = prev + uint64(bound(gap, 1, 1000));
        if (block.number <= snap) vm.roll(snap + 1);
        bytes32 root = scores.leafHash(0, 0, 0); // before the prank, which the next call consumes
        vm.prank(keeper);
        scores.postRoot(roundId, snap, root, 1);
        maxCount = scores.latestEpoch();
    }

    function revoke(uint256 epoch, bool byAdmin) external {
        uint256 latest = scores.latestEpoch();
        if (latest == 0) return;
        epoch = bound(epoch, 1, latest);
        if (scores.getEpoch(epoch).revoked) return;
        vm.prank(byAdmin ? admin : keeper);
        scores.revokeRoot(epoch, "invariant");
    }

    /// @dev Posts that must always revert: a snapshot at or below the latest, or at or above the current block.
    function bad(uint64 snap, bool future) external {
        uint256 latest = scores.latestEpoch();
        uint64 prev = latest == 0 ? 0 : scores.getEpoch(latest).snapshotBlock;
        if (!future && latest == 0) return; // any past block is a valid first snapshot
        if (future) snap = uint64(bound(snap, block.number, type(uint64).max));
        else snap = uint64(bound(snap, 0, prev));
        bytes32 root = scores.leafHash(0, 0, 0);
        vm.prank(keeper);
        try scores.postRoot(1, snap, root, 1) {
            broken = true;
        } catch {}
    }
}

contract ForewitScoresInvariantTest is ScoresBase {
    ScoresHandler internal h;

    function setUp() public override {
        super.setUp();
        h = new ScoresHandler(scores, keeper, admin);
        targetContract(address(h));
    }

    function invariant_epochsOnlyGrow() public view {
        assertEq(scores.latestEpoch(), h.maxCount());
        assertFalse(h.broken());
    }

    function invariant_snapshotStrictlyIncreasesAndRevokedNeverVerifies() public view {
        uint256 latest = scores.latestEpoch();
        uint64 prev;
        for (uint256 e = 1; e <= latest; ++e) {
            ForewitScores.Epoch memory x = scores.getEpoch(e);
            assertGt(x.snapshotBlock, prev);
            prev = x.snapshotBlock;
            assertEq(scores.verifyAt(e, 0, 0, 0, new bytes32[](0)), !x.revoked);
        }
    }
}
