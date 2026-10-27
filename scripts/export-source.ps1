param([Parameter(Mandatory = $true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$bridgeSourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$bridgePackage = Get-Content -LiteralPath (Join-Path $bridgeSourceRoot 'package.json') -Raw | ConvertFrom-Json
$bridgeEntries = @($bridgePackage.files) + @('package.json', 'package-lock.json', '.gitignore')
$bridgeFiles = foreach ($entry in $bridgeEntries) {
    $entryPath = [IO.Path]::GetFullPath((Join-Path $bridgeSourceRoot $entry))
    if (-not $entryPath.StartsWith($bridgeSourceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Entry outside source root' }
    $item = Get-Item -LiteralPath $entryPath
    if ($item.PSIsContainer) { Get-ChildItem -LiteralPath $item.FullName -File -Recurse } else { $item }
}
$bridgeOutput = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $bridgeOutput) { throw 'Destination already exists; choose a new filename.' }
$stream = [IO.File]::Open($bridgeOutput, [IO.FileMode]::CreateNew)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in ($bridgeFiles | Sort-Object FullName -Unique)) {
        $relative = [IO.Path]::GetRelativePath($bridgeSourceRoot, $file.FullName).Replace('\', '/')
        if ($relative -match '(^|/)(state|node_modules|gbot-package|work|panel-fixture-[^/]+)(/|$)' -or $relative -in @('contacts.json','runtime.local.json')) { throw 'Local data found in export entries' }
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, 'grok-relay/' + $relative) | Out-Null
    }
} finally { $archive.Dispose(); $stream.Dispose() }
Write-Output $bridgeOutput
