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

  if (payload.kind === "test") {
    event.waitUntil(self.registration.showNotification("DONG notifications", {
      body: "This is a test notification.",
      icon: notificationIcon,
      tag: payload.id,
    }));
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
