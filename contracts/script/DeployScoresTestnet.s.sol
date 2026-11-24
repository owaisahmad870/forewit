// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Script, console} from "forge-std/Script.sol";
import {ForewitScores} from "../src/ForewitScores.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";

/// @notice BSC testnet (chain 97) deploy of ForewitScores over a testnet ForecastLedger (default instance E).
/// Admin: the deployer. Round manager: the keeper. Env: DEPLOYER_PRIVATE_KEY, KEEPER_PRIVATE_KEY, optional SCORES_LEDGER.
/// Simulate: forge script script/DeployScoresTestnet.s.sol --rpc-url bsc_testnet
/// Broadcast only with Owais's explicit yes: add --broadcast (and --verify with ETHERSCAN_API_KEY).
contract DeployScoresTestnet is Script {
    address constant INSTANCE_E = 0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1;

    function run() external returns (ForewitScores scores) {
        require(block.chainid == 97, "testnet only");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address keeper = vm.addr(vm.envUint("KEEPER_PRIVATE_KEY"));
        address ledger = vm.envOr("SCORES_LEDGER", INSTANCE_E);
        address agentId = address(ForecastLedger(ledger).AGENT_ID());

        vm.startBroadcast(deployerKey);
        scores = new ForewitScores(deployer, keeper, ledger, agentId);
        vm.stopBroadcast();
        require(scores.hasRole(scores.ROUND_MANAGER_ROLE(), keeper), "manager role wrong");

        console.log("deployer (admin)        ", deployer);
        console.log("keeper (round manager)  ", keeper);
        console.log("ForecastLedger          ", ledger);
        console.log("Agent ID                ", agentId);
        console.log("ForewitScores           ", address(scores));
    }
}
