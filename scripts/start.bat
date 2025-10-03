@echo off
REM GitLab Architecture Viewer Startup Script for Windows
REM This script starts the backend server and opens the frontend in the browser

setlocal enabledelayedexpansion

REM Default port
if "%PORT%"=="" set PORT=8080

echo 🚀 Starting GitLab Architecture Viewer...

REM Check if .env file exists
if not exist .env (
    echo ⚠️  No .env file found. Creating from example...
    if exist env.example (
        copy env.example .env
        echo 📝 Please edit .env file with your GitLab token and settings
    ) else (
        echo ❌ No env.example file found. Please create a .env file manually.
        pause
        exit /b 1
    )
)

REM Check if Go is installed
go version >nul 2>&1
if errorlevel 1 (
    echo ❌ Go is not installed. Please install Go first.
    pause
    exit /b 1
)

REM Check if the project builds
echo 🔨 Building project...
go build -o temp_gitlab_arch_api.exe cmd/api/main.go
if errorlevel 1 (
    echo ❌ Failed to build project. Please check for errors.
    pause
    exit /b 1
)

REM Clean up build artifact
del temp_gitlab_arch_api.exe

REM Start the server in the background
echo 🌐 Starting API server on port %PORT%...
start /b go run cmd/api/main.go

REM Wait for server to start
echo ⏳ Waiting for server to start...
timeout /t 3 /nobreak >nul

REM Test if server is running
for /l %%i in (1,1,30) do (
    curl -s http://localhost:%PORT%/health >nul 2>&1
    if not errorlevel 1 (
        echo ✅ Server is ready!
        goto :server_ready
    )
    timeout /t 1 /nobreak >nul
)

echo ❌ Server failed to start within 30 seconds
pause
exit /b 1

:server_ready
REM Open browser
echo 🌍 Opening web interface in browser...
start http://localhost:%PORT%

echo 🎉 GitLab Architecture Viewer is running!
echo 📱 Web Interface: http://localhost:%PORT%
echo 🔧 API Endpoints: http://localhost:%PORT%/api
echo ❤️  Health Check: http://localhost:%PORT%/health
echo.
echo Press any key to stop the server
pause >nul

REM Kill any remaining Go processes (this is a simple approach)
taskkill /f /im go.exe >nul 2>&1
