// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "./Base.t.sol";
import {ForewitScores} from "../src/ForewitScores.sol";
import {ForewitGate} from "../src/examples/ForewitGate.sol";
import {DeployScoresMainnet} from "../script/DeployScoresMainnet.s.sol";
import {Hashes} from "@openzeppelin/contracts/utils/cryptography/Hashes.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

/// @dev Shared setup: ForewitScores over the Base ledger, and a Merkle builder with the exact OpenZeppelin
/// StandardMerkleTree layout (leaf hashes sorted ascending, stored reversed at the end of the array, commutative nodes).
abstract contract ScoresBase is Base {
    ForewitScores internal scores;

    function setUp() public virtual override {
        super.setUp();
        scores = new ForewitScores(admin, keeper, address(ledger), address(aid));
        vm.roll(1000); // Foundry starts at block 1; snapshotBlock must be below block.number
    }

    function _leaf(uint256 t, int256 s, uint256 n) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(t, s, n))));
    }

    function _tree(bytes32[] memory leaves) internal pure returns (bytes32[] memory tree) {
        uint256 n = leaves.length;
        bytes32[] memory l = new bytes32[](n);
        for (uint256 i; i < n; ++i) {
            l[i] = leaves[i];
            for (uint256 j = i; j > 0 && l[j - 1] > l[j]; --j) {
                (l[j - 1], l[j]) = (l[j], l[j - 1]);
            }
        }
        tree = new bytes32[](2 * n - 1);
        for (uint256 i; i < n; ++i) {
            tree[tree.length - 1 - i] = l[i];
        }
        for (uint256 i = tree.length - n; i > 0; --i) {
            tree[i - 1] = Hashes.commutativeKeccak256(tree[2 * i - 1], tree[2 * i]);
        }
    }

    function _proof(bytes32[] memory tree, bytes32 leaf) internal pure returns (bytes32[] memory proof) {
        uint256 idx = type(uint256).max;
        for (uint256 i; i < tree.length; ++i) {
            if (tree[i] == leaf && 2 * i + 1 >= tree.length) idx = i;
        }
        require(idx != type(uint256).max, "leaf not in tree");
        uint256 depth;
        for (uint256 i = idx; i > 0; i = (i - 1) / 2) {
            ++depth;
        }
        proof = new bytes32[](depth);
        for (uint256 k; idx > 0; ++k) {
            proof[k] = tree[idx % 2 == 1 ? idx + 1 : idx - 1];
            idx = (idx - 1) / 2;
        }
    }

    /// @dev Golden leaf i (1 based), same as indexer/test/scores.test.mjs: tokenId keccak(abi.encode(i)),
    /// skill alternating sign i * 1000003, n = 3i.
    function _golden(uint256 i) internal pure returns (uint256 t, int256 s, uint256 n) {
        t = uint256(keccak256(abi.encode(i)));
        s = (i % 2 == 1 ? -int256(1) : int256(1)) * int256(i * 1_000_003);
        n = 3 * i;
    }

    function _goldenTree(uint256 count) internal pure returns (bytes32[] memory tree) {
        bytes32[] memory leaves = new bytes32[](count);
        for (uint256 i; i < count; ++i) {
            (uint256 t, int256 s, uint256 n) = _golden(i + 1);
            leaves[i] = _leaf(t, s, n);
        }
        tree = _tree(leaves);
    }

    function _post(bytes32 root, uint64 snapshot, uint32 count) internal {
        vm.prank(keeper);
        scores.postRoot(1, snapshot, root, count);
    }
}

