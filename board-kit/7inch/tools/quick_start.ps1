# 교실 알림판 7인치 — 한 번에 하기(프로용: AI 토큰을 거의 쓰지 않는다)
#   powershell -ExecutionPolicy Bypass -File tools\quick_start.ps1
#   powershell -ExecutionPolicy Bypass -File tools\quick_start.ps1 -Env board7b -Port COM9    # 묻지 않고 바로
# 차례: 1 프로그램 확인 → 2 보드 종류 → 3 샘플 자료 → 4 Firebase 올리기 → 5 내 값 → 6 빌드 → 7 보드 찾기·굽기 → 8 단축키 도우미(선택)
# 이미 끝난 단계는 건너뛴다. 여러 번 돌려도 된다. 멈추면 빨간 X 줄만 AI에게 붙여 넣으면 된다.
# 이 파일은 UTF-8 BOM 으로 저장해야 한다(Windows PowerShell 5.1 이 한글을 깨뜨리지 않게).
param(
  [string]$Env = '',
  [string]$Port = '',
  [switch]$SkipFirebase
)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$kit = Split-Path -Parent $PSScriptRoot        # 7inch
$root = Split-Path -Parent $kit                # board-kit
$site = Join-Path $root 'common\site'
$local = Join-Path $kit 'firmware\include\board_config.local.h'

function Step($n, $t) { Write-Host ""; Write-Host "[$n] $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host "  O $t" -ForegroundColor Green }
function Bad($t) { Write-Host "  X $t" -ForegroundColor Red }
function Info($t) { Write-Host "  · $t" }
function Ask($q, $def = '') {
  $s = if ($def) { "  $q (그냥 Enter = $def)" } else { "  $q" }
  $a = Read-Host $s
  if ([string]::IsNullOrWhiteSpace($a)) { return $def } else { return $a.Trim() }
}
function Yes($q) { (Ask "$q (y/n)" 'y') -match '^[yYㅛ]' }
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function CQ($s) { $s -replace '\\', '\\' -replace '"', '\"' }   # C 문자열 안전하게

Write-Host "교실 알림판 7인치 — 한 번에 하기" -ForegroundColor Yellow
if ($kit -match '[^\x00-\x7F]' -or $kit -match ' ') { Info "키트 폴더에 한글·빈칸이 있어요. 빌드는 스크립트가 해결하지만 C:\dev 같은 영문 폴더를 권해요." }

# 1. 프로그램 확인
Step 1 '필요한 프로그램 확인'
$need = @('git', 'python', 'node', 'firebase')
$miss = $need | Where-Object { -not (Has $_) }
$pio = $false; if (Has 'python') { & python -m platformio --version *> $null; $pio = ($LASTEXITCODE -eq 0) }
if (-not $pio) { $miss += 'platformio' }
if ($miss.Count) {
  Bad ("없는 것: " + ($miss -join ', '))
  if (Yes '지금 설치할까요?(관리자 허락 창이 뜰 수 있어요)') {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'common\tools\setup.ps1')
    Info '설치가 끝나면 PowerShell 창을 닫고 새로 열어 이 스크립트를 다시 실행하세요.'; exit 1
  } else { exit 1 }
} else { Ok 'Git · Python · Node · Firebase · PlatformIO 모두 있음' }

# 2. 보드 종류
Step 2 '보드 종류'
if (-not $Env) {
  $b = Ask '1) 7인치 800×480   2) 7인치 B 1024×600' '1'
  $Env = if ($b -eq '2') { 'board7b' } else { 'board' }
}
Ok ("빌드 환경: $Env")

# 3. 샘플 자료
Step 3 '시간표 자료(샘플)'
if (Test-Path (Join-Path $site 'public\board\index.json')) { Ok '이미 있음(건너뜀)' }
else {
  Push-Location $root; & node (Join-Path $root 'common\tools\make_sample_data.mjs'); Pop-Location
  if (Test-Path (Join-Path $site 'public\board\index.json')) { Ok '샘플 자료를 만들었어요' } else { Bad '샘플 자료를 만들지 못했어요'; exit 1 }
}

