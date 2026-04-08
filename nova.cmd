@ECHO off
SETLOCAL

SET "NOVA_ROOT=%~dp0"

REM Use tsx directly to avoid --import warnings in Node.js 25+
SET "TSX_PATH=%NOVA_ROOT%node_modules\.bin\tsx.cmd"
IF NOT EXIST "%TSX_PATH%" (
    SET "TSX_PATH=%NOVA_ROOT%node_modules\.bin\tsx"
)

REM Pass --require to node via tsx's --import flag workaround
REM tsx internally uses node, so we need to ensure localStorage mock is loaded first
"%TSX_PATH%" --require "%NOVA_ROOT%scripts\localStorageMock.js" "%NOVA_ROOT%packages\cli\bin\nova.js" %*
