@echo off
setlocal
rem Works from the project folder or when copied/moved to the Desktop.
set "BOSES_PROJECT_DIR=%~dp0"
if exist "%BOSES_PROJECT_DIR%services\chatbot\rag-bot\start_all.py" goto project_found
set "BOSES_PROJECT_DIR=%USERPROFILE%\Downloads\BOSES BANTAY\boses-bantay-mobile\"
if exist "%BOSES_PROJECT_DIR%services\chatbot\rag-bot\start_all.py" goto project_found
echo Cannot find the Boses Bantay project folder.
echo Expected: "%BOSES_PROJECT_DIR%"
echo Put this launcher inside the project folder if you moved the project.
if /i "%~1"=="--check" exit /b 1
pause
exit /b 1

:project_found
cd /d "%BOSES_PROJECT_DIR%"
if errorlevel 1 exit /b 1
set "CHATBOT_PYTHON=%BOSES_PROJECT_DIR%services\chatbot\rag-bot\.venv\Scripts\python.exe"
if not exist "%CHATBOT_PYTHON%" (
  echo Chatbot Python environment is missing.
  echo Expected: "%CHATBOT_PYTHON%"
  if /i "%~1"=="--check" exit /b 1
  pause
  exit /b 1
)
"%CHATBOT_PYTHON%" "%BOSES_PROJECT_DIR%services\chatbot\rag-bot\start_all.py" %*
set "START_RESULT=%ERRORLEVEL%"
if /i "%~1"=="--check" exit /b %START_RESULT%
echo.
pause
exit /b %START_RESULT%
