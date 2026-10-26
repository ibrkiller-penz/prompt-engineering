# 교실 알림판 '단축키' 도우미 끄기·지우기 — 끄기.bat 을 더블클릭하면 이 파일이 돈다
# 켜져 있는 도우미를 끄고, 컴퓨터를 켤 때 저절로 켜지는 등록을 지운다. 복사해 둔 파일(%LOCALAPPDATA%\PeneduBoard)은 남긴다.
# 이 파일은 UTF-8 BOM 으로 저장해야 한다(Windows PowerShell 5.1 이 한글을 깨뜨리지 않게).
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Write-Host "교실 알림판 단축키 도우미 끄기" -ForegroundColor Yellow
$old = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'deck_helper\.ps1' })
foreach ($p in $old) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }
Write-Host "  O 켜져 있던 도우미 $($old.Count)개를 껐어요" -ForegroundColor Green
$vbs = Join-Path ([Environment]::GetFolderPath('Startup')) '교실알림판_단축키도우미.vbs'
if (Test-Path $vbs) { Remove-Item $vbs -Force; Write-Host "  O 저절로 켜지는 등록을 지웠어요" -ForegroundColor Green }
$dir = Join-Path $env:LOCALAPPDATA 'PeneduBoard'
if (Test-Path $dir) { Write-Host "  · 고쳐 둔 프로그램 표가 남도록 $dir 는 지우지 않았어요(필요 없으면 직접 지우세요)" }
Write-Host "  · 보드의 단축키 장은 '도우미와 연결되지 않았습니다'로 보여요. 다시 쓰려면 설치.bat"
