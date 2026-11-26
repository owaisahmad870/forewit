# BSC mainnet deploy of ForecastLedger or ForewitScores (Owais's yes required). Loads only the RPC and Etherscan key from .env,
# never prints them; the deployer keystore password is typed at forge's prompt.
param([string]$Script = 'DeployMainnet')  # DeployMainnet (ForecastLedger), DeployScoresMainnet (ForewitScores) or DeployStartMainnet (ForewitStart)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
function Get-EnvValue($name) { (Get-Content "$root\.env" | Where-Object { $_ -match "^$name=" } | Select-Object -First 1).Split('=', 2)[1].Trim() }
$env:BSC_RPC_URL = Get-EnvValue 'RPC_MAINNET_PRIMARY'
$env:ETHERSCAN_API_KEY = Get-EnvValue 'ETHERSCAN_API_KEY'
$env:MAINNET_DEPLOYER = '0x6732027E7f908E274bF4360Ce19cC182F82d008C'
$env:MAINNET_ADMIN = '0xF3b4728B30F0F380d77dE9d025E33680F66591bD'
$env:MAINNET_ROUND_MANAGER = '0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18'
Set-Location "$root\contracts"
& "$HOME\.foundry\bin\forge.exe" script "script/$Script.s.sol" --rpc-url bsc --keystore "$HOME\forewit_keys\deployer" --sender $env:MAINNET_DEPLOYER --broadcast --verify
