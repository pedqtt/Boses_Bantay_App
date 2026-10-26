@echo off
setlocal
set "BOSES_PROJECT_DIR=%~dp0"
if exist "%BOSES_PROJECT_DIR%services\chatbot\rag-bot\open_controls.py" goto found
set "BOSES_PROJECT_DIR=%USERPROFILE%\Downloads\BOSES BANTAY\boses-bantay-mobile\"
:found
set "CONTROL_PYTHON=%BOSES_PROJECT_DIR%services\chatbot\rag-bot\.venv\Scripts\python.exe"
if not exist "%CONTROL_PYTHON%" (
  echo Cannot find the chatbot Python environment in "%BOSES_PROJECT_DIR%".
  pause
  exit /b 1
)
"%CONTROL_PYTHON%" "%BOSES_PROJECT_DIR%services\chatbot\rag-bot\open_controls.py" %*
if errorlevel 1 (
  pause
  exit /b 1
)
exit /b 0
