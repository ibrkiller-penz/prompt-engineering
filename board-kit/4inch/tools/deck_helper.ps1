# 교실 알림판 '단축키' 도우미 (컴퓨터에서 켜 두는 작은 프로그램)
#   보드의 UART 선(CH343)으로 오는 '@deck 이름' 줄을 받아 프로그램·사이트를 연다.
#   5초마다 보드에 '@pc on' 을 보내 "컴퓨터가 켜져 있다"고 알려 준다(컴퓨터가 꺼지면 보드가 화면을 끈다).
#   켜기: powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File deck_helper.ps1
#   잠깐 멈추기(보드에 펌웨어를 올릴 때): %TEMP%\deck_helper.stop 파일을 만들면 포트를 놓고 기다린다. 지우면 다시 잡는다.
#   어떤 프로그램을 열지는 아래 $Apps 표에서 고친다(학교 컴퓨터마다 설치 위치가 다를 수 있다).

$ErrorActionPreference = 'Continue'
$Apps = [ordered]@{
  explorer   = 'explorer.exe'
  claude     = 'claude:'
  gemini     = 'https://gemini.google.com'
  gpt        = 'https://chatgpt.com'
  cmd        = 'cmd.exe'
  powershell = 'powershell.exe'
  neis       = 'https://idp1-pen.neis.go.kr:9443/Login_Server/generateFP.jsp'
  naver      = 'https://www.naver.com'
  youtube    = 'https://www.youtube.com'
  coolmsg    = 'C:\Program Files (x86)\CoolMessenger Gentoo\CoolMessenger.exe'
  kakao      = 'C:\Program Files\Kakao\KakaoTalk\KakaoTalk.exe'
  excel      = 'excel'
  ppt        = 'powerpnt'
  close      = '#altf4'
  hwp        = 'C:\Program Files (x86)\Hnc\Office 2024\HOffice130\Bin\Hwp.exe'
  desktop    = '#desktop'
}
$StopFile = Join-Path $env:TEMP 'deck_helper.stop'
$LogFile = Join-Path $env:TEMP 'deck_helper.log'
function Log($m) { try { Add-Content -Path $LogFile -Value ("{0:MM-dd HH:mm:ss} {1}" -f (Get-Date), $m) -Encoding UTF8 } catch {} }

