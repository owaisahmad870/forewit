// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Script, console} from "forge-std/Script.sol";
import {OpenForecasts} from "../src/OpenForecasts.sol";

/// @notice BSC mainnet deploy of OpenForecasts (Forewit v2). Never run without Owais's explicit yes.
/// The deployer signs from its encrypted keystore (forge script --keystore <file>, password typed at the prompt).
/// Env: MAINNET_DEPLOYER, MAINNET_ADMIN, OPEN_KEEPER (three distinct addresses; OPEN_KEEPER is a fresh wallet, not the
/// v1 keeper, so v2 can never starve the v1 deadline duties).
contract DeployOpenMainnet is Script {
    address constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    // Predict.fun Conditional Tokens on BSC mainnet: normal and neg risk, yield bearing, yield bearing neg risk
    address constant CTF_STD = 0x22DA1810B194ca018378464a58f6Ac2B10C9d244;
    address constant CTF_YB = 0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F;
    address constant CTF_YBNR = 0xF64b0b318AAf83BD9071110af24D24445719A07F;

    function run() external returns (OpenForecasts of_) {
        require(block.chainid == 56, "mainnet script: chain 56 only");
        address deployer = vm.envAddress("MAINNET_DEPLOYER");
        address admin = vm.envAddress("MAINNET_ADMIN");
        address keeper = vm.envAddress("OPEN_KEEPER");
        require(deployer != address(0) && admin != address(0) && keeper != address(0), "zero role address");
        require(admin != deployer && keeper != deployer && admin != keeper, "roles must be three distinct wallets");
        address[] memory ctfs = new address[](3);
        ctfs[0] = CTF_STD;
        ctfs[1] = CTF_YB;
        ctfs[2] = CTF_YBNR;
        vm.startBroadcast(deployer);
        of_ = new OpenForecasts(AGENT_ID, ctfs, admin, keeper);
        vm.stopBroadcast();
        require(of_.defaultAdmin() == admin, "admin role wrong");
        require(of_.hasRole(of_.KEEPER_ROLE(), keeper), "keeper role wrong");
        require(!of_.hasRole(of_.KEEPER_ROLE(), admin) && !of_.hasRole(of_.KEEPER_ROLE(), deployer), "keeper role leaked");
        require(!of_.hasRole(of_.DEFAULT_ADMIN_ROLE(), deployer), "deployer holds admin");
        require(address(of_.AGENT_ID()) == AGENT_ID, "agent id wrong");
        console.log("OpenForecasts", address(of_));
    }
}
