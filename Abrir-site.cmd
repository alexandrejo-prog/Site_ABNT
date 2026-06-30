@echo off
chcp 65001 >nul
title Abrir Site Normas UFLA

cd /d "%~dp0"

echo.
echo ==========================================
echo  ABRINDO SITE NORMAS UFLA
echo ==========================================
echo.

if not exist package.json (
  echo ERRO: package.json nao encontrado.
  echo Este arquivo precisa estar na raiz do projeto.
  pause
  exit /b 1
)

if not exist node_modules (
  echo node_modules nao encontrado.
  echo Instalando dependencias...
  npm.cmd install --cache .\.npm-cache
)

echo.
echo Abrindo navegador em http://127.0.0.1:5173/
start http://127.0.0.1:5173/

echo.
echo Iniciando servidor local...
echo Para parar o site, pressione CTRL + C nesta janela.
echo.

npm.cmd run dev -- --host 127.0.0.1

pause