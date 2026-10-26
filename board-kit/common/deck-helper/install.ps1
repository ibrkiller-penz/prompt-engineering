# 교실 알림판 '단축키' 도우미 설치 (7인치·4인치 공통) — 설치.bat 을 더블클릭하면 이 파일이 돈다
#   1) deck_helper.ps1 을 %LOCALAPPDATA%\PeneduBoard 로 복사  2) 컴퓨터를 켤 때 창 없이 켜지게 등록  3) 지금 바로 켜기
#   관리자 권한이 필요 없다. 이미 켜져 있던 도우미는 끄고 새 것으로 바꾼다(두 개가 같은 보드를 잡으면 안 된다).
# 이 파일은 UTF-8 BOM 으로 저장해야 한다(Windows PowerShell 5.1 이 한글을 깨뜨리지 않게).
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function Ok($t) { Write-Host "  O $t" -ForegroundColor Green }
function Bad($t) { Write-Host "  X $t" -ForegroundColor Red }
function Info($t) { Write-Host "  · $t" }

Write-Host "교실 알림판 단축키 도우미 설치 (7인치·4인치 공통)" -ForegroundColor Yellow
# 도우미 원본: 이 폴더(단독 꾸러미) → 키트 안이면 7inch\tools 또는 4inch\tools
$src = @(
  (Join-Path $PSScriptRoot 'deck_helper.ps1'),
  (Join-Path $PSScriptRoot '..\..\7inch\tools\deck_helper.ps1'),
  (Join-Path $PSScriptRoot '..\..\4inch\tools\deck_helper.ps1')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $src) { Bad 'deck_helper.ps1 을 못 찾았어요. 압축을 먼저 풀고 그 폴더에서 설치.bat 을 실행하세요.'; exit 1 }

# 1. 켜져 있는 도우미 끄기
$old = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'deck_helper\.ps1' })
foreach ($p in $old) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }
if ($old.Count) { Info "켜져 있던 도우미 $($old.Count)개를 껐어요"; Start-Sleep 1 }
Remove-Item (Join-Path $env:TEMP 'deck_helper.stop') -ErrorAction SilentlyContinue   # '잠깐 멈춤' 표시가 남아 있으면 지운다

# 2. 복사(고쳐 둔 프로그램 표가 있으면 .bak 으로 남긴다)
$dir = Join-Path $env:LOCALAPPDATA 'PeneduBoard'
New-Item -ItemType Directory -Force $dir | Out-Null
$dst = Join-Path $dir 'deck_helper.ps1'
if ((Test-Path $dst) -and ((Get-FileHash $dst).Hash -ne (Get-FileHash $src).Hash)) {
  Copy-Item $dst "$dst.bak" -Force; Info "예전 도우미는 $dst.bak 으로 남겼어요(프로그램 표를 고쳤었다면 거기서 옮기세요)"
}
if ((Resolve-Path $src).Path -ne $dst) { Copy-Item $src $dst -Force }
Unblock-File $dst -ErrorAction SilentlyContinue
Ok "복사: $dst"

# 3. 컴퓨터를 켤 때 창 없이 켜지게(시작프로그램 폴더에 작은 파일 하나). 키트의 quick_start.ps1 과 같은 이름이라 겹치지 않는다
$vbs = Join-Path ([Environment]::GetFolderPath('Startup')) '교실알림판_단축키도우미.vbs'
$cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $dst + '"'
$body = "' 교실 알림판 단축키 도우미(창 없이 켜기). 끄려면 끄기.bat 을 실행하거나 이 파일을 지우세요.`r`nCreateObject(""WScript.Shell"").Run """ + $cmd.Replace('"', '""') + """, 0, False`r`n"
[IO.File]::WriteAllText($vbs, $body, [Text.Encoding]::Unicode)
Ok '컴퓨터를 켤 때 저절로 켜지게 등록했어요'

# 4. 지금 켜기
Start-Process wscript.exe -ArgumentList ('"' + $vbs + '"')
Start-Sleep 2
$run = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'deck_helper\.ps1' })
if ($run.Count) { Ok '도우미를 켰어요(화면에 창은 안 보여요)' } else { Bad '도우미가 켜지지 않았어요. 학교 보안 프로그램이 막는지 확인하세요.' }

$com = @(Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -match 'VID_1A86|VID_303A' -and $_.Name -match '\((COM\d+)\)' } | ForEach-Object { $_.Name })
if ($com.Count) { Info ("보이는 보드: " + ($com -join ', ')) } else { Info '아직 꽂힌 보드가 안 보여요. 꽂으면 5초 안에 저절로 잡아요(7인치는 UART 단자, 4인치는 USB-C 단자).' }
Write-Host ""
Info "여는 프로그램을 바꾸려면 메모장으로 $dst 의 `$Apps 표를 고치고 컴퓨터를 다시 켜세요(설치.bat 을 다시 돌리면 새 파일로 바뀌고 고친 것은 .bak 에 남아요)."
Info "기록: $env:TEMP\deck_helper.log"
