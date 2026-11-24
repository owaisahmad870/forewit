# One time mainnet keeper setup (Owais's yes, 24 Nov 2026). Two password prompts:
# 1. deployer keystore: forwards 0.0048 BNB from DEPLOYER to KEEPER;
# 2. keeper keystore: stores the keeper key as the GitHub secret MAINNET_KEEPER_PRIVATE_KEY. The key is never printed.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$cast = "$HOME\.foundry\bin\cast.exe"
$rpc = (Get-Content "$root\.env" | Where-Object { $_ -match '^RPC_MAINNET_PRIMARY=' } | Select-Object -First 1).Split('=', 2)[1].Trim()
$keeper = '0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18'

Write-Host 'Step 1 of 2: deployer keystore password (forwards 0.0048 BNB to the keeper)'
& $cast send $keeper --value 0.0048ether --rpc-url $rpc --keystore "$HOME\forewit_keys\deployer" --from 0x6732027E7f908E274bF4360Ce19cC182F82d008C --gas-price 0.05gwei | Select-String 'transactionHash|status'

Write-Host 'Step 2 of 2: keeper keystore password (stores the key as a GitHub secret)'
$out = & $cast wallet decrypt-keystore keeper -k "$HOME\forewit_keys"
if (($out -join ' ') -match '(0x[0-9a-fA-F]{64})') {
  $k = $Matches[1]
  & $cast wallet address $k | Out-Null
  if ((& $cast wallet address $k) -ne $keeper) { throw 'decrypted key does not match the KEEPER address' }
  gh secret set MAINNET_KEEPER_PRIVATE_KEY -R owaisahmad870/forewit --body $k
  Remove-Variable k, out
  Write-Host 'Keeper secret set.'
} else { throw 'could not decrypt the keeper keystore' }
