[CmdletBinding()]
param(
    [switch]$Setup,
    [switch]$Stop,
    [switch]$Status,
    [switch]$Background
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Venv = Join-Path $Root ".venv"
$Python = Join-Path $Venv "Scripts\python.exe"
$Logs = Join-Path $Root "logs"
$PidFile = Join-Path $Logs "api-windows.pid"
$StdoutLog = Join-Path $Logs "api-windows.log"
$StderrLog = Join-Path $Logs "api-windows-error.log"
Set-Location $Root

function Import-ProjectEnvironment {
    $envPath = Join-Path $Root ".env"
    if (-not (Test-Path $envPath)) {
        throw ".env is missing. Create it from .env.example and configure the local secrets first."
    }

    $values = @{}
    foreach ($line in Get-Content $envPath) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $key = $Matches[1]
            $value = $Matches[2].Trim()
            if ($value.Length -ge 2 -and
                (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                 ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            else {
                $value = $value -replace '\s+#.*$', ''
            }
            $values[$key] = $value
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }

    foreach ($required in @("POSTGRES_PASSWORD", "JWT_SECRET")) {
        if (-not $values[$required]) {
            throw ".env must contain a $required value."
        }
    }

    $dbName = if ($values.POSTGRES_DB) { $values.POSTGRES_DB } else { "vigilant_eye" }
    $dbUser = if ($values.POSTGRES_USER) { $values.POSTGRES_USER } else { "vigilant" }
    $dbPort = if ($values.POSTGRES_HOST_PORT) { $values.POSTGRES_HOST_PORT } else { "15432" }
    $encodedUser = [Uri]::EscapeDataString($dbUser)
    $encodedPassword = [Uri]::EscapeDataString($values.POSTGRES_PASSWORD)
    $env:DATABASE_URL = "postgresql+psycopg://${encodedUser}:${encodedPassword}@127.0.0.1:${dbPort}/${dbName}"
    $env:PYTHONPATH = "$Backend;$Root\ai"
    $env:YOLO_CONFIG_DIR = Join-Path $Logs "ultralytics"
    if (-not $env:YOLO_DEVICE) { $env:YOLO_DEVICE = "cpu" }
    if (-not $env:LIVE_IMGSZ) { $env:LIVE_IMGSZ = "384" }
    if (-not $env:LIVE_DETECT_EVERY) { $env:LIVE_DETECT_EVERY = "2" }
    if (-not $env:UFM_POSTURE_EVERY) { $env:UFM_POSTURE_EVERY = "3" }
    return @{
        Database = $dbName
        User = $dbUser
        Port = $dbPort
    }
}

function Install-NativeRuntime {
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    if (-not $launcher) {
        throw "Python Launcher was not found. Install Python 3.11 (64-bit) and enable the py launcher."
    }

    & py -3.11 --version
    if ($LASTEXITCODE -ne 0) {
        throw "Python 3.11 is required for the native Windows API runtime."
    }

    if (-not (Test-Path $Python)) {
        & py -3.11 -m venv $Venv
        if ($LASTEXITCODE -ne 0) { throw "Could not create the project Python environment." }
    }

    & $Python -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { throw "Could not upgrade pip in the project environment." }

    Write-Host "Installing CPU-only PyTorch for the native camera API..."
    & $Python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
    if ($LASTEXITCODE -ne 0) { throw "CPU-only PyTorch installation failed." }
    & $Python -m pip install "numpy<2.5"
    if ($LASTEXITCODE -ne 0) { throw "NumPy installation failed." }

    $requirements = Join-Path $Backend "requirements.txt"
    $filteredRequirements = Join-Path $env:TEMP ("vigilanteye-requirements-" + [Guid]::NewGuid().ToString("N") + ".txt")
    try {
        Get-Content $requirements |
            Where-Object { $_ -notmatch '^(torch|torchvision|numpy)==' } |
            Set-Content -Path $filteredRequirements -Encoding UTF8
        & $Python -m pip install -r $filteredRequirements
        if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }
    }
    finally {
        if (Test-Path $filteredRequirements) {
            Remove-Item -LiteralPath $filteredRequirements -Force
        }
    }

    & $Python -c "import cv2, torch, fastapi, uvicorn; print('Native API dependencies ready; CPU:', torch.get_num_threads())"
    if ($LASTEXITCODE -ne 0) { throw "Native API dependency verification failed." }
}

function Get-NativeApiProcess {
    if (-not (Test-Path $PidFile)) { return $null }
    $savedPid = 0
    if (-not [int]::TryParse((Get-Content $PidFile -Raw).Trim(), [ref]$savedPid)) {
        Remove-Item -LiteralPath $PidFile -Force
        return $null
    }
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid" -ErrorAction SilentlyContinue
    if (-not $proc -or
        $proc.Name -notin @("python.exe", "pythonw.exe") -or
        $proc.CommandLine -notmatch "uvicorn\s+main:app" -or
        $proc.CommandLine -notmatch [regex]::Escape($Backend)) {
        Remove-Item -LiteralPath $PidFile -Force
        return $null
    }
    return $proc
}

function Stop-NativeApi {
    $proc = Get-NativeApiProcess
    if ($proc) {
        Stop-Process -Id $proc.ProcessId -Force
        Write-Host "Native Windows API stopped."
    }
    else {
        Write-Host "Native Windows API is not running."
    }
}

if ($Setup) {
    New-Item -ItemType Directory -Path $Logs -Force | Out-Null
    Install-NativeRuntime
    Write-Host "Windows camera runtime setup complete."
    exit 0
}

if ($Stop) {
    Stop-NativeApi
    docker compose stop api frontend db
    exit 0
}

if ($Status) {
    $nativeApi = Get-NativeApiProcess
    if ($nativeApi) {
        Write-Host "Native API: running (PID $($nativeApi.ProcessId))"
    }
    else {
        Write-Host "Native API: not running"
    }
    docker compose ps
    try {
        $ready = Invoke-WebRequest "http://127.0.0.1:8000/ready" -UseBasicParsing -TimeoutSec 5
        Write-Host "API /ready: $($ready.StatusCode)"
    }
    catch {
        Write-Host "API /ready: not reachable"
    }
    exit 0
}

if (-not (Test-Path $Python)) {
    Write-Host "Native Windows dependencies are not installed."
    Write-Host "Run .\scripts\start-windows.ps1 -Setup once, then run this script again."
    exit 1
}

$db = Import-ProjectEnvironment
New-Item -ItemType Directory -Path $Logs -Force | Out-Null

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Start Docker Desktop before launching the native API." }

docker compose stop api
if ($LASTEXITCODE -ne 0) { throw "Could not stop the Docker API container." }
docker compose up -d db
if ($LASTEXITCODE -ne 0) { throw "Could not start PostgreSQL." }
docker compose up -d --no-deps frontend
if ($LASTEXITCODE -ne 0) { throw "Could not start the frontend." }

$databaseReady = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
    docker compose exec -T db pg_isready -U $db.User -d $db.Database *> $null
    if ($LASTEXITCODE -eq 0) {
        $databaseReady = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $databaseReady) { throw "PostgreSQL did not become ready." }

Push-Location $Backend
try {
    & $Python dev_bootstrap.py
    if ($LASTEXITCODE -ne 0) { throw "Backend database bootstrap failed." }
}
finally {
    Pop-Location
}

Stop-NativeApi
$portOwner = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($portOwner) {
    throw "Port 8000 is still in use. Stop the other API process before continuing."
}

if (-not $Background) {
    Write-Host "Starting the native API in the foreground. Press Ctrl+C to stop it."
    & $Python -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir $Backend
    exit $LASTEXITCODE
}

$api = Start-Process `
    -FilePath $Python `
    -ArgumentList @(
        "-m", "uvicorn", "main:app",
        "--host", "127.0.0.1", "--port", "8000",
        "--app-dir", "`"$Backend`""
    ) `
    -WorkingDirectory $Backend `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog `
    -PassThru
Set-Content -Path $PidFile -Value $api.Id -NoNewline

$apiReady = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
    try {
        $response = Invoke-WebRequest "http://127.0.0.1:8000/ready" -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            $apiReady = $true
            break
        }
    }
    catch {
        if ($api.HasExited) { break }
    }
    Start-Sleep -Seconds 2
}

if (-not $apiReady) {
    Stop-NativeApi
    throw "Native API failed to become ready. Inspect logs\api-windows-error.log."
}

Write-Host ""
Write-Host "VigilantEye is ready."
Write-Host "Frontend: http://localhost:5173"
Write-Host "API:      http://127.0.0.1:8000"
Write-Host "API log:  logs\api-windows.log"
Write-Host "Use Stream URL webcam:0 in Exam Setup for the built-in camera."
Write-Host "Stop:     .\scripts\start-windows.ps1 -Stop"
