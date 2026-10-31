@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel% equ 0 (
 node preview.mjs
) else (
 if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" preview.mjs
 ) else (
  echo Para abrir la demo local instala Node.js desde https://nodejs.org
  echo Tambien puedes subir la carpeta a GitHub Pages.
 )
)
pause
