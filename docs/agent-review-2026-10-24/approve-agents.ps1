# Historical preparation helper; see README.md before use.
# Run in an interactive PowerShell terminal with a local Jev installation.
# Each request still requires a fresh human challenge.
param(
    [Parameter(Mandatory = $true)]
    [string]$JevPath,
    [string]$PythonCommand = 'python'
)
$ErrorActionPreference = 'Stop'
$jevScript = (Resolve-Path -LiteralPath $JevPath).Path
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
Push-Location -LiteralPath $projectRoot
try {
    foreach ($name in @('vera', 'sera', 'lexi', 'mira', 'raka')) {
        Write-Host "Review request for $name (read-only ReadMaker analysis)"
        & $PythonCommand -B $jevScript approve --request (Join-Path $PSScriptRoot "$name.request.json")
        if ($LASTEXITCODE -ne 0) { throw "Approval for $name did not complete; stopping." }
    }
} finally {
    Pop-Location
}
Write-Host 'Approvals complete. Follow the local tool instructions for receipt validity.'
