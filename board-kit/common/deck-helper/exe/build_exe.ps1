# 탭덱(TapDeck, 예전 이름 단축키 도우미) exe 만들기 — 윈도우에 들어 있는 .NET Framework 4 컴파일러(csc.exe)만 쓴다(따로 설치할 것 없음)
#   powershell -NoProfile -ExecutionPolicy Bypass -File build_exe.ps1
# 결과: ..\탭덱.exe (*.cs + icon.ico + 기본 그림 16개). 소스는 C# 5 문법만(이 컴파일러가 그 이상을 모른다).
# 이 파일은 UTF-8 BOM 으로 저장해야 한다(Windows PowerShell 5.1 이 한글을 깨뜨리지 않게).
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw '.NET Framework 4 컴파일러(csc.exe)를 못 찾았어요' }
$out = Join-Path (Split-Path -Parent $PSScriptRoot) '탭덱.exe'
# 소스: DeckHelper.cs(통신) + DeckConfig.cs(deck.json) + DeckIcons.cs(아이콘) + DeckForm.cs('단축키 꾸미기' 창) + 화면 부품(DeckTheme·DeckControls·DeckBoardView·DeckActionList·DeckInspector) + DeckPreview.cs(--preview 그림)
$src = 'DeckHelper.cs', 'DeckConfig.cs', 'DeckIcons.cs', 'DeckForm.cs', 'DeckLibrary.cs', 'DeckFonts.cs', 'DeckTheme.cs', 'DeckControls.cs', 'DeckBoardView.cs', 'DeckActionList.cs', 'DeckInspector.cs', 'DeckPreview.cs', 'DeckActions.cs', 'DeckDialogs.cs', 'DeckTour.cs' | ForEach-Object { Join-Path $PSScriptRoot $_ }
# 기본 그림 16개를 exe 안에 묻는다(처음 켤 때 %LOCALAPPDATA%\PeneduBoard\icons\기본 에 풀림). 없으면 7inch\tools\export_deck_icons.py 로 만든다
$icons = Join-Path (Split-Path -Parent $PSScriptRoot) 'icons\기본'
$keys = 'explorer','claude','gemini','gpt','cmd','powershell','neis','naver','youtube','coolmsg','kakao','excel','ppt','close','hwp','desktop'
$res = foreach ($k in $keys) {
  $f = Join-Path $icons "$k.png"
  if (-not (Test-Path $f)) { throw "기본 그림이 없어요: $f (python 7inch\tools\export_deck_icons.py)" }
  "/resource:$f,deck.$k.png"
}
# 아이콘 모음(icons\모음 의 PNG·목록.json, 테마 6가지)을 lib.zip 하나로 묶어 exe 안에 묻는다(처음 켤 때 icons\모음 에 풀림). 없으면 library_src\make_icon_library.py
$lib = Join-Path (Split-Path -Parent $PSScriptRoot) 'icons\모음'
$zip = Join-Path $env:TEMP 'penedu_deck_lib.zip'
if (Test-Path $zip) { Remove-Item $zip }
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$za = [IO.Compression.ZipFile]::Open($zip, 'Create')
Get-ChildItem $lib -Recurse -File | Where-Object { $_.Extension -in '.png', '.json' } | ForEach-Object {
  $rel = $_.FullName.Substring($lib.Length + 1).Replace('\', '/')
  [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($za, $_.FullName, $rel, 'Optimal')
}
$za.Dispose()
$res = @($res) + "/resource:$zip,deck.lib.zip"
# 프로그램 글꼴: 에스코어 드림 3 Light·4 Regular·5 Medium(공식 OTF 그대로 — 라이선스상 파일 수정 금지, fonts\LICENSE_SCDream.txt). DeckFonts.cs 가 읽는다
foreach ($n in 3, 4, 5) {
  $f = Join-Path $PSScriptRoot "fonts\SCDream$n.otf"
  if (-not (Test-Path $f)) { throw "글꼴 파일이 없어요: $f (s-core.co.kr 에서 받은 S-Core_Dream_OTF.zip 의 것을 그대로)" }
  $res = @($res) + "/resource:$f,deck.font$n"
}
# 글꼴 사용 조건 글(더보기 → 글꼴 안내에서 보여 줌)
$lic = Join-Path $PSScriptRoot 'fonts\LICENSE_SCDream.txt'
if (-not (Test-Path $lic)) { throw "글꼴 사용 조건 파일이 없어요: $lic" }
$res = @($res) + "/resource:$lic,deck.fontlicense"
# 설명서(HTML): manual\사용설명서.html + img + img2 + 글꼴 을 manual.zip 하나로 묻는다(꾸미기 창 [설명서] → 도우미 폴더에 풀어 브라우저로 연다)
$man = Join-Path (Split-Path -Parent $PSScriptRoot) 'manual'
if (Test-Path (Join-Path $man '사용설명서.html')) {
  $mzip = Join-Path $env:TEMP 'penedu_deck_manual.zip'
  if (Test-Path $mzip) { Remove-Item $mzip }
  $mz = [IO.Compression.ZipFile]::Open($mzip, 'Create')
  # 글꼴 경로: 저장소에서는 ../exe/fonts/, 풀린 곳에서는 fonts/
  $html = [IO.File]::ReadAllText((Join-Path $man '사용설명서.html'), [Text.Encoding]::UTF8).Replace('../exe/fonts/', 'fonts/')
  $e = $mz.CreateEntry('사용설명서.html', 'Optimal'); $w = New-Object IO.StreamWriter($e.Open(), (New-Object Text.UTF8Encoding($false))); $w.Write($html); $w.Dispose()
  foreach ($wf in 'web.css', 'web.js') { $f = Join-Path $man $wf; if (Test-Path $f) { [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($mz, $f, $wf, 'Optimal') } }
  foreach ($sub in 'img', 'img2') {
    $d = Join-Path $man $sub
    if (Test-Path $d) { Get-ChildItem $d -File | ForEach-Object { [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($mz, $_.FullName, "$sub/" + $_.Name, 'Optimal') } }
  }
  Get-ChildItem (Join-Path $PSScriptRoot 'fonts') -File | ForEach-Object { [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($mz, $_.FullName, 'fonts/' + $_.Name, 'Optimal') }
  $mz.Dispose()
  $res = @($res) + "/resource:$mzip,deck.manual.zip"
}
& $csc /nologo /codepage:65001 /target:winexe /optimize+ /platform:anycpu `
  "/win32icon:$(Join-Path $PSScriptRoot 'icon.ico')" "/out:$out" `
  /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Management.dll /r:System.Core.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll `
  $res $src
if ($LASTEXITCODE -ne 0) { throw "컴파일 실패 ($LASTEXITCODE)" }
Write-Host ("O 만듦: $out (" + [math]::Round((Get-Item $out).Length / 1KB) + "KB)") -ForegroundColor Green