# 열었으면 $true, 못 열었으면(모르는 단추·프로그램 없음) $false — 보드에 '@deck ok 키' / '@deck fail 키' 로 알려 준다
function Open-App($key) {
  $t = $Apps[$key]
  if (-not $t) { Log "모르는 단추: $key"; return $false }
  $ok = $false
  try {
    if ($t -eq '#desktop') { [void](New-Object -ComObject Shell.Application).ToggleDesktop() }
    elseif ($t -eq '#altf4') { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{F4}') }   # 맨 앞 창 닫기
    else { Start-Process $t -ErrorAction Stop }
    Log "열기: $key"; $ok = $true
  } catch { Log "열기 실패: $key ($($_.Exception.Message))" }
  return $ok
}

# 알림판일 수 있는 포트: 7인치(CH343/CH340, VID 1A86) · 4인치(칩 내장 USB, VID 303A)
# 303A 는 다른 ESP32(예: 시계)일 수도 있어서, 열어 보고 '@board ok' 로 답하는 포트만 쥔다(아니면 놓는다).
# 처음 답이 없으면 1분 뒤 한 번 더 본다(켠 직후 자료를 받느라 늦은 알림판), 두 번째부터는 10분 쉰다(다른 장치를 자꾸 잡지 않게, 2026-10-26).
function Find-BoardPorts {
  Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue |
    Where-Object { $_.DeviceID -match 'VID_1A86|VID_303A' -and $_.Name -match '\((COM\d+)\)' } |
    ForEach-Object { if ($_.Name -match '\((COM\d+)\)') { $Matches[1] } }
}

$ports = @{}      # COM 이름 → SerialPort
$bufs = @{}       # COM 이름 → 받다 만 글
$okp = @{}        # COM 이름 → '@board ok' 를 받았나
$opened = @{}     # COM 이름 → 연 때
$skip = @{}       # COM 이름 → 이때까지 다시 열지 않음(알림판이 아닌 포트)
$fails = @{}      # COM 이름 → 잇달아 답이 없던 횟수(알림판으로 확인되거나 뽑히면 지운다)
$lastBeat = [datetime]::MinValue
$lastScan = [datetime]::MinValue
Log '도우미 시작'
while ($true) {
  if (Test-Path $StopFile) {
    foreach ($p in @($ports.Keys)) { try { $ports[$p].Close() } catch {}; $ports.Remove($p); Log "포트 놓음(멈춤): $p" }
    Start-Sleep -Seconds 1; continue
  }
  $now = Get-Date
  if (($now - $lastScan).TotalSeconds -ge 5) {      # 새로 꽂은 보드 잡기
    $lastScan = $now
    $present = @(Find-BoardPorts)
    foreach ($k in @($fails.Keys)) { if ($present -notcontains $k) { $fails.Remove($k) } }   # 뽑았다 꽂으면 다시 처음부터
    foreach ($name in $present) {
      if ($ports.ContainsKey($name)) { continue }
      if ($skip.ContainsKey($name) -and $now -lt $skip[$name]) { continue }
      try {
        $sp = New-Object System.IO.Ports.SerialPort $name, 115200
        $sp.DtrEnable = $false; $sp.RtsEnable = $false   # 켤 때 보드가 다시 시작되지 않게
        $sp.ReadTimeout = 50; $sp.WriteTimeout = 500; $sp.NewLine = "`n"
        $sp.Encoding = [System.Text.Encoding]::UTF8
        $sp.Open()
        $ports[$name] = $sp; $bufs[$name] = ''; $okp[$name] = $false; $opened[$name] = $now
        $sp.Write("@pc on`n")
        Log "포트 열어 봄: $name"
      } catch { }
    }
  }
  if (($now - $lastBeat).TotalSeconds -ge 5) {      # 컴퓨터가 켜져 있다고 알리기
    $lastBeat = $now
    foreach ($p in @($ports.Keys)) {
      try { $ports[$p].Write("@pc on`n") } catch { try { $ports[$p].Close() } catch {}; $ports.Remove($p); Log "포트 끊김: $p" }
    }
  }
  foreach ($p in @($ports.Keys)) {                  # 40초 안에 답이 없으면 알림판이 아니다(켠 직후 받는 중에는 답이 늦다) → 놓기
    if (-not $okp[$p] -and ($now - $opened[$p]).TotalSeconds -ge 40) {
      try { $ports[$p].Close() } catch {}; $ports.Remove($p); $fails[$p] = 1 + [int]$fails[$p]; $wait = if ($fails[$p] -ge 2) { 10 } else { 1 }; $skip[$p] = $now.AddMinutes($wait); Log "알림판 아님(답 없음, ${wait}분 뒤 다시): $p"
    }
  }
  foreach ($p in @($ports.Keys)) {                  # 보드가 보낸 줄 읽기
    try {
      $s = $ports[$p].ReadExisting()
      if ($s) {
        $bufs[$p] += $s
        while ($bufs[$p].Contains("`n")) {
          $k = $bufs[$p].IndexOf("`n")
          $line = $bufs[$p].Substring(0, $k).Trim()
          $bufs[$p] = $bufs[$p].Substring($k + 1)
          if ($line -eq '@board ok') { if (-not $okp[$p]) { $okp[$p] = $true; $fails.Remove($p); Log "알림판 확인: $p" } }
          elseif ($line.StartsWith('@deck ')) {
            $okp[$p] = $true
            $key = $line.Substring(6).Trim()
            $r = @(Open-App $key)[-1]                   # 결과를 보드에 돌려준다(보드 화면에 '열었습니다' / '열지 못했습니다')
            try { $ports[$p].Write($(if ($r -eq $true) { "@deck ok $key`n" } else { "@deck fail $key`n" })) } catch {}
          }
          elseif ($line -match '^(sync|reset reason|health|download|index|where|schedule|weather|meal|air|heap|pc helper|backlight|restart)') {
            # 보드 기록 중 중요한 줄만 %TEMP%\board_COMx.log 에 남긴다('어젯밤에 무슨 일이 있었나'). 1MB 넘으면 .old 로 바꾼다
            try {
              $bl = Join-Path $env:TEMP "board_$p.log"
              if ((Test-Path $bl) -and (Get-Item $bl).Length -gt 1MB) { Move-Item $bl "$bl.old" -Force }
              Add-Content -Path $bl -Value ("{0:MM-dd HH:mm:ss} {1}" -f (Get-Date), $line) -Encoding UTF8
            } catch {}
          }
        }
        if ($bufs[$p].Length -gt 4096) { $bufs[$p] = '' }
      }
    } catch { try { $ports[$p].Close() } catch {}; $ports.Remove($p); Log "포트 끊김: $p" }
  }
  Start-Sleep -Milliseconds 100
}
