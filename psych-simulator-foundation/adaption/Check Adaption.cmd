@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Run-Adaption.ps1" -Action check
pause
