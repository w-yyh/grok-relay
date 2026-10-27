$ErrorActionPreference = 'Stop'
$bridgeEncryptedBytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
$bridgePlainBytes = [Security.Cryptography.ProtectedData]::Unprotect($bridgeEncryptedBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[Console]::Out.Write([Convert]::ToBase64String($bridgePlainBytes))
[Array]::Clear($bridgePlainBytes, 0, $bridgePlainBytes.Length)
