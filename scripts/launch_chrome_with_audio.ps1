# Launch Google Chrome with YouTube audio feeding the virtual microphone
$audioPath = (Resolve-Path "frontend\test-assets\counselling_audio.wav").Path
$profileDir = "$env:TEMP\chrome-live-audio-session"

Write-Host "Launching Google Chrome on your screen..." -ForegroundColor Cyan
Write-Host "Audio file: $audioPath" -ForegroundColor Yellow
Write-Host "URL: http://localhost:3000" -ForegroundColor Green

Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList @(
    "http://localhost:3000",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--use-file-for-fake-audio-capture=$audioPath",
    "--user-data-dir=$profileDir"
)

Write-Host "Google Chrome opened successfully!" -ForegroundColor Green

