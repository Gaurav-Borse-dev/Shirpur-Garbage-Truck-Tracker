// CleanTrack Shirpur Service Worker for Web Push & Background Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      title: "CleanTrack Alert",
      body: event.data ? event.data.text() : "Garbage collection truck is nearby.",
    };
  }

  const title = payload.title || "CleanTrack — Garbage Truck Alert";
  const body = payload.body || "A municipal waste collection truck is approaching your location.";
  const kind = payload.kind || "truck_nearby";
  const link = payload.link || (kind === "truck_nearby" ? "/resident" : "/");

  const options = {
    body: body,
    icon: "/shirpur-logo.jpg",
    badge: "/shirpur-logo.jpg",
    vibrate: [200, 100, 200, 100, 200],
    sound: "/truck_bell.wav",
    tag: payload.id || `cleantrack-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      link: link,
      kind: kind,
      ts: Date.now(),
    },
    actions: [
      { action: "track", title: "🚚 Track Truck Live" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl =
    event.notification.data && event.notification.data.link
      ? event.notification.data.link
      : "/resident";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
