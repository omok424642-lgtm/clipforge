@echo off
chcp 65001 >nul
setlocal DisableDelayedExpansion
pushd "%~dp0"
if errorlevel 1 goto folder_error
where node >nul 2>nul
if errorlevel 1 goto node_missing
node -e "var v=process.versions.node.split('.');if(+v[0]<22||(+v[0]===22&&+v[1]<13))process.exit(2)"
if errorlevel 1 goto node_version
if not exist "%~dp0scripts\windows-launcher.cjs" goto source_missing
node "%~dp0scripts\windows-launcher.cjs"
set "CLIPFORGE_EXIT=%ERRORLEVEL%"
popd
echo.
pause
exit /b %CLIPFORGE_EXIT%
:node_missing
echo [안내] Node.js가 없습니다. https://nodejs.org/en/download 에서 최신 Node.js 22.x를 설치해 주세요.
echo 설치 후 이 창을 닫고 다시 더블클릭해 주세요. 자세한 내용은 '윈도우 실행 안내.txt'를 확인하세요.
popd
pause
exit /b 1
:folder_error
echo [안내] 프로그램 폴더를 열 수 없습니다. ZIP을 내 문서의 별도 폴더에 완전히 압축 해제한 뒤 실행해 주세요.
pause
exit /b 1
:source_missing
echo [안내] 실행 파일이 없습니다. ZIP을 완전히 압축 해제하고 scripts 폴더가 함께 있는지 확인해 주세요.
popd
pause
exit /b 1
:node_version
echo [안내] Node.js 버전이 오래됐거나 실행되지 않습니다. 최신 Node.js 22.x를 설치한 뒤 창을 닫고 다시 실행해 주세요.
echo https://nodejs.org/en/download
popd
pause
exit /b 1
