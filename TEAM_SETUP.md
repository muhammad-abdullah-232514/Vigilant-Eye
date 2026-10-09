# Team setup: local webcam development

## Runtime rule

The laptop webcam belongs to the host operating system. Docker Desktop on
Windows and macOS normally cannot expose that device to the Linux container.
Use the hybrid development runtime for webcam work:

- Docker: PostgreSQL and the Vite frontend
- Windows/macOS host: FastAPI, OpenCV, YOLO, and webcam capture

Docker remains supported for RTSP/IP cameras, HTTP streams, and project video
files that are reachable or mounted inside the container.

## Windows hybrid mode

From the repository root:

```powershell
docker compose up -d db
.\scripts\start-windows.ps1 -Setup
.\scripts\start-windows.ps1
```

The script loads `.env`, points the host API at PostgreSQL on
`127.0.0.1:15432`, and starts FastAPI on `127.0.0.1:8000`. Keep the frontend
at `http://localhost:5173` and use `VITE_API_URL=http://localhost:8000`.

Do not run the Docker API at the same time as the native API because both use
port 8000.

## macOS hybrid mode

```bash
docker compose up -d db
./scripts/start-mac.sh setup
./scripts/start-mac.sh
```

## Camera source configuration

Camera sources use the existing Master Data `stream_url` field:

- `webcam`, `webcam:0`, `webcam:1`, or `webcam:2`
- `ai/samples/clip.mp4`
- `rtsp://...` / `rtsps://...`
- `http://...` / `https://...`

The requested webcam index is tried first, followed by fallback indexes 0, 1,
and 2. No personal device is hardcoded.

## Database addresses

| Runtime | Database address |
|---|---|
| Host FastAPI + Docker PostgreSQL | `127.0.0.1:15432` |
| Docker FastAPI + Docker PostgreSQL | `db:5432` |
