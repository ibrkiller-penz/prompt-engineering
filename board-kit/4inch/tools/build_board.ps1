# 4인치 보드(Waveshare ESP32-S3-Touch-LCD-4 V4.0) 펌웨어 빌드·업로드
#
# 프로젝트 경로에 한글이 있으면 ESP-IDF(CMake)가 경로를 못 읽는다(custom_sdkconfig 로 라이브러리를 다시 컴파일할 때).
# 그래서 firmware 폴더를 영문 경로로 복사해 거기서 빌드한다. 원본은 firmware 폴더다(복사본은 고치지 말 것).
#
#   powershell -ExecutionPolicy Bypass -File tools\build_board.ps1                  # 빌드 + 업로드(보드를 자동으로 찾는다)
#   powershell -ExecutionPolicy Bypass -File tools\build_board.ps1 -Port COM7       # 포트를 직접 지정해 업로드
#   powershell -ExecutionPolicy Bypass -File tools\build_board.ps1 -NoUpload        # 빌드만(보드 없이도 가능)
#   ... -Full                                                                        # 빌드 기록을 화면에 모두 보이기
# 화면에는 결과 몇 줄(RAM·Flash·성공/실패·오류)만 보이고, 전체 기록은 빌드 폴더의 build.log 에 남는다(AI 토큰 절약, 2026-10-25).
#
# 포트를 정하는 순서: -Port  →  환경 변수 PIO_PORT  →  USB 로 꽂힌 보드 자동 찾기(pyserial, VID 303A).
# 첫 빌드는 약 35~45분(ESP-IDF 를 다시 컴파일), 그 뒤에는 약 9분이다.
# 이 파일은 UTF-8 BOM 으로 저장해야 한다(Windows PowerShell 5.1 이 한글을 깨뜨리지 않게).
param(
  [switch]$NoUpload,
  [string]$Port = '',
  [switch]$Full              # 빌드 기록을 화면에 모두 보이기
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:PYTHONIOENCODING = 'utf-8'   # 없으면 esptool 진행 막대 글자에서 cp949 오류로 멈추고 COM 포트를 계속 잡고 있다
$env:PYTHONUTF8 = '1'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'firmware'
$dst = Join-Path $env:USERPROFILE '.pio-build\classroom-board-4inch-src'
if ($dst -match '[^\x00-\x7F]') {
  # 사용자 폴더 이름에 한글이 있으면 영문 경로가 아니다 → C:\pio-build 로 대신한다
  $dst = 'C:\pio-build\classroom-board-4inch-src'
  Write-Host "사용자 폴더에 한글이 있어 $dst 에서 빌드합니다."
}
if (-not (Test-Path (Join-Path $src 'platformio.ini'))) { throw "firmware\platformio.ini 가 없습니다: $src" }
New-Item -ItemType Directory -Force $dst | Out-Null
# 빌드가 만든 설정(sdkconfig.*, managed_components 등)은 지우지 않는다 — 지우면 매번 ESP-IDF 라이브러리를 다시 컴파일한다(약 35분)
robocopy $src $dst /MIR /XD .pio node_modules .dummy managed_components /XF sdkconfig.* CMakeLists.txt build.log /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

$pioArgs = @('-m', 'platformio', 'run', '-d', $dst)
if (-not $NoUpload) {
  if (-not $Port) { $Port = $env:PIO_PORT }
  if (-not $Port) {
    # ESP32-S3 내장 USB(USB-Serial/JTAG)는 VID 303A 로 보인다. 포트를 여는 것이 아니라 목록만 읽는다.
    $Port = (& python -c "import serial.tools.list_ports as l; print(next((p.device for p in l.comports() if p.vid == 0x303A), ''))" 2>$null | Select-Object -First 1)
    if ($Port) { $Port = "$Port".Trim() }
  }
  if (-not $Port) { throw '보드를 찾지 못했습니다. USB 로 연결했는지 확인하고, -Port COM숫자 로 지정하세요(장치 관리자 > 포트에서 확인).' }
  Write-Host "업로드 포트: $Port"
  $pioArgs += @('-t', 'upload', '--upload-port', $Port)
}
Write-Host ("실행: python " + ($pioArgs -join ' '))
if ($Full) { & python @pioArgs; exit $LASTEXITCODE }
# 기록은 파일로(영문 경로라 cmd 로 넘겨도 안전), 화면에는 요약만
$log = Join-Path $dst 'build.log'
Write-Host "빌드 중… (처음이면 35~45분, 그 뒤로 약 9분) 기록: $log"
$quoted = ($pioArgs | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
cmd /c "python $quoted > `"$log`" 2>&1"
$code = $LASTEXITCODE
$lines = Get-Content $log -Encoding UTF8 -ErrorAction SilentlyContinue
$errs = $lines | Where-Object { $_ -match '(error:|Error:|\*\*\* \[|FAILED|No serial data|could not open port|Fatal)' -and $_ -notmatch 'error_capture|cborerror|OTA_STATUS_FAILED|errorstr' } | Select-Object -First 15
$sum = $lines | Where-Object { $_ -match '^(RAM:|Flash:)|Hash of data verified|Hard resetting|^board4inch\s+(SUCCESS|FAILED)' }
$sum | Select-Object -Last 4 | ForEach-Object { Write-Host "  $_" }
if ($code -ne 0) {
  Write-Host "X 빌드/업로드 실패 (아래 줄을 AI에게 붙여 넣으세요)" -ForegroundColor Red
  if ($errs) { $errs | ForEach-Object { Write-Host "  $_" -ForegroundColor Red } } else { $lines | Select-Object -Last 12 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red } }
} else { Write-Host "O 성공" -ForegroundColor Green }
exit $code
