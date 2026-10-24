# Run this yourself in an interactive PowerShell terminal.
# Jev displays each scope and asks you to type a fresh challenge.
# This script never supplies or automatically answers that challenge.
$ErrorActionPreference = 'Stop'
$python = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$jev = 'D:\Antigravity\AI Agent\jev.py'
foreach ($name in @('vera', 'sera', 'lexi', 'mira', 'raka')) {
    Write-Host "Review request for $name (read-only ReadMaker analysis)"
    & $python -B $jev approve --request (Join-Path $PSScriptRoot "$name.request.json")
    if ($LASTEXITCODE -ne 0) { throw "Approval for $name did not complete; stopping." }
}
Write-Host 'Approvals complete. Return to Codex promptly; receipts expire after 15 minutes.'
