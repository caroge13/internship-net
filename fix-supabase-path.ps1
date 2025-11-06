# Fix Supabase PATH issue
# Run this script in PowerShell, then close and reopen your terminal

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$scoopShims = "$env:USERPROFILE\scoop\shims"

if ($userPath -notlike "*scoop*shims*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$scoopShims", "User")
    Write-Host "✅ Added Scoop shims to PATH permanently"
    Write-Host "⚠️  Please close and reopen your terminal/PowerShell window for changes to take effect"
} else {
    Write-Host "✅ Scoop shims already in PATH"
}

Write-Host "`nAfter restarting terminal, test with: supabase --version"

