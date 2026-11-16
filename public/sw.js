self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let message = { title: "Novo pedido na Jujubordados", body: "Há um pedido aguardando atendimento." };
  try {
    const payload = event.data?.json();
    if (payload && typeof payload.title === "string" && typeof payload.body === "string") {
      message = { title: payload.title.slice(0, 80), body: payload.body.slice(0, 140) };
    }
  } catch { /* Use the generic notification when payload parsing fails. */ }

  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "jujubordados-new-order",
    renotify: true,
    data: { url: "/painel" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ("focus" in client) {
        client.navigate("/painel");
        return client.focus();
      }
    }
    return self.clients.openWindow("/painel");
  }));
});
