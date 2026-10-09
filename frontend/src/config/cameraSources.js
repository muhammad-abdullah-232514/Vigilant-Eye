export const LIVE_CAMERA_SOURCE_KINDS = new Set(["webcam", "rtsp", "http"]);

export function isLiveCamera(camera) {
  return LIVE_CAMERA_SOURCE_KINDS.has(camera?.source_kind);
}
