# 단축키 도우미 exe 만들기 — 윈도우에 들어 있는 .NET Framework 4 컴파일러(csc.exe)만 쓴다(따로 설치할 것 없음)
#   powershell -NoProfile -ExecutionPolicy Bypass -File build_exe.ps1
# 결과: ..\교실알림판_도우미.exe (DeckHelper.cs + icon.ico). DeckHelper.cs 는 C# 5 문법만(이 컴파일러가 그 이상을 모른다).
# 이 파일은 UTF-8 BOM 으로 저장해야 한다(Windows PowerShell 5.1 이 한글을 깨뜨리지 않게).
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw '.NET Framework 4 컴파일러(csc.exe)를 못 찾았어요' }
$out = Join-Path (Split-Path -Parent $PSScriptRoot) '교실알림판_도우미.exe'
& $csc /nologo /codepage:65001 /target:winexe /optimize+ /platform:anycpu `
  "/win32icon:$(Join-Path $PSScriptRoot 'icon.ico')" "/out:$out" `
  /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Management.dll `
  (Join-Path $PSScriptRoot 'DeckHelper.cs')
if ($LASTEXITCODE -ne 0) { throw "컴파일 실패 ($LASTEXITCODE)" }
Write-Host ("O 만듦: $out (" + [math]::Round((Get-Item $out).Length / 1KB) + "KB)") -ForegroundColor Green