contract ForewitScoresTest is ScoresBase {
    // Roots printed by @openzeppelin/merkle-tree 1.0.8 StandardMerkleTree.of over the golden sets
    bytes32 constant ROOT_1 = 0xa8aefe4bd595ae3c040fd6d9c34ebf42b8e465827b98a79cbd660163542f75e2;
    bytes32 constant ROOT_2 = 0x7659df4db5c75db32c8ab9e29af22988aa64667eaff0e2958f1d8fe5ef082651;
    bytes32 constant ROOT_3 = 0x0737fee60ad24766fbfe596e102c393f6263d76634c0ea7feba333b5c5562d54;
    bytes32 constant ROOT_100 = 0x14c757f3523cdd50dc9f40aa75cd142fa50e43eba19dc0d9108a605275453e49;
    /// @dev The library's proof for golden leaf 2 in the 3 leaf tree.
    bytes32 constant PROOF_3_LEAF_2 = 0x5f629575d2ba974d11fee90831abbbf11b6860f2744a5cf1bd223ddc3ccf78bf;

    event RootPosted(
        uint256 indexed epoch, uint256 indexed roundId, bytes32 root, uint64 snapshotBlock, uint32 leafCount
    );
    event RootRevoked(uint256 indexed epoch, string reason);

    // Golden vectors (JavaScript parity)

    function test_golden_roots_matchLibrary() public pure {
        assertEq(_goldenTree(1)[0], ROOT_1);
        assertEq(_goldenTree(2)[0], ROOT_2);
        assertEq(_goldenTree(3)[0], ROOT_3);
        assertEq(_goldenTree(100)[0], ROOT_100);
    }

    /// @dev Root of the logs fixture in indexer/test/scores.test.mjs: alice reveal (24,750,000 over 3) and bob forfeit
    /// (minus 250,000,000 over 3), both with a baseline, so skills 1,076,086 and minus 10,869,565.
    function test_golden_logsFixtureRoot() public pure {
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = _leaf(uint256(keccak256(bytes("alice"))), int256(24_750_000) / 23, 3);
        leaves[1] = _leaf(uint256(keccak256(bytes("bob"))), int256(-250_000_000) / 23, 3);
        assertEq(_tree(leaves)[0], 0xe31d80ac145c1d9963216ef18ad1eee1f666b2845b5195afe97ffc137c533775);
    }

    function test_golden_singleLeafRootIsLeaf() public pure {
        (uint256 t, int256 s, uint256 n) = _golden(1);
        assertEq(_leaf(t, s, n), ROOT_1);
    }

    function test_golden_libraryProofVerifies() public {
        _post(ROOT_3, 10, 3);
        (uint256 t, int256 s, uint256 n) = _golden(2);
        bytes32[] memory p = new bytes32[](1);
        p[0] = PROOF_3_LEAF_2;
        assertTrue(scores.verify(t, s, n, p));
        assertEq(_proof(_goldenTree(3), _leaf(t, s, n))[0], PROOF_3_LEAF_2);
    }

    function test_golden_skillDivisionTruncatesTowardZero() public pure {
        // docs/SCORES.md 1.2: skill = sumSkill / (n + 20)
        assertEq(int256(24_750_000) / int256(3 + 20), 1_076_086);
        assertEq(int256(-250_000_000) / int256(3 + 20), -10_869_565);
        assertEq(int256(0) / int256(0 + 20), 0);
        assertEq(int256(-1) / int256(0 + 20), 0);
    }

    function test_leafHash_matchesEncoding() public view {
        (uint256 t, int256 s, uint256 n) = _golden(7);
        assertEq(scores.leafHash(t, s, n), _leaf(t, s, n));
    }

    function test_verify_everyLeafOf100() public {
        bytes32[] memory tree = _goldenTree(100);
        _post(tree[0], 10, 100);
        for (uint256 i = 1; i <= 100; ++i) {
            (uint256 t, int256 s, uint256 n) = _golden(i);
            bytes32[] memory p = _proof(tree, _leaf(t, s, n));
            assertTrue(scores.verify(t, s, n, p));
            assertFalse(scores.verify(t + 1, s, n, p));
            assertFalse(scores.verify(t, s - 1, n, p));
            assertFalse(scores.verify(t, s, n + 1, p));
            p[0] = bytes32(uint256(p[0]) ^ 1);
            assertFalse(scores.verify(t, s, n, p));
        }
    }

    // Constructor and roles

    function test_constructor_wiringAndRoles() public view {
        assertEq(scores.LEDGER(), address(ledger));
        assertEq(scores.AGENT_ID(), address(aid));
        assertEq(scores.defaultAdmin(), admin);
        assertEq(scores.defaultAdminDelay(), 1 days);
        assertTrue(scores.hasRole(scores.ROUND_MANAGER_ROLE(), keeper));
        assertFalse(scores.hasRole(scores.ROUND_MANAGER_ROLE(), admin));
        assertEq(scores.ROUND_MANAGER_ROLE(), ledger.ROUND_MANAGER_ROLE());
        assertEq(scores.SHRINK_K(), 20);
        assertEq(scores.SCORE_VERSION(), 1);
        assertEq(scores.latestEpoch(), 0);
    }

    function test_constructor_agentIdMismatch() public {
        vm.expectRevert(ForewitScores.AgentIdMismatch.selector);
        new ForewitScores(admin, keeper, address(ledger), address(ctfA));
    }

    function test_constructor_ledgerWithoutCode() public {
        vm.expectRevert(abi.encodeWithSelector(ForewitScores.NoCode.selector, nobody));
        new ForewitScores(admin, keeper, nobody, address(aid));
    }

    function test_constructor_zeroKeeper() public {
        vm.expectRevert(ForewitScores.ZeroAddress.selector);
        new ForewitScores(admin, address(0), address(ledger), address(aid));
    }

    function test_constructor_zeroLedger() public {
        vm.expectRevert(ForewitScores.ZeroAddress.selector);
        new ForewitScores(admin, keeper, address(0), address(aid));
    }

    function test_constructor_zeroAgentId() public {
        vm.expectRevert(ForewitScores.ZeroAddress.selector);
        new ForewitScores(admin, keeper, address(ledger), address(0));
    }

    function test_postRoot_onlyKeeper() public {
        bytes32 role = scores.ROUND_MANAGER_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, admin, role));
        vm.prank(admin);
        scores.postRoot(1, 10, ROOT_1, 1);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, nobody, role));
        vm.prank(nobody);
        scores.postRoot(1, 10, ROOT_1, 1);
    }

    function test_postRoot_guards() public {
        vm.startPrank(keeper);
        vm.expectRevert(ForewitScores.ZeroRoot.selector);
        scores.postRoot(1, 10, bytes32(0), 1);
        vm.expectRevert(ForewitScores.ZeroLeafCount.selector);
        scores.postRoot(1, 10, ROOT_1, 0);
        vm.expectRevert(ForewitScores.BadSnapshotBlock.selector);
        scores.postRoot(1, 1000, ROOT_1, 1); // current block
        vm.expectRevert(ForewitScores.BadSnapshotBlock.selector);
        scores.postRoot(1, 1001, ROOT_1, 1); // future block
        scores.postRoot(1, 999, ROOT_1, 1);
        vm.expectRevert(ForewitScores.BadSnapshotBlock.selector);
        scores.postRoot(2, 999, ROOT_2, 2); // not strictly increasing
        vm.expectRevert(ForewitScores.BadSnapshotBlock.selector);
        scores.postRoot(2, 500, ROOT_2, 2);
        vm.stopPrank();
    }

    function test_postRoot_recordsAndEmits() public {
        vm.warp(1_900_000_000);
        vm.expectEmit(address(scores));
        emit RootPosted(1, 7, ROOT_3, 10, 3);
        vm.prank(keeper);
        scores.postRoot(7, 10, ROOT_3, 3);
        vm.expectEmit(address(scores));
        emit RootPosted(2, 5, ROOT_2, 11, 2); // older round id, newer snapshot: becomes latest
        vm.prank(keeper);
        scores.postRoot(5, 11, ROOT_2, 2);
        assertEq(scores.latestEpoch(), 2);
        ForewitScores.Epoch memory e = scores.getEpoch(1);
        assertEq(e.root, ROOT_3);
        assertEq(e.snapshotBlock, 10);
        assertEq(e.roundId, 7);
        assertEq(e.leafCount, 3);
        assertEq(e.postedAt, 1_900_000_000);
        assertFalse(e.revoked);
        vm.expectRevert(ForewitScores.UnknownEpoch.selector);
        scores.getEpoch(0);
        vm.expectRevert(ForewitScores.UnknownEpoch.selector);
        scores.getEpoch(3);
    }

    // Verify and revoke

    function test_verify_falseBeforeFirstPost() public view {
        (uint256 t, int256 s, uint256 n) = _golden(1);
        assertFalse(scores.verify(t, s, n, new bytes32[](0)));
        assertFalse(scores.verifyAt(0, t, s, n, new bytes32[](0)));
        assertFalse(scores.verifyAt(1, t, s, n, new bytes32[](0)));
    }

    function test_verify_onlyLatestNoFallback() public {
        (uint256 t, int256 s, uint256 n) = _golden(1);
        bytes32[] memory empty = new bytes32[](0);
        _post(ROOT_1, 10, 1);
        assertTrue(scores.verify(t, s, n, empty));
        _post(ROOT_2, 11, 2);
        assertFalse(scores.verify(t, s, n, empty)); // the old proof does not match the new root
        assertTrue(scores.verifyAt(1, t, s, n, empty)); // history by explicit choice
        assertFalse(scores.verifyAt(3, t, s, n, empty));
    }

    function test_revoke_latestFailsClosed() public {
        (uint256 t, int256 s, uint256 n) = _golden(1);
        bytes32[] memory empty = new bytes32[](0);
        _post(ROOT_1, 10, 1);
        _post(ROOT_1, 11, 1);
        vm.expectEmit(address(scores));
        emit RootRevoked(2, "bad build");
        vm.prank(keeper);
        scores.revokeRoot(2, "bad build");
        assertTrue(scores.getEpoch(2).revoked);
        assertFalse(scores.verify(t, s, n, empty)); // no fallback to epoch 1
        assertFalse(scores.verifyAt(2, t, s, n, empty));
        assertTrue(scores.verifyAt(1, t, s, n, empty));
    }

    function test_revoke_correctThenRevoke() public {
        (uint256 t, int256 s, uint256 n) = _golden(1);
        bytes32[] memory empty = new bytes32[](0);
        _post(ROOT_2, 10, 2); // wrong root
        _post(ROOT_1, 11, 1); // corrected, newer snapshot
        vm.prank(admin);
        scores.revokeRoot(1, "wrong root");
        assertTrue(scores.verify(t, s, n, empty));
        assertFalse(scores.verifyAt(1, t, s, n, empty));
    }

    function test_revoke_keeperOnlyNewestTwo() public {
        _post(ROOT_1, 10, 1);
        _post(ROOT_2, 11, 2);
        _post(ROOT_1, 12, 1);
        // epoch 1 is history: the hot keeper key cannot erase it, the admin can
        vm.expectRevert(ForewitScores.KeeperRevokeTooOld.selector);
        vm.prank(keeper);
        scores.revokeRoot(1, "x");
        // the bad root and the corrected root (epochs 2 and 3) stay revocable by the keeper
        vm.prank(keeper);
        scores.revokeRoot(2, "bad, superseded by 3");
        vm.prank(admin);
        scores.revokeRoot(1, "admin may revoke history");
        assertTrue(scores.getEpoch(1).revoked && scores.getEpoch(2).revoked && !scores.getEpoch(3).revoked);
    }

    function test_revoke_authAndErrors() public {
        _post(ROOT_1, 10, 1);
        vm.expectRevert(ForewitScores.NotAuthorized.selector);
        vm.prank(nobody);
        scores.revokeRoot(1, "x");
        vm.startPrank(admin);
        vm.expectRevert(ForewitScores.UnknownEpoch.selector);
        scores.revokeRoot(0, "x");
        vm.expectRevert(ForewitScores.UnknownEpoch.selector);
        scores.revokeRoot(2, "x");
        scores.revokeRoot(1, "x");
        vm.expectRevert(ForewitScores.AlreadyRevoked.selector);
        scores.revokeRoot(1, "x");
        vm.stopPrank();
    }

    function test_adminTwoStepTransfer() public {
        address next = makeAddr("nextAdmin");
        vm.prank(admin);
        scores.beginDefaultAdminTransfer(next);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(next);
        scores.acceptDefaultAdminTransfer();
        assertEq(scores.defaultAdmin(), next);
        _post(ROOT_1, 10, 1);
        vm.expectRevert(ForewitScores.NotAuthorized.selector);
        vm.prank(admin);
        scores.revokeRoot(1, "old admin");
        vm.prank(next);
        scores.revokeRoot(1, "new admin");
    }

    function test_keeperRotation() public {
        address k2 = makeAddr("keeper2");
        bytes32 role = scores.ROUND_MANAGER_ROLE();
        vm.startPrank(admin);
        scores.revokeRole(role, keeper);
        scores.grantRole(role, k2);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, keeper, role));
        vm.prank(keeper);
        scores.postRoot(1, 10, ROOT_1, 1);
        vm.prank(k2);
        scores.postRoot(1, 10, ROOT_1, 1);
    }

    function test_rejectsValue() public {
        vm.deal(keeper, 1 ether);
        vm.prank(keeper);
        (bool ok,) = address(scores).call{value: 1}(abi.encodeCall(ForewitScores.postRoot, (1, 10, ROOT_1, 1)));
        assertFalse(ok);
        vm.prank(keeper);
        (ok,) = address(scores).call{value: 1}("");
        assertFalse(ok);
        assertEq(address(scores).balance, 0);
    }

    // Gas (one call per test so storage starts cold; see docs/SCORES.md section 8)

    function test_gas_postRoot_first() public {
        vm.prank(keeper);
        scores.postRoot(1, 10, ROOT_100, 100);
    }
}

