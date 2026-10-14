@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Criando ambiente virtual...
  py -m venv .venv
  if errorlevel 1 goto :error
)

echo Instalando/atualizando dependencias...
call .venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto :error

set "PORT="
for %%P in (8000 8001 8002 8003 8004 8005) do (
  netstat -ano | findstr /R /C:":%%P .*LISTENING" >nul
  if errorlevel 1 if not defined PORT set "PORT=%%P"
)

if not defined PORT (
  echo.
  echo Nao foi possivel encontrar uma porta livre entre 8000 e 8005.
  echo Feche outros servidores locais e tente novamente.
  goto :port_error
)

echo.
echo Blue Chip iniciado em: http://127.0.0.1:%PORT%
echo Painel administrativo: http://127.0.0.1:%PORT%/admin
if not "%PORT%"=="8000" echo A porta 8000 ja estava em uso. Esta sessao usara a porta %PORT%.
echo Pressione Ctrl+C para encerrar.
echo.

call .venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port %PORT% --reload
goto :eof

:error
echo.
echo Nao foi possivel iniciar. Verifique se o Python esta instalado.
pause
exit /b 1

:port_error
pause
exit /b 1
