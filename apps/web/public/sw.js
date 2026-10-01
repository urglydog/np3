// Mẫu service worker cho Web Push (T-001). CHƯA đăng ký ở client trong scaffold này.
// Không cache API: service worker này chỉ xử lý push, không can thiệp fetch.
self.addEventListener('push', (event) => {
  const d = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(d.title || 'Roadmap Planner', {
      body: d.body || '',
      tag: d.tag,
      data: { url: d.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
