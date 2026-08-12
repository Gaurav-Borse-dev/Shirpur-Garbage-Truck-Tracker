import { eventHandler, setResponseStatus } from "h3";

export default eventHandler((event) => {
  setResponseStatus(event, 404);
  return {
    success: false,
    error: "API route not found",
    path: event.path,
    status: 404,
    timestamp: new Date().toISOString(),
  };
});
