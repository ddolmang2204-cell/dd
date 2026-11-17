@echo off
chcp 65001 >nul
title 디스코드 셀프봇 자동 실행기

:: node_modules 폴더가 없으면 자동으로 라이브러리 설치
if not exist "node_modules" (
    echo [+] 필수 라이브러리가 없습니다. 자동으로 설치를 시작합니다...
    call npm install discord.js-selfbot-v13
    echo [+] 설치가 완료되었습니다!
    echo.
)

echo [+] 셀프봇을 실행합니다...
node index.js
pause