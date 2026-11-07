const notificationIcon = "/dong-icon-192.png";
const deliveryIdPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch {
    return;
  }

  if (payload?.version !== 1 || typeof payload.id !== "string" || !deliveryIdPattern.test(payload.id)) {
    return;
  }

  if (
    payload.kind === "goal" &&
    typeof payload.title === "string" && payload.title.length > 0 && payload.title.length <= 100 &&
    typeof payload.body === "string" && payload.body.length > 0 && payload.body.length <= 180
  ) {
    event.waitUntil(self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: notificationIcon,
      tag: payload.id,
      data: { id: payload.id },
    }));
  }
});

self.addEventListener("notificationclick", (event) => {
  const id = event.notification.data?.id;
  event.notification.close();
  if (typeof id !== "string" || !deliveryIdPattern.test(id)) return;

  const url = new URL("/goalNotification", self.location.origin);
  url.searchParams.set("deliveryId", id);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url === url.href);
    if (existing) return existing.focus();
    const game = windows.find(client => new URL(client.url).pathname === "/gameProgress");
    if (game) {
      const target = await game.navigate(url.href).catch(() => null);
      if (target) return target.focus();
    }
    return self.clients.openWindow(url.href);
  })());
});
