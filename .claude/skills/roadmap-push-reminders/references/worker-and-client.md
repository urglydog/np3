# Mẫu worker, service worker và đăng ký push (CHƯA chạy thử trên thiết bị thật)

## manifest.json (tối thiểu)
```json
{ "name": "Roadmap Planner", "short_name": "Roadmap", "start_url": "/today", "display": "standalone",
  "background_color": "#ffffff", "theme_color": "#1F4E79",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
            { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }] }
```
Thêm `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180x180) để iOS có icon đúng.

## public/sw.js
```js
self.addEventListener('push', (event) => {
  const d = event.data ? event.data.json() : {};
  // Bắt buộc phải showNotification trong sự kiện push (đặc biệt trên iOS)
  event.waitUntil(self.registration.showNotification(d.title || 'Roadmap Planner', {
    body: d.body || '', tag: d.tag, data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

## Đăng ký (client; PHẢI gọi từ một cú bấm nút trong app đã cài)
```ts
async function enablePush(vapidPublicKey: string) {
  const reg = await navigator.serviceWorker.register('/sw.js');
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
  await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
  return true;
}
```
API route `/api/push/subscribe` lưu `endpoint`, `keys.p256dh`, `keys.auth` vào `push_subscriptions` với `user_id` lấy từ phiên đăng nhập (không tin `user_id` do client gửi). Kiểm tra `endpoint` là URL https.

## Worker (Node) – vòng lặp mỗi phút
```ts
import webpush from 'web-push';
webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

// Mỗi vòng, trong MỘT transaction bằng service role:
//   select * from reminders where status='pending' and fire_at <= now()
//   order by fire_at limit 50 for update skip locked;      -- nhiều worker không gửi trùng
// Với mỗi nhắc: lấy subscriptions chưa disabled của user, gửi:
try {
  await webpush.sendNotification({ endpoint, keys: { p256dh, auth: auth_key } },
    JSON.stringify({ title, body, url: deep_link, tag: dedupe_key }),
    { TTL: kind === 'buy_book' ? 86400 : 6 * 3600 });      // nhắc cũ không còn ý nghĩa thì đừng giao muộn
  // thành công: update subscriptions set last_success_at=now(); reminders set status='sent', sent_at=now()
} catch (e: any) {
  if (e.statusCode === 404 || e.statusCode === 410) { /* đăng ký hết hạn: set disabled_at=now() */ }
  else { /* attempts+1; quá 3 lần thì status='failed' */ }
}
```
Quy tắc: gửi lỗi một thiết bị không được làm mất nhắc cho thiết bị khác; chỉ coi là `sent` khi ít nhất một thiết bị nhận thành công; ghi log số lượng gửi/thất bại mỗi vòng; endpoint `/api/health` của web và nhịp tim của worker (ghi `now()` vào một bảng/khóa) để giám sát.
