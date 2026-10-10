# 과학관(온라인 과학 체험관)을 ai-study-science 사이트에 배포합니다.
# 사용법: PowerShell에서 이 파일이 있는 저장소 폴더로 이동한 뒤
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy-science.ps1
# 처음 한 번만 로그인: npx.cmd firebase-tools login

$ErrorActionPreference = "Stop"

# 저장소 루트 기준으로 동작
$Repo = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $Repo "public\science"
$Stage = Join-Path $env:USERPROFILE "sci-deploy"

if (-not (Test-Path $Src)) { throw "과학관 폴더를 찾을 수 없습니다: $Src" }

Write-Host "1/3 배포 폴더 준비: $Stage" -ForegroundColor Cyan
Remove-Item -Recurse -Force $Stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $Stage | Out-Null
Copy-Item -Recurse -Path (Join-Path $Src "*") -Destination $Stage

Set-Content -Path (Join-Path $Stage "firebase.json") -Encoding UTF8 -Value '{ "hosting": { "site": "ai-study-science", "public": ".", "ignore": ["firebase.json", "**/.*", "README.md"] } }'
Set-Content -Path (Join-Path $Stage ".firebaserc") -Encoding UTF8 -Value '{ "projects": { "default": "ai-study-science" } }'

Write-Host "2/3 배포 중..." -ForegroundColor Cyan
Push-Location $Stage
try {
  npx.cmd firebase-tools deploy --only hosting --project ai-study-science
  if ($LASTEXITCODE -ne 0) { throw "배포 실패. 'npx.cmd firebase-tools login' 후 다시 실행해 보세요." }
} finally {
  Pop-Location
}

Write-Host "3/3 완료: https://ai-study-science.web.app" -ForegroundColor Green
