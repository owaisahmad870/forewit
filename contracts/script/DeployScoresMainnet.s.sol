// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Script, console} from "forge-std/Script.sol";
import {ForewitScores} from "../src/ForewitScores.sol";

/// @notice BSC mainnet deploy of ForewitScores over the live ForecastLedger. Never run without Owais's explicit yes.
/// The deployer signs from its encrypted keystore (forge script --keystore <file>, password typed at the prompt).
/// Env: MAINNET_DEPLOYER, MAINNET_ADMIN, MAINNET_ROUND_MANAGER (three distinct addresses; the round manager is the
/// ledger's keeper wallet).
contract DeployScoresMainnet is Script {
    address constant LEDGER = 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6;
    address constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;

    /// @notice Hard fail unless this is chain 56.
    function validate(uint256 chainId) public pure {
        require(chainId == 56, "mainnet script: chain 56 only");
    }

    /// @notice Hard fail unless deployer, admin and round manager are three distinct nonzero addresses.
    function validateRoles(address deployer, address admin, address manager) public pure {
        require(deployer != address(0) && admin != address(0) && manager != address(0), "zero role address");
        require(admin != deployer && manager != deployer, "deployer must hold no role");
        require(admin != manager, "admin must differ from round manager");
    }

    function run() external returns (ForewitScores scores) {
        validate(block.chainid);
        return deploy(
            vm.envAddress("MAINNET_DEPLOYER"),
            vm.envAddress("MAINNET_ADMIN"),
            vm.envAddress("MAINNET_ROUND_MANAGER"),
            LEDGER,
            AGENT_ID
        );
    }

    /// @notice Deploy and read the roles back: admin on admin, round manager on manager, nothing on the deployer.
    function deploy(address deployer, address admin, address manager, address ledger, address agentId)
        public
        returns (ForewitScores scores)
    {
        validateRoles(deployer, admin, manager);
        vm.startBroadcast(deployer);
        scores = new ForewitScores(admin, manager, ledger, agentId);
        vm.stopBroadcast();
        require(scores.defaultAdmin() == admin, "admin role wrong");
        require(scores.hasRole(scores.ROUND_MANAGER_ROLE(), manager), "manager role wrong");
        require(!scores.hasRole(scores.ROUND_MANAGER_ROLE(), admin), "admin holds the manager role");
        require(
            !scores.hasRole(scores.DEFAULT_ADMIN_ROLE(), deployer)
                && !scores.hasRole(scores.ROUND_MANAGER_ROLE(), deployer),
            "deployer holds a role"
        );
        require(scores.LEDGER() == ledger && scores.AGENT_ID() == agentId, "wiring wrong");
        console.log("ForewitScores", address(scores));
    }
}
