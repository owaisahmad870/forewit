// SPDX-License-Identifier: MIT
pragma solidity 0.8.39;

import {Script, console} from "forge-std/Script.sol";
import {ForecastLedger} from "../src/ForecastLedger.sol";
import {MockAgentID} from "../src/mocks/MockAgentID.sol";
import {MockConditionalTokens} from "../src/mocks/MockConditionalTokens.sol";

/// @notice BSC testnet (chain 97) deploy: MockAgentID (anyone can mint), one MockConditionalTokens we can resolve
/// at will, and ForecastLedger allowlisting the mock plus the three real Predict.fun testnet CTFs.
/// Admin and pauser: the deployer. Round manager: the keeper. COMMIT_WINDOW and REVEAL_WINDOW (seconds) set the
/// immutable minimum windows; defaults 2 h and 12 h, short values allowed on testnet only.
/// Simulate: forge script script/DeployTestnet.s.sol --rpc-url bsc_testnet
/// Broadcast only with Owais's explicit yes: add --broadcast (and --verify with ETHERSCAN_API_KEY).
contract DeployTestnet is Script {
    address constant TESTNET_CTF = 0x2827AAef52D71910E8FBad2FfeBC1B6C2DA37743;
    address constant TESTNET_YB_CTF = 0x38BF1cbD66d174bb5F3037d7068E708861D68D7f;
    address constant TESTNET_YB_NR_CTF = 0x26e865CbaAe99b62fbF9D18B55c25B5E079A93D5;

    function run() external returns (ForecastLedger ledger, MockAgentID aid, MockConditionalTokens mockCtf) {
        require(block.chainid == 97, "testnet only");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address keeper = vm.addr(vm.envUint("KEEPER_PRIVATE_KEY"));
        uint256 commitWindow = vm.envOr("COMMIT_WINDOW", uint256(2 hours));
        uint256 revealWindow = vm.envOr("REVEAL_WINDOW", uint256(12 hours));

        vm.startBroadcast(deployerKey);
        aid = new MockAgentID();
        mockCtf = new MockConditionalTokens();
        address[] memory ctfs = new address[](4);
        ctfs[0] = address(mockCtf);
        ctfs[1] = TESTNET_CTF;
        ctfs[2] = TESTNET_YB_CTF;
        ctfs[3] = TESTNET_YB_NR_CTF;
        ledger = new ForecastLedger(address(aid), ctfs, deployer, keeper, commitWindow, revealWindow);
        vm.stopBroadcast();

        console.log("deployer (admin, pauser)", deployer);
        console.log("keeper (round manager)  ", keeper);
        console.log("MockAgentID             ", address(aid));
        console.log("MockConditionalTokens   ", address(mockCtf));
        console.log("ForecastLedger          ", address(ledger));
        console.log("min commit window (s)   ", commitWindow);
        console.log("min reveal window (s)   ", revealWindow);
    }
}
