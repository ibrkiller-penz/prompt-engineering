# 탭덱(예전 이름 '단축키 도우미') 끄기·지우기 — 끄기.bat 을 더블클릭하면 이 파일이 돈다
# 켜져 있는 탭덱을 끄고, 컴퓨터를 켤 때 저절로 켜지는 바로 가기를 지운다. 꾸민 설정(%LOCALAPPDATA%\PeneduBoard)은 물어보고 지운다.
# 이 파일은 UTF-8 BOM 으로 저장해야 한다(Windows PowerShell 5.1 이 한글을 깨뜨리지 않게).
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Write-Host "탭덱 끄기·지우기" -ForegroundColor Yellow
$exe = @(Get-Process -Name '탭덱', '교실알림판_도우미' -ErrorAction SilentlyContinue)   # 새 이름 + 예전 이름
foreach ($p in $exe) { try { $p.Kill(); $p.WaitForExit(3000) | Out-Null } catch {} }
Write-Host "  O 켜져 있던 탭덱 $($exe.Count)개를 껐어요" -ForegroundColor Green
# 저절로 켜기: exe 판은 시작프로그램 바로 가기. 예전 판의 등록(레지스트리·vbs)도 함께 지운다
$startup = [Environment]::GetFolderPath('Startup')
foreach ($f in '탭덱.lnk', '교실알림판 도우미.lnk', '교실알림판_단축키도우미.vbs') {
  $p = Join-Path $startup $f
  if (Test-Path $p) { Remove-Item $p -Force; Write-Host "  O 저절로 켜지는 등록을 지웠어요($f)" -ForegroundColor Green }
}
Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'PeneduBoardDeckHelper' -ErrorAction SilentlyContinue
foreach ($m in '탭덱.lnk', '교실알림판 도우미.lnk') {
  $menu = Join-Path ([Environment]::GetFolderPath('Programs')) $m
  if (Test-Path $menu) { Remove-Item $menu -Force; Write-Host "  O 시작 메뉴 바로 가기를 지웠어요" -ForegroundColor Green }
}
$dir = Join-Path $env:LOCALAPPDATA 'PeneduBoard'
if (Test-Path $dir) {
  $a = Read-Host "  꾸민 단축키 설정과 탭덱 파일($dir)도 지울까요? (y = 지움, 그냥 엔터 = 남김)"
  if ($a -eq 'y') { Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue; Write-Host "  O 지웠어요" -ForegroundColor Green }
  else { Write-Host "  · 남겨 두었어요(다시 깔면 꾸민 칸이 그대로 살아나요)" }
}
Write-Host "  · 보드의 단축키 장은 '탭덱과 연결되지 않았습니다'로 보여요. 다시 쓰려면 탭덱.exe 를 켜세요"
