# Troubleshooting

## Local webcam is unavailable

If the portal reports:

> Local webcam is unavailable inside Docker Desktop on this OS.

this is a runtime limitation, not an AI model failure. On Windows or macOS,
run the backend natively so OpenCV can access the host camera:

```powershell
docker compose up -d db
.\scripts\start-windows.ps1
```

On macOS:

```bash
docker compose up -d db
./scripts/start-mac.sh
```

Use the existing frontend environment setting:

```text
VITE_API_URL=http://localhost:8000
```

Do not start both the Docker API and host API on port 8000.

## Camera diagnostic

The diagnostic reads one frame and releases the source immediately. It does
not load YOLO or start inference:

```powershell
.venv\Scripts\python.exe scripts\check_camera.py
.venv\Scripts\python.exe scripts\check_camera.py --source webcam:1
.venv\Scripts\python.exe scripts\check_camera.py --source ai/samples/clip.mp4
```

It prints the OpenCV version, source result, and frame resolution.

## Docker camera support

- Windows/macOS Docker Desktop: use the host backend for laptop webcams.
- Docker backend: RTSP/IP cameras and HTTP streams remain supported when the
  container can reach the network.
- Docker backend: project video files remain supported when present in the
  container filesystem.
- Linux: `/dev/video*` passthrough may work when explicitly configured.

Do not assume webcam passthrough works cross-platform.

## Error categories

- **CAMERA ERROR**: source cannot open or deliver frames.
- **AI MODEL ERROR**: model loading or inference setup failed.
- **NETWORK ERROR**: API or stream network communication failed.
- **AUTH ERROR**: authentication or authorization failed.
