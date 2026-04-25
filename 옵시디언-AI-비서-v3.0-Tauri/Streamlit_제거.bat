@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion
title 옛 Streamlit 버전 제거
color 0E

echo ============================================================
echo   옵시디언 AI 비서 - 옛 Streamlit 버전 제거
echo   (새 Tauri 버전 설치 전에 한 번만 실행하세요)
echo ============================================================
echo.

set "INSTALL_DIR=%USERPROFILE%\obsidian-ai-assistant"
set "CONFIG_FILE=%USERPROFILE%\.myai_obsidian_config.json"

echo  대상 폴더: %INSTALL_DIR%
echo  설정 파일: %CONFIG_FILE%
echo.

echo [1/5] 실행 중인 Streamlit/Python 프로세스 종료 중...
taskkill /F /IM pythonw.exe /T > nul 2>&1
taskkill /F /IM streamlit.exe /T > nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*obsidian-ai-assistant*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" > nul 2>&1
timeout /t 2 /nobreak > nul
echo   종료 시도 완료.
echo.

echo [2/5] 설치 폴더 제거 중...
if exist "%INSTALL_DIR%\" (
    rmdir /s /q "%INSTALL_DIR%" > nul 2>&1
    if exist "%INSTALL_DIR%\" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command ^
          "Remove-Item '%INSTALL_DIR%' -Recurse -Force -ErrorAction SilentlyContinue" > nul 2>&1
    )
    if exist "%INSTALL_DIR%\" (
        echo   [X] 폴더 삭제 실패. 컴퓨터 재시작 후 다시 실행해주세요.
    ) else (
        echo   [OK] 폴더 삭제 완료.
    )
) else (
    echo   폴더 없음 (이미 제거됨).
)
echo.

echo [3/5] 바탕화면 바로가기 제거 중...
for %%P in (
    "%USERPROFILE%\Desktop\옵시디언 AI 비서.lnk"
    "%USERPROFILE%\OneDrive\Desktop\옵시디언 AI 비서.lnk"
    "%USERPROFILE%\OneDrive\바탕 화면\옵시디언 AI 비서.lnk"
    "%USERPROFILE%\바탕 화면\옵시디언 AI 비서.lnk"
    "%PUBLIC%\Desktop\옵시디언 AI 비서.lnk"
) do (
    if exist %%P (
        del /q %%P > nul 2>&1
        echo   [OK] 제거: %%P
    )
)
echo.

echo [4/5] 시작 메뉴 바로가기 제거 중...
for %%P in (
    "%APPDATA%\Microsoft\Windows\Start Menu\Programs\옵시디언 AI 비서.lnk"
    "%PROGRAMDATA%\Microsoft\Windows\Start Menu\Programs\옵시디언 AI 비서.lnk"
) do (
    if exist %%P (
        del /q %%P > nul 2>&1
        echo   [OK] 제거: %%P
    )
)
echo.

echo [5/5] 설정 파일 처리...
if exist "%CONFIG_FILE%" (
    echo   설정 파일 발견: %CONFIG_FILE%
    echo   이 파일에는 API 키가 들어있어요.
    echo   새 Tauri 버전이 자동으로 그대로 읽어 씁니다 (마이그레이션 됨).
    echo.
    set "DELCONF="
    set /p "DELCONF=  그래도 삭제하시겠어요? [y/N]: "
    if /i "!DELCONF!"=="y" (
        del /q "%CONFIG_FILE%" > nul 2>&1
        echo   [OK] 설정 파일 삭제됨.
    ) else (
        echo   설정 파일 보존.
    )
) else (
    echo   설정 파일 없음 (정상).
)
echo.

echo ============================================================
echo  Streamlit 버전 제거 완료!
echo
echo  다음 단계:
echo    1. tauri-docs\빌드방법.md 의 "방법 A (GitHub Actions)" 따라하기
echo    2. 빌드된 .msi (Windows) 또는 .dmg (Mac) 다운로드
echo    3. 정식 설치 마법사로 새 Tauri 앱 설치
echo ============================================================
echo.
echo  아무 키나 눌러 창을 닫으세요...
pause > nul
exit /b 0
