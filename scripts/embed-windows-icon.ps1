param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][string]$Icon)
$ErrorActionPreference = 'Stop'
# Embed the same icon into the PE resource table for Explorer, shortcuts and taskbar.
if (-not ('GrokRelayBuild.IconResources' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace GrokRelayBuild {
    public static class IconResources {
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
        public static extern IntPtr BeginUpdateResource(string file, bool deleteExisting);
        [DllImport("kernel32.dll", SetLastError=true)]
        public static extern bool UpdateResource(IntPtr handle, IntPtr type, IntPtr name, ushort language, byte[] data, uint size);
        [DllImport("kernel32.dll", SetLastError=true)]
        public static extern bool EndUpdateResource(IntPtr handle, bool discard);
    }
}
'@
}
$bytes = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Icon).Path)
if ([BitConverter]::ToUInt16($bytes, 2) -ne 1) { throw 'Expected an ICO file.' }
$count = [BitConverter]::ToUInt16($bytes, 4)
$group = [IO.MemoryStream]::new()
$writer = [IO.BinaryWriter]::new($group)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$count)
$handle = [GrokRelayBuild.IconResources]::BeginUpdateResource((Resolve-Path -LiteralPath $Executable).Path, $false)
if ($handle -eq [IntPtr]::Zero) { throw 'Cannot open executable resources.' }
$success = $false
try {
    for ($i=0; $i -lt $count; $i++) {
        $entry = 6 + $i*16
        $length = [BitConverter]::ToUInt32($bytes, $entry+8)
        $offset = [BitConverter]::ToUInt32($bytes, $entry+12)
        $payload = [byte[]]::new($length)
        [Array]::Copy($bytes, $offset, $payload, 0, $length)
        if (-not [GrokRelayBuild.IconResources]::UpdateResource($handle, [IntPtr]3, [IntPtr]($i+1), 0, $payload, $length)) { throw 'Cannot write icon image.' }
        $writer.Write($bytes, $entry, 12)
        $writer.Write([uint16]($i+1))
    }
    $resource = $group.ToArray()
    if (-not [GrokRelayBuild.IconResources]::UpdateResource($handle, [IntPtr]14, [IntPtr]1, 0, $resource, $resource.Length)) { throw 'Cannot write icon group.' }
    $success = $true
} finally {
    $completed = [GrokRelayBuild.IconResources]::EndUpdateResource($handle, -not $success)
    $writer.Dispose(); $group.Dispose()
    if (-not $completed) { throw 'Cannot finalize executable resources.' }
}
