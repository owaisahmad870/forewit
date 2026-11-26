// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Script, console} from "forge-std/Script.sol";
import {ForewitStart} from "../src/ForewitStart.sol";

/// @notice BSC mainnet deploy of ForewitStart. Never run without Owais's explicit yes.
/// The deployer signs from its encrypted keystore (forge script --keystore <file>, password typed at the prompt).
/// No roles: the contract has no owner or admin, so the deployer keeps no power after this transaction.
/// Env: MAINNET_DEPLOYER.
contract DeployStartMainnet is Script {
    address constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;

    function run() external returns (ForewitStart s) {
        require(block.chainid == 56, "mainnet script: chain 56 only");
        address deployer = vm.envAddress("MAINNET_DEPLOYER");
        require(deployer != address(0), "zero deployer");
        vm.startBroadcast(deployer);
        s = new ForewitStart(AGENT_ID);
        vm.stopBroadcast();
        require(address(s.AGENT_ID()) == AGENT_ID, "agent id wrong");
        require(s.starts() == 0, "not empty");
        console.log("ForewitStart", address(s));
    }
}
