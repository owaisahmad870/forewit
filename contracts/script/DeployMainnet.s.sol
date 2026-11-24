// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Script, console} from "forge-std/Script.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";

/// @notice BSC mainnet deploy. Never run without Owais's explicit yes. Keys: fresh mainnet keys backed up offline,
/// never the testnet ones. The deployer signs from its encrypted keystore (forge script --keystore <file>, password
/// typed at the prompt). Env: MAINNET_DEPLOYER, MAINNET_ADMIN, MAINNET_ROUND_MANAGER (three distinct addresses),
/// COMMIT_WINDOW and REVEAL_WINDOW in seconds (default 2 h and 12 h).
contract DeployMainnet is Script {
    address constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    address constant CTF = 0x22DA1810B194ca018378464a58f6Ac2B10C9d244;
    address constant YB_CTF = 0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F;
    address constant YB_NR_CTF = 0xF64b0b318AAf83BD9071110af24D24445719A07F;
    uint256 constant MIN_COMMIT = 2 hours;
    uint256 constant MIN_REVEAL = 12 hours;

    /// @notice Hard fail unless this is chain 56 with windows of at least 2 h and 12 h.
    function validate(uint256 chainId, uint256 commitWindow, uint256 revealWindow) public pure {
        require(chainId == 56, "mainnet script: chain 56 only");
        require(commitWindow >= MIN_COMMIT, "commit window below 2 hours");
        require(revealWindow >= MIN_REVEAL, "reveal window below 12 hours");
    }

    /// @notice Hard fail unless deployer, admin and round manager are three distinct nonzero addresses,
    /// so the deployer can never end holding a role and the admin never doubles as the keeper.
    function validateRoles(address deployer, address admin, address manager) public pure {
        require(deployer != address(0) && admin != address(0) && manager != address(0), "zero role address");
        require(admin != deployer && manager != deployer, "deployer must hold no role");
        require(admin != manager, "admin must differ from round manager");
    }

    function run() external returns (ForecastLedger ledger) {
        uint256 commitWindow = vm.envOr("COMMIT_WINDOW", MIN_COMMIT);
        uint256 revealWindow = vm.envOr("REVEAL_WINDOW", MIN_REVEAL);
        validate(block.chainid, commitWindow, revealWindow);
        address deployer = vm.envAddress("MAINNET_DEPLOYER");
        address admin = vm.envAddress("MAINNET_ADMIN");
        address manager = vm.envAddress("MAINNET_ROUND_MANAGER");
        validateRoles(deployer, admin, manager);
        address[] memory ctfs = new address[](3);
        ctfs[0] = CTF;
        ctfs[1] = YB_CTF;
        ctfs[2] = YB_NR_CTF;
        vm.startBroadcast(deployer);
        ledger = new ForecastLedger(AGENT_ID, ctfs, admin, manager, commitWindow, revealWindow);
        vm.stopBroadcast();
        // read the roles back: admin and pauser on admin, round manager on manager, nothing on the deployer
        require(ledger.defaultAdmin() == admin && ledger.hasRole(ledger.PAUSER_ROLE(), admin), "admin roles wrong");
        require(ledger.hasRole(ledger.ROUND_MANAGER_ROLE(), manager), "manager role wrong");
        require(
            !ledger.hasRole(ledger.DEFAULT_ADMIN_ROLE(), deployer) && !ledger.hasRole(ledger.PAUSER_ROLE(), deployer)
                && !ledger.hasRole(ledger.ROUND_MANAGER_ROLE(), deployer),
            "deployer holds a role"
        );
        console.log("ForecastLedger", address(ledger));
    }
}
