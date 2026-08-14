# One-click release 3080 - kills orphan dsh web
Get-NetTCPConnection -LocalPort 3080 -ErrorAction SilentlyContinue | Where-Object State -eq Listen | ForEach-Object {
  Write-Host "Killing PID $($_.OwningProcess) (LISTENING 3080)"
  taskkill /F /PID $_.OwningProcess /T | Out-Null
}
# fallback via netstat
if (-not (Get-NetTCPConnection -LocalPort 3080 -ErrorAction SilentlyContinue | Where State -eq Listen)) {
  Write-Host "3080 is free."
} else {
  Write-Host "Still listening, try running as Administrator."
}
