@ECHO off
SETLOCAL

:: Nova CLI Windows Launcher
:: This script ensures tsx is available and runs the Nova CLI

SET NOVA_BIN_DIR=%~dp0
SET NODE_MODULES_DIR=%NOVA_BIN_DIR%..\node_modules
SET ROOT_NODE_MODULES=%NOVA_BIN_DIR%\..\..\..

:: Check for tsx in multiple locations
IF EXIST "%ROOT_NODE_MODULES%\.bin\tsx.cmd" (
    SET TSC=%ROOT_NODE_MODULES%\.bin\tsx.cmd
) ELSE IF EXIST "%NODE_MODULES_DIR%\.bin\tsx.cmd" (
    SET TSC=%NODE_MODULES_DIR%\.bin\tsx.cmd
) ELSE (
    ECHO Error: tsx is required to run Nova CLI from source.
    ECHO Please install it: npm install -g tsx
    EXIT /B 1
)

:: Mock localStorage for packages that try to access it in Node.js
IF NOT DEFINED globalThis.localStorage (
    SET "globalThis.localStorage={}"
    :: This will be picked up by the JS file
)

:: Re-execute with tsx
"%TSC%" "%NOVA_BIN_DIR%nova.js" %*

ENDLOCAL