@ECHO off
SETLOCAL

SET NOVA_BIN_DIR=%~dp0

IF NOT DEFINED globalThis.localStorage (
    SET "globalThis.localStorage={}"
)

node "%NOVA_BIN_DIR%nova.js" %*

ENDLOCAL