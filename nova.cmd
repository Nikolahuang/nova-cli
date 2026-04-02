@echo off
setlocal EnableDelayedExpansion

set "NOVA_ROOT=%~dp0"
set "LOADER_PATH=%NOVA_ROOT%node_modules\tsx\dist\loader.mjs"

:: Convert Windows path to file:// URL for ESM loader
:: Replace \ with / and add file:/// prefix
set "LOADER_URL=file:///%LOADER_PATH:\=/%"
:: Remove any double slashes (except file://)
set "LOADER_URL=!LOADER_URL:file:////=file:///-!"

node --import "!LOADER_URL!" "!NOVA_ROOT!packages\cli\bin\nova.js" %*