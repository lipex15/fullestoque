@echo off
:: deathstuffs-brain GitHub Uploader Helper
echo ====================================================
echo CONFIGURANDO GITHUB E SUBINDO O PROJETO
echo ====================================================
echo.
echo Certifique-se de ter criado um repositorio VAZIO no seu GitHub.
echo.
set /p REPO_URL="Cole o link HTTPS/SSH do seu repositorio do GitHub (ex: https://github.com/usuario/seu-repo.git): "

if "%REPO_URL%"=="" (
    echo.
    echo [ERRO] Nenhum link foi fornecido. Cancelando...
    echo.
    pause
    exit /b
)

:: Renomeia a branch padrao para main
git branch -M main

:: Remove qualquer remote anterior se houver
git remote remove origin >nul 2>&1

:: Adiciona o novo remote apontando para o repositorio do usuario
git remote add origin %REPO_URL%

echo.
echo Enviando codigos para a branch 'main'...
echo.
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ====================================================
    echo SUCESSO! O projeto foi enviado para o GitHub.
    echo ====================================================
) else (
    echo.
    echo [ERRO] Falha ao enviar para o GitHub. Certifique-se de que o repositorio existe e voce possui permissao de acesso.
)

echo.
pause
