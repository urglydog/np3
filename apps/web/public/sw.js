// Service Worker — Roadmap Planner (T-001)
// Chỉ xử lý push + notification click. KHÔNG cache API.

self.addEventListener('install', () => {
  // Kích hoạt ngay, không chờ tab cũ đóng.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const d = event.data ? event.data.json() : {};
  const title = d.title || 'Roadmap Planner';
  const options = {
    body: d.body || '',
    icon: '/icons/icon-192-v2.png',
    badge: '/icons/icon-192-v2.png',
    tag: d.tag || 'roadmap-default',
    renotify: !!d.tag,
    data: { url: d.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Nếu đang mở tab nào cùng origin → focus và navigate
        for (const client of windowClients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(targetUrl);
            return;
          }
        }
        // Không có tab nào mở → mở tab mới
        return self.clients.openWindow(targetUrl);
      })
  );
});
