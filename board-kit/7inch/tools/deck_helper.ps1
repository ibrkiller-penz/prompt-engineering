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
  word       = 'winword'
  hwp        = 'C:\Program Files (x86)\Hnc\Office 2024\HOffice130\Bin\Hwp.exe'
  desktop    = '#desktop'
}
$StopFile = Join-Path $env:TEMP 'deck_helper.stop'
$LogFile = Join-Path $env:TEMP 'deck_helper.log'
function Log($m) { try { Add-Content -Path $LogFile -Value ("{0:MM-dd HH:mm:ss} {1}" -f (Get-Date), $m) -Encoding UTF8 } catch {} }

function Open-App($key) {
  $t = $Apps[$key]
  if (-not $t) { Log "모르는 단추: $key"; return }
  try {
    if ($t -eq '#desktop') { (New-Object -ComObject Shell.Application).ToggleDesktop() }
    else { Start-Process $t }
    Log "열기: $key"
  } catch { Log "열기 실패: $key ($($_.Exception.Message))" }
}

# CH343/CH340(알림판 보드의 UART 칩) 포트 찾기
function Find-BoardPorts {
  Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'CH34\d' -and $_.Name -match '\((COM\d+)\)' } |
    ForEach-Object { if ($_.Name -match '\((COM\d+)\)') { $Matches[1] } }
}

$ports = @{}      # COM 이름 → SerialPort
$bufs = @{}       # COM 이름 → 받다 만 글
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
    foreach ($name in Find-BoardPorts) {
      if ($ports.ContainsKey($name)) { continue }
      try {
        $sp = New-Object System.IO.Ports.SerialPort $name, 115200
        $sp.DtrEnable = $false; $sp.RtsEnable = $false   # 켤 때 보드가 다시 시작되지 않게
        $sp.ReadTimeout = 50; $sp.WriteTimeout = 500; $sp.NewLine = "`n"
        $sp.Encoding = [System.Text.Encoding]::UTF8
        $sp.Open()
        $ports[$name] = $sp; $bufs[$name] = ''
        Log "포트 잡음: $name"
      } catch { }
    }
  }
  if (($now - $lastBeat).TotalSeconds -ge 5) {      # 컴퓨터가 켜져 있다고 알리기
    $lastBeat = $now
    foreach ($p in @($ports.Keys)) {
      try { $ports[$p].Write("@pc on`n") } catch { try { $ports[$p].Close() } catch {}; $ports.Remove($p); Log "포트 끊김: $p" }
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
          if ($line.StartsWith('@deck ')) { Open-App $line.Substring(6).Trim() }
        }
        if ($bufs[$p].Length -gt 4096) { $bufs[$p] = '' }
      }
    } catch { try { $ports[$p].Close() } catch {}; $ports.Remove($p); Log "포트 끊김: $p" }
  }
  Start-Sleep -Milliseconds 100
}
