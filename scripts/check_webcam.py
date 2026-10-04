"""Verify frames come from a PHYSICAL camera (not a file): python scripts/check_webcam.py [index]"""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import cv2
from capture_source import CaptureError, list_webcams, open_capture

req = int(sys.argv[1]) if len(sys.argv) > 1 else 0
print("cameras delivering frames:", list_webcams(3))
try:
    o = open_capture(f"webcam:{req}")
except CaptureError as e:
    print("FAIL:", e); sys.exit(1)
t0, n, prev, moving = time.time(), 0, None, 0
while time.time() - t0 < 5:
    ok, f = o.cap.read()
    if not ok: continue
    n += 1
    g = cv2.cvtColor(cv2.resize(f, (160, 90)), cv2.COLOR_BGR2GRAY)
    if prev is not None and cv2.absdiff(g, prev).mean() > 0.3: moving += 1  # sensor noise/motion
    prev = g
out = Path(__file__).resolve().parents[1] / "logs" / "webcam_check.jpg"
cv2.imwrite(str(out), f)
print(f"OK source={o.description} kind={o.kind} {f.shape[1]}x{f.shape[0]} "
      f"fps={n/5:.1f} frames_with_change={moving}/{n} snapshot={out}")
o.cap.release()