/// @dev Steady state gas: one epoch posted in setUp, so the measured call reads cold storage.
contract ForewitScoresSteadyGasTest is ScoresBase {
    function setUp() public override {
        super.setUp();
        _post(0x0737fee60ad24766fbfe596e102c393f6263d76634c0ea7feba333b5c5562d54, 10, 3);
    }

    function test_gas_postRoot_steady() public {
        vm.prank(keeper);
        scores.postRoot(2, 11, 0x14c757f3523cdd50dc9f40aa75cd142fa50e43eba19dc0d9108a605275453e49, 100);
    }

    function test_gas_revokeRoot() public {
        vm.prank(keeper);
        scores.revokeRoot(1, "wrong root");
    }
}

/// @dev Verify gas against a root posted in setUp, so the measured call reads cold storage.
contract ForewitScoresVerifyGasTest is ScoresBase {
    uint256 internal t;
    int256 internal s;
    uint256 internal n;
    bytes32[] internal proof;

    function setUp() public override {
        super.setUp();
        bytes32[] memory tree = _goldenTree(100);
        _post(tree[0], 10, 100);
        (t, s, n) = _golden(42);
        proof = _proof(tree, _leaf(t, s, n));
    }

    function test_gas_verify100() public view {
        assertEq(proof.length, 7);
        assertTrue(scores.verify(t, s, n, proof));
    }
}

