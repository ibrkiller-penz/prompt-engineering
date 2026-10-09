# 보드 펌웨어 빌드·업로드 (7인치 교실 알림판)
#
# 왜 복사해서 빌드하나?
#   프로젝트 경로에 한글이 있으면 ESP-IDF(CMake)·링커가 경로를 못 읽는다(custom_sdkconfig 로 라이브러리를 다시 컴파일할 때).
#   그래서 firmware 폴더를 영문 경로 (%USERPROFILE%\.pio-build\penedu-board-7inch-src) 로 복사해 거기서 빌드한다.
#   원본은 firmware 폴더다. 복사본은 고치지 말 것(다음 빌드 때 원본으로 덮어쓴다).
#
# 사용법 (PowerShell, 이 키트의 7inch 폴더에서)
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_board.ps1                 # 빌드 + 업로드(보드 자동 찾기)
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_board.ps1 -Port COM5      # 보드 COM 번호를 직접 지정
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_board.ps1 -NoUpload       # 빌드만(보드 없이도 된다)
#
# COM 번호는 -Port 로 주거나, 환경변수 PIO_PORT 에 넣어 둔다. 둘 다 없으면 USB 시리얼 칩(CH343/CH340 등)을 찾아 본다.
# 처음 한 번은 25~45분 걸린다(ESP-IDF 를 화면 흔들림 방지 설정으로 다시 컴파일한다). 두 번째부터 1~2분.
# 이 파일은 UTF-8 BOM 으로 저장해야 한다(Windows PowerShell 5.1 이 한글을 깨뜨리지 않게).
param(
  [switch]$NoUpload,
  [string]$Port = ''
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$kit = Split-Path -Parent $PSScriptRoot          # 7inch 폴더
$src = Join-Path $kit 'firmware'
$dst = Join-Path $env:USERPROFILE '.pio-build\penedu-board-7inch-src'
if ($dst -match '[^\x00-\x7F]') {
  # 사용자 폴더 이름에 한글이 있으면 영문 경로가 아니다 → C:\pio-build 로 대신한다
  $dst = 'C:\pio-build\penedu-board-7inch-src'
  Write-Host "사용자 폴더에 한글이 있어 $dst 에서 빌드합니다."
}
if (-not (Test-Path (Join-Path $src 'platformio.ini'))) { throw "firmware\platformio.ini 가 없습니다: $src" }

# 업로드할 COM 포트 정하기: -Port > PIO_PORT > 자동(USB 시리얼 칩). 포트를 여는 일은 하지 않고 목록만 본다.
if (-not $NoUpload -and -not $Port) {
  if ($env:PIO_PORT) { $Port = $env:PIO_PORT }
  else {
    try {
      $Port = (& python -c "import serial.tools.list_ports as l;p=[x.device for x in l.comports() if x.vid in (0x1A86,0x303A,0x10C4,0x0403)];print(p[0] if p else '')" 2>$null | Select-Object -First 1)
      if ($Port) { $Port = "$Port".Trim() }
    } catch { $Port = '' }
  }
  if ($Port) { Write-Host "업로드 포트: $Port" } else { Write-Host '업로드 포트를 못 찾았습니다. PlatformIO 가 알아서 찾아 봅니다(안 되면 -Port COM번호).' }
}

New-Item -ItemType Directory -Force $dst | Out-Null
# .pio(이전 빌드 결과)는 지우지 않고 남겨 두어야 두 번째부터 빠르다
robocopy $src $dst /MIR /XD .pio /XF build.log build.done /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 실패 ($LASTEXITCODE)" }

$pioArgs = @('-m', 'platformio', 'run', '-d', $dst)
if (-not $NoUpload) {
  $pioArgs += @('-t', 'upload')
  if ($Port) { $pioArgs += @('--upload-port', $Port) }
}
Write-Host ("실행: python " + ($pioArgs -join ' '))
& python @pioArgs
exit $LASTEXITCODE
