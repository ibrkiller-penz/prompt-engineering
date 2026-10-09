# 교실 알림판 만들기 준비: 필요한 프로그램을 한 번에 설치하고, 잘 깔렸는지 확인표로 보여 준다.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1                 # 설치 + 확인
#   powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1 -CheckOnly      # 확인만(아무것도 안 깐다)
#   powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1 -Prewarm C:\dev\board-kit\7inch
#                                                                  # 보드 첫 빌드를 미리 해 둔다(25~45분, 약 3GB 받아 7GB 로 풀림)
#
# 이미 깔린 것은 건너뛴다. 여러 번 돌려도 된다. 결과표와 기록(setup.log)을 이 파일 옆에 남긴다.
# 이 파일은 UTF-8 BOM 으로 저장해야 한다(Windows PowerShell 5.1 이 한글을 깨뜨리지 않게).
#
# 설치하는 것(각각 한 줄 설명):
#   Git            : 파일 변경 기록·내려받기 도구
#   Python 3.12    : 빌드 도구(PlatformIO)와 보조 스크립트를 돌리는 언어
#   Node.js LTS    : 샘플 자료 만들기·글꼴 만들기·Firebase 도구를 돌리는 언어
#   GitHub CLI     : 명령으로 GitHub 를 쓰는 도구(선택 — 저장소를 쓰지 않으면 안 써도 된다)
#   PlatformIO     : ESP32 보드용 프로그램을 컴파일·업로드하는 도구
#   esptool        : 보드 칩 정보 확인·굽기 도구
#   pyserial       : 보드의 시리얼(USB) 기록을 읽는 파이썬 라이브러리
#   Pillow         : 날씨 그림을 그리는 파이썬 라이브러리
#   Firebase CLI   : 시간표 파일을 Firebase 무료 호스팅에 올리는 도구
param(
  [switch]$CheckOnly,
  [switch]$WithVSCode,
  [string]$Prewarm = '',
  [string]$LogDir = ''
)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$log = Join-Path $(if ($LogDir) { $LogDir } else { $PSScriptRoot }) 'setup.log'
function Log($m) { $l = "{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Add-Content -LiteralPath $log $l -Encoding utf8; Write-Host $l }
function RefreshPath {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Ver($block) { try { $v = (& $block 2>$null | Select-Object -First 1); if ($v) { "$v".Trim() } else { '' } } catch { '' } }

Log "=== 준비 시작 (CheckOnly=$CheckOnly) ==="

# ── 1) 프로그램 (winget) ──
$apps = @(
  @{ id = 'Git.Git';             cmd = 'git';    name = 'Git' },
  @{ id = 'Python.Python.3.12';  cmd = 'python'; name = 'Python 3.12' },
  @{ id = 'OpenJS.NodeJS.LTS';   cmd = 'node';   name = 'Node.js LTS' },
  @{ id = 'GitHub.cli';          cmd = 'gh';     name = 'GitHub CLI' }
)
if ($WithVSCode) { $apps += @{ id = 'Microsoft.VisualStudioCode'; cmd = 'code'; name = 'VS Code' } }
if (-not $CheckOnly) {
  if (-not (Has 'winget')) { Log '!! winget 이 없습니다. Microsoft Store 에서 "앱 설치 관리자"를 설치한 뒤 다시 실행하세요.'; exit 1 }
  foreach ($a in $apps) {
    if (Has $a.cmd) { Log "건너뜀: $($a.name) (이미 있음)"; continue }
    Log "설치: $($a.name)"
    winget install --id $a.id -e --silent --accept-source-agreements --accept-package-agreements | Out-Null
    RefreshPath
  }
}
RefreshPath

# ── 2) Python 도구 (보드 빌드·굽기·시리얼 기록·그림) ──
$pyPkgs = 'platformio', 'esptool', 'pyserial', 'pillow'
if (-not $CheckOnly -and (Has 'python')) {
  Log 'Python 도구 설치/갱신'
  python -m pip install --upgrade --quiet pip 2>$null | Out-Null
  python -m pip install --upgrade --quiet @pyPkgs 2>&1 | Out-Null
}

# ── 3) Firebase CLI (npm) ──
if (-not $CheckOnly -and (Has 'npm') -and -not (Has 'firebase')) {
  Log 'Firebase CLI 설치'
  & npm.cmd install -g firebase-tools --silent 2>&1 | Out-Null
  RefreshPath
}

# ── 4) 보드 첫 빌드 미리 하기(선택) ──
# -Prewarm 에는 키트의 7inch 폴더(또는 4inch 폴더)를 준다. 그 안의 tools\build_board.ps1 -NoUpload 를 돌린다.
if ($Prewarm) {
  $bb = Join-Path $Prewarm 'tools\build_board.ps1'
  if (-not (Test-Path $bb)) { Log "!! tools\build_board.ps1 이 없습니다: $Prewarm  (키트의 7inch 폴더 경로를 주세요)" }
  else {
    Log "보드 첫 빌드 시작(25~45분): $Prewarm"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $bb -NoUpload 2>&1 | Select-Object -Last 8 | ForEach-Object { Log "  $_" }
  }
}

# ── 5) 확인표 ──
$rows = @()
function Row($what, $ok, $detail) { $script:rows += [pscustomobject]@{ 확인 = $(if ($ok) { 'O' } else { 'X' }); 항목 = $what; 내용 = $detail } }
foreach ($a in $apps) {
  $v = switch ($a.cmd) { 'git' { Ver { git --version } } 'python' { Ver { python --version } } 'node' { Ver { node --version } } 'gh' { Ver { gh --version } } 'code' { Ver { code --version } } }
  Row $a.name ([bool]$v) $v
}
$pio = Ver { python -m platformio --version }; Row 'PlatformIO' ([bool]$pio) $pio
$est = Ver { python -m esptool version }; Row 'esptool' ([bool]$est) $est
$libs = Ver { python -c "import serial,PIL;print('pyserial · Pillow')" }; Row 'Python 라이브러리' ([bool]$libs) $libs
$fb = Ver { firebase.cmd --version }; Row 'Firebase CLI' ([bool]$fb) $fb
$gname = Ver { git config --global user.name }; Row 'git 이름·메일' ([bool]$gname) $(if ($gname) { "$gname <$(git config --global user.email)>" } else { 'git config --global user.name "영문이름" 과 user.email 을 정하세요' })
$ghAuth = (gh auth status 2>&1 | Out-String) -match 'Logged in'; Row 'GitHub 로그인(선택)' $ghAuth $(if ($ghAuth) { 'gh auth status 확인됨' } else { '저장소를 쓸 때만: gh auth login' })
$fbAuth = (firebase.cmd login:list 2>&1 | Out-String) -match 'Logged in as'; Row 'Firebase 로그인' $fbAuth $(if ($fbAuth) { 'firebase login:list 확인됨' } else { 'firebase login 을 실행하세요(브라우저가 열린다. 본인이 직접)' })
$dev = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -match 'VID_1A86' } | Select-Object -First 1
Row '보드 연결(CH343)' ([bool]$dev) $(if ($dev) { "$($dev.FriendlyName) $($dev.Status)" } else { '보드를 UART 단자에 데이터용 USB-C 케이블로 꽂고 다시 확인. 안 잡히면 CH343 드라이버(WCH) 설치' })
$free = [math]::Round((Get-PSDrive C).Free / 1GB)
Row '디스크 여유(C:)' ($free -ge 15) "${free}GB (15GB 이상 필요: ESP32 도구만 약 7GB)"

$rows | Format-Table -AutoSize | Out-String -Width 200 | Tee-Object -Variable table | Write-Host
Add-Content -LiteralPath $log $table -Encoding utf8
$bad = @($rows | Where-Object { $_.확인 -eq 'X' }).Count
Log $(if ($bad) { "=== 끝: 확인 필요 $bad 개 (위 표의 X) ===" } else { '=== 끝: 모두 준비됨 ===' })