contract ForewitGateTest is ScoresBase {
    ForewitGate internal gate;
    bytes32[] internal tree;
    uint256 internal aliceId = uint256(keccak256(bytes("alice")));
    uint256 internal bobId = uint256(keccak256(bytes("bob")));

    function setUp() public override {
        super.setUp();
        gate = new ForewitGate(scores, 0, 20, 3 days);
        vm.prank(alice);
        ledger.setPublicProfile(true, "alice");
        vm.prank(bob);
        ledger.setPublicProfile(true, "bob");
        vm.prank(carol);
        ledger.setPublicProfile(true, "carol");
        bytes32[] memory leaves = new bytes32[](3);
        leaves[0] = _leaf(aliceId, 500, 24); // passes
        leaves[1] = _leaf(bobId, -1, 40); // skill below zero
        leaves[2] = _leaf(uint256(keccak256(bytes("carol"))), 900, 19); // n below 20
        tree = _tree(leaves);
        _post(tree[0], 10, 3);
    }

    function test_gate_wiring() public view {
        assertEq(address(gate.SCORES()), address(scores));
        assertEq(address(gate.AGENT_ID()), address(aid));
        assertEq(gate.MIN_SKILL(), 0);
        assertEq(gate.MIN_N(), 20);
        assertEq(gate.MAX_AGE(), 3 days);
        assertEq(address(gate.LEDGER()), address(ledger));
    }

    function test_gate_holderMustBeOptedIn() public {
        bytes32[] memory p = _proof(tree, _leaf(aliceId, 500, 24));
        vm.prank(alice);
        ledger.setPublicProfile(false, "");
        vm.expectRevert(ForewitGate.NotOptedIn.selector);
        vm.prank(alice);
        gate.claim(aliceId, 500, 24, p);
    }

    function test_gate_claim() public {
        bytes32[] memory p = _proof(tree, _leaf(aliceId, 500, 24));
        vm.expectEmit(address(gate));
        emit ForewitGate.Passed(aliceId, alice, 1, 500, 24);
        vm.prank(alice);
        gate.claim(aliceId, 500, 24, p);
        assertEq(gate.passed(aliceId), 1);
    }

    function test_gate_wrongHolder() public {
        bytes32[] memory p = _proof(tree, _leaf(aliceId, 500, 24));
        vm.expectRevert(ForewitGate.NotHolder.selector);
        vm.prank(bob);
        gate.claim(aliceId, 500, 24, p);
    }

    function test_gate_badProof() public {
        bytes32[] memory p = _proof(tree, _leaf(aliceId, 500, 24));
        vm.expectRevert(ForewitGate.BadProof.selector);
        vm.prank(alice);
        gate.claim(aliceId, 501, 24, p);
    }

    function test_gate_belowMinimum() public {
        bytes32[] memory p = _proof(tree, _leaf(bobId, -1, 40));
        vm.expectRevert(ForewitGate.BelowMinimum.selector);
        vm.prank(bob);
        gate.claim(bobId, -1, 40, p);
        uint256 carolId = uint256(keccak256(bytes("carol")));
        p = _proof(tree, _leaf(carolId, 900, 19));
        vm.expectRevert(ForewitGate.BelowMinimum.selector);
        vm.prank(carol);
        gate.claim(carolId, 900, 19, p);
    }

    function test_gate_staleRoot() public {
        bytes32[] memory p = _proof(tree, _leaf(aliceId, 500, 24));
        vm.warp(block.timestamp + 3 days + 1);
        vm.expectRevert(ForewitGate.StaleRoot.selector);
        vm.prank(alice);
        gate.claim(aliceId, 500, 24, p);
    }

    function test_gate_revokedRoot() public {
        bytes32[] memory p = _proof(tree, _leaf(aliceId, 500, 24));
        vm.prank(admin);
        scores.revokeRoot(1, "bad");
        vm.expectRevert(ForewitGate.BadProof.selector);
        vm.prank(alice);
        gate.claim(aliceId, 500, 24, p);
    }
}

contract DeployScoresTest is ScoresBase {
    function test_deployGuard_chainAndRoles() public {
        DeployScoresMainnet s = new DeployScoresMainnet();
        s.validate(56);
        vm.expectRevert(bytes("mainnet script: chain 56 only"));
        s.validate(97);
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
        // run() checks the chain before reading any env
        vm.expectRevert(bytes("mainnet script: chain 56 only"));
        s.run();
    }

    function test_deployGuard_readsRolesBack() public {
        DeployScoresMainnet s = new DeployScoresMainnet();
        address d = makeAddr("deployer");
        ForewitScores x = s.deploy(d, admin, keeper, address(ledger), address(aid));
        assertEq(x.defaultAdmin(), admin);
        assertTrue(x.hasRole(x.ROUND_MANAGER_ROLE(), keeper));
        assertFalse(x.hasRole(x.DEFAULT_ADMIN_ROLE(), d));
        vm.expectRevert(bytes("deployer must hold no role"));
        s.deploy(d, d, keeper, address(ledger), address(aid));
    }
}
