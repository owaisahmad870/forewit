# Step 2 only: store the keeper key as the GitHub secret MAINNET_KEEPER_PRIVATE_KEY (keeper keystore password). The key is never printed.
$ErrorActionPreference = 'Stop'
$cast = "$HOME\.foundry\bin\cast.exe"
$keeper = '0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18'
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
