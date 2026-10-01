---
name: roadmap-push-reminders
description: "Thông báo nhắc học và nhắc mua sách cho Roadmap Planner chạy như PWA, kể cả trên iPhone: tạo nhắc từ lịch (hàm thuần có test), múi giờ và giờ yên tĩnh, bảng reminders kiểu outbox, worker gửi Web Push (VAPID) chống gửi trùng, service worker, đăng ký push, giới hạn của iOS (phải thêm vào màn hình chính, iOS 16.4+, không cần tài khoản Apple Developer). Dùng skill này bất cứ khi nào viết hoặc gỡ lỗi thông báo, PWA manifest, service worker, VAPID, worker nhắc việc, hoặc khi người dùng hỏi 'thông báo không đến trên iPhone', 'nhắc đúng giờ', 'push từ server'."
---

# Push & Reminders

Hai lớp tách bạch, để lớp quyết định *nhắc gì, lúc nào* test được mà không cần gửi thật:

1. **Quyết định (hàm thuần):** `scripts/reminders.ts` -> `buildReminders` nhận lịch + kết quả mua sách + tùy chọn người dùng, trả danh sách `ReminderDraft` (kind, dedupeKey, fireAt UTC, nội dung). `diffReminders` so với bảng `reminders` để biết cần thêm/cập nhật/huỷ.
2. **Gửi (worker):** đọc bảng `reminders` đến giờ, gửi Web Push, ghi kết quả. Xem `references/worker-and-client.md`.

## Vì sao cần server (khác với app native)

Web không có "thông báo hẹn giờ trên máy" dùng được khi app đóng. Muốn nhắc đúng giờ, **server phải gửi push** đúng lúc. Vì vậy cần: cặp khóa VAPID, service worker, lưu đăng ký của từng thiết bị (`push_subscriptions`), và worker chạy định kỳ. Bù lại không cần tài khoản Apple Developer trả phí.

## Luồng đồng bộ nhắc (làm mỗi khi lịch, trạng thái, tùy chọn hoặc tài nguyên đổi)

1. Tính lại lịch + `planPurchases` + `buildReminders`.
2. `diffReminders(existing, drafts)`: insert mục mới, update mục `pending` đổi giờ/nội dung, **huỷ** mục `pending` không còn trong bản mới (vd task bị hoãn).
3. Mục đã `sent` không bao giờ bị đụng. `dedupeKey` + ràng buộc `unique(plan_id, kind, dedupe_key)` bảo đảm chạy lại không tạo trùng.

Chỉ tạo nhắc cho `horizonDays` (mặc định 14) ngày tới, rồi tạo lại khi người dùng mở app hoặc worker chạy hằng ngày.

## Quy tắc nhắc

- **Nhắc học:** mỗi ngày có task nằm trong cửa sổ [Start, Due], giờ `studyTime` theo múi giờ người dùng. Tiêu đề nêu task chính ("Hôm nay học: ..."), body gọn.
- **Nhắc mua:** một lần tại `orderBy` (hoặc ngay hôm nay nếu đã quá hạn; nếu giờ nhắc hôm nay đã qua thì dời sang ngày mai). Đồ miễn phí không nhắc.
- **Giờ yên tĩnh** (mặc định 22:00 đến 07:00, có thể qua nửa đêm): giờ gửi rơi vào khung đó thì dời đến lúc hết khung.
- **Ngày nghỉ cố định** (`restWeekdays`) bỏ nhắc học. Lưu ý: bộ tính lịch trải ngày nghỉ đều (không gắn thứ), nên đây chỉ là lọc nhắc, không đổi lịch.
- Múi giờ: luôn đổi "HH:MM địa phương" sang UTC bằng `zonedTimeToUtc` (đã test với giờ mùa hè). Không cộng 7 tiếng bằng tay.
- **Nội dung thông báo tối thiểu:** chỉ tên task/sách và link sâu. Màn khóa điện thoại có thể bị người khác nhìn thấy.

## Giới hạn iOS (đọc `references/ios-web-push.md` trước khi hứa tính năng)

Thông báo web trên iPhone chỉ hoạt động khi app đã **thêm vào màn hình chính**, từ iOS 16.4, và người dùng cấp quyền *từ trong app đã cài*. Có báo cáo thực tế rằng đôi khi chạy một lúc rồi ngừng. Vì vậy: **không phụ thuộc vào push**: màn "Hôm nay" / "Sắp tới" / "Cần mua" phải đủ dùng khi không có thông báo, và nên có nút "Gửi thông báo thử".

## Việc đầu tiên khi làm: thử nghiệm nhỏ trước khi dựng phần còn lại (hai bước)

Đây là rủi ro lớn nhất của hướng PWA nên phải biết sớm. Trang tối giản + `manifest` (`display: standalone`) + service worker + endpoint đăng ký + một lệnh gửi thử bằng `web-push`.

- **Bước A (làm được hoàn toàn local):** thử trên trình duyệt desktop ở `localhost` (được coi là ngữ cảnh an toàn nên service worker và push chạy được). Xác nhận: đăng ký, gửi thử, bấm vào thông báo mở đúng trang, hủy đăng ký khi nhận 404/410.
- **Bước B (cần HTTPS công khai):** iPhone chỉ nhận push khi app thêm vào màn hình chính từ một địa chỉ HTTPS, nên không thử được chỉ với `localhost`. Hoãn cho đến khi người dùng chọn cách: đường hầm HTTPS tạm thời tới máy local (cần đóng ngay sau khi thử, bắt buộc có đăng nhập trước, vì nó phơi bản dev ra internet) hoặc deploy sau này. **Đừng tự dựng đường hầm hay deploy mà chưa được người dùng đồng ý.** Chỉ coi hướng PWA là khả thi trên iPhone khi bước B đã đạt ổn định vài ngày.

## Kiểm thử

```bash
cd scripts && npx tsx run-tests.mts    # 23 phép kiểm tra: múi giờ, giờ yên tĩnh, nhắc học/mua, diff
```
Phần worker, service worker và đăng ký push **chưa được chạy thử** (cần thiết bị thật và domain HTTPS).
