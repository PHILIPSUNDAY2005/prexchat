self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(data.title || "ChitChat NG", {
      body: data.body || "You have a new message",
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      data: data.url || "/chat",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data || "/chat")
  );
});