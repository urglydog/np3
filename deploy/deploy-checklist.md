# Checklist triển khai

## Trước khi đụng vào server
- [ ] Đã có domain thật (hoặc subdomain), quyền sửa DNS.
- [ ] `ss -tlnp` trên server: cổng 80/443 đang do ai giữ? Quyết định gộp hay dùng subdomain.
- [ ] Supabase project đã tạo; đã chạy `schema.sql`, `import_template.py --publish`, `rls_test.sql` (trên bản kiểm thử).
- [ ] Tạo khóa VAPID: `npx web-push generate-vapid-keys --json`. Lưu ở nơi an toàn.

## Dựng server (làm một lần)
- [ ] Người dùng thường + SSH key; tắt đăng nhập mật khẩu và root.
- [ ] Tường lửa: 22 (hạn chế IP nếu được), 80, 443.
- [ ] Tự động cập nhật bảo mật.
- [ ] Docker + compose plugin. Giới hạn log trong `/etc/docker/daemon.json` (`max-size`, `max-file`).

## Mỗi lần triển khai
- [ ] CI: test `packages/core` đạt (schedule golden, budget, reminders, adjustments).
- [ ] Migration áp dụng thành công, tương thích ngược.
- [ ] `docker compose build` -> `up -d`; `docker compose ps` toàn `healthy`.
- [ ] `curl -fsS https://DOMAIN/api/health`.
- [ ] Gửi thông báo thử tới iPhone đã cài app.
- [ ] Ghi lại tag image đang chạy để rollback.

## Hằng tuần/tháng
- [ ] Bản sao lưu `pg_dump` mới nhất tồn tại; thử khôi phục định kỳ.
- [ ] Xem chi phí Gemini và số lần gọi (`ai_usage`).
- [ ] Cập nhật ảnh nền Docker và phụ thuộc có lỗ hổng.
- [ ] Rà lại `price_checked_at` của tài nguyên và link mua còn sống.

## Khi sự cố
- Web chết: `docker compose logs web`, `docker compose restart web`, nếu vẫn lỗi thì rollback tag.
- Không có thông báo: kiểm tra nhịp tim worker, log worker (404/410 từ push service nghĩa là đăng ký hết hạn), thử "Gửi thông báo thử" trong app.
- Nghi lộ khóa: rotate khóa ngay (Supabase service role, Gemini, VAPID nếu cần), xem log truy cập.
