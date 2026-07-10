@echo off
if "%GH_TOKEN%"=="" (
  echo ERRO: defina a variavel GH_TOKEN antes de publicar.
  exit /b 1
)

echo ===================================================
echo   GLOBAL STOCK BY DEATHZIN - AUTO PUBLISH SCRIPT
echo ===================================================
echo.
echo Iniciando compilacao local da aplicacao nativa...
call npm run electron-pack

echo.
echo ===================================================
echo Aplicacao compilada! Enviando arquivos para o Github Releases (Auto-Updater)...
echo ===================================================
echo.
echo 1/3 - Verificando versao e criando release...
node create_release.cjs
echo.
echo 2/3 - Fazendo upload do pacote (.exe)...
node upload_exe.cjs
echo.
echo 3/3 - Vinculando arquivos de versao (latest.yml)...
node upload_yml.cjs
echo.
echo ===================================================
echo SUCESSO ABSOLUTO! TUDO PUBLICADO.
echo A nova versao ja esta disponivel para download e 
echo quem ja possui a versao anterior recebera o alerta!
echo ===================================================
pause