# 4. Firebase 올리기
Step 4 'Firebase 무료 호스팅에 올리기'
$rc = Get-Content (Join-Path $site '.firebaserc') -Raw -Encoding UTF8
$fj = Get-Content (Join-Path $site 'firebase.json') -Raw -Encoding UTF8
$siteId = ''
if ($fj -match '"site"\s*:\s*"([^"]+)"' -and $Matches[1] -ne 'YOUR-SITE-ID') { $siteId = $Matches[1] }
if ($SkipFirebase) { Info '건너뜀(-SkipFirebase)' }
else {
  $who = (& firebase login:list 2>$null) -join ' '
  if ($who -notmatch '@') {
    Info 'Firebase 로그인이 필요해요. 새 창에서 브라우저가 열리면 직접 로그인하세요.'
    Start-Process powershell -ArgumentList '-NoExit', '-Command', 'firebase login' -Wait
  }
  if (-not $siteId) {
    $siteId = Ask 'Firebase 사이트 ID(영문 소문자·숫자·-, 예: myschool-board)'
    $proj = Ask 'Firebase 프로젝트 ID' $siteId
    if (-not $siteId) { Bad '사이트 ID가 없어요'; exit 1 }
    $nb = New-Object Text.UTF8Encoding $false   # BOM 없이(Firebase 도구가 JSON 을 못 읽지 않게)
    [IO.File]::WriteAllText((Join-Path $site '.firebaserc'), ($rc -replace 'YOUR-PROJECT-ID', $proj), $nb)
    [IO.File]::WriteAllText((Join-Path $site 'firebase.json'), ($fj -replace 'YOUR-SITE-ID', $siteId), $nb)
  }
  Push-Location $site
  & firebase deploy --only hosting 2>&1 | Select-String -Pattern 'Deploy complete|Hosting URL|Error' | ForEach-Object { Info $_.Line }
  Pop-Location
  try {
    $r = Invoke-WebRequest "https://$siteId.web.app/board/index.json" -UseBasicParsing -TimeoutSec 15
    if ($r.Content -match '"items"') { Ok "https://$siteId.web.app/board/index.json 이 열려요" } else { Bad 'index.json 내용이 이상해요' }
  } catch { Bad "https://$siteId.web.app/board/index.json 이 아직 안 열려요(몇 분 뒤 다시)" }
}

# 5. 내 값 → board_config.local.h (git·키트에 들어가지 않는 내 파일)
Step 5 '내 값 넣기'
$write = $true
if (Test-Path $local) { $write = -not (Yes '이미 내 값 파일이 있어요. 그대로 쓸까요?') }
if ($write) {
  if (-not $siteId) { $siteId = Ask 'Firebase 사이트 ID' }
  $tt = Ask '처음 볼 시간표 이름(목록의 이름과 똑같이)' '국어A'
  $title = Ask '위쪽 막대 이름(짧게)' '교실'
  Info '급식: 나이스 시도교육청 코드·학교 코드(모르면 Enter — common\docs\02 참고)'
  $atpt = Ask '시도교육청 코드(예: C10)'
  $sch = Ask '학교 코드(숫자 7자리)'
  Info '날씨: 학교 위치(지도에서 위도·경도, 모르면 Enter)'
  $lat = Ask '위도(예: 35.2)'; $lon = Ask '경도(예: 129.08)'
  $sn = Ask '수능 날짜 YYYY-MM-DD(없으면 Enter)'
  $sched = Ask '교장실 모드 학교 일정 사이트 주소(없으면 Enter)'
  $h = @(
    '#pragma once',
    '// 내 값(quick_start.ps1 이 만듦). git·키트에 들어가지 않는다.',
    ('#define BOARD_BASE_URL "https://{0}.web.app/board/"' -f (CQ $siteId)),
    ('#define BOARD_DEFAULT_TT "{0}"' -f (CQ $tt)),
    ('#define BOARD_TITLE "{0}"' -f (CQ $title)),
    ('#define NEIS_ATPT_CODE "{0}"' -f (CQ $atpt)),
    ('#define NEIS_SCHOOL_CODE "{0}"' -f (CQ $sch)),
    ('#define SUNEUNG_DATE "{0}"' -f (CQ $sn)),
    ('#define WEATHER_LAT "{0}"' -f (CQ $lat)),
    ('#define WEATHER_LON "{0}"' -f (CQ $lon)),
    ('#define SCHEDULE_URL "{0}"' -f (CQ $sched))
  ) -join "`n"
  [IO.File]::WriteAllText($local, $h + "`n", (New-Object Text.UTF8Encoding $false))
  Ok "저장: $local"
} else { Ok '그대로 씀' }

