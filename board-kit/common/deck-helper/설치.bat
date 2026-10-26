@echo off
chcp 65001 >nul
if not exist "%~dp0install.ps1" (
  echo [X] 압축을 먼저 풀고, 푼 폴더에서 다시 실행하세요.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
