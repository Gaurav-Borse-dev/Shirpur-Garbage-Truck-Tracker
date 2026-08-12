import { eventHandler } from "h3";

export default eventHandler(() => {
  return {
    success: true,
    service: "CleanTrack Backend",
    status: "running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };
});