# 6. 빌드
Step 6 '빌드(처음이면 25~45분 — 끝까지 기다려 주세요)'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build_board.ps1') -Env $Env -NoUpload
if ($LASTEXITCODE -ne 0) { Bad '빌드 실패 — 위의 빨간 줄을 AI에게 붙여 넣으세요'; exit 1 }

# 7. 보드 찾기·굽기
Step 7 '보드 찾기·굽기'
if (Test-Path (Join-Path $env:TEMP 'deck_helper.stop')) { } else { New-Item -ItemType File (Join-Path $env:TEMP 'deck_helper.stop') | Out-Null; $paused = $true; Start-Sleep 2 }  # 단축키 도우미가 포트를 쥐고 있으면 잠깐 놓게
if (-not $Port) {
  $cands = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match 'CH34\d' -and $_.Name -match '\((COM\d+)\)' } | ForEach-Object { if ($_.Name -match '\((COM\d+)\)') { $Matches[1] } }
  $s3 = @()
  foreach ($c in $cands) { $o = (& python -m esptool --port $c chip-id 2>&1) -join ' '; if ($o -match 'ESP32-S3') { $s3 += $c } }
  if ($s3.Count -eq 0) { Bad '보드를 못 찾았어요(UART 단자 · 데이터 케이블 · 다른 USB 구멍)'; if ($paused) { Remove-Item (Join-Path $env:TEMP 'deck_helper.stop') }; exit 1 }
  $Port = if ($s3.Count -eq 1) { $s3[0] } else { Ask ("보드가 여럿이에요: " + ($s3 -join ', ') + " 중 어느 것?") $s3[0] }
}
Ok "보드: $Port (ESP32-S3)"
if (Yes "$Port 보드에 올릴까요? (저장한 와이파이는 지워지지 않아요)") {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build_board.ps1') -Env $Env -Port $Port
  if ($LASTEXITCODE -ne 0) { Bad '굽기 실패 — 위의 빨간 줄을 AI에게 붙여 넣으세요' } else { Ok '보드에 올렸어요. 화면 [설정] → [찾기]에서 와이파이를 넣으세요.' }
}
if ($paused) { Remove-Item (Join-Path $env:TEMP 'deck_helper.stop') -ErrorAction SilentlyContinue }

# 8. 단축키 도우미(선택)
Step 8 '단축키 도우미(선택: 보드의 단축키 단추로 이 컴퓨터의 프로그램 열기)'
$vbs = Join-Path ([Environment]::GetFolderPath('Startup')) '교실알림판_단축키도우미.vbs'
if (Test-Path $vbs) { Ok '이미 등록됨' }
elseif (Yes '이 컴퓨터를 켤 때 도우미가 창 없이 켜지게 등록할까요?') {
  $helper = Join-Path $PSScriptRoot 'deck_helper.ps1'
  $cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $helper + '"'
  $body = "' 교실 알림판 단축키 도우미(창 없이 켜기). 끄려면 이 파일을 지우세요.`r`nCreateObject(""WScript.Shell"").Run """ + $cmd.Replace('"', '""') + """, 0, False`r`n"
  [IO.File]::WriteAllText($vbs, $body, [Text.Encoding]::Unicode)
  Start-Process wscript.exe -ArgumentList ('"' + $vbs + '"')
  Ok "등록하고 켰어요: $vbs"
  Info '여는 프로그램은 tools\deck_helper.ps1 의 $Apps 표에서 바꿔요.'
}
Write-Host ""; Write-Host "끝! 막히면 빨간 X 줄만 AI에게 붙여 넣으세요." -ForegroundColor Yellow
