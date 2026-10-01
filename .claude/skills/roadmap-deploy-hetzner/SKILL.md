---
name: roadmap-deploy-hetzner
description: "Triển khai Roadmap Planner lên VPS Hetzner với Docker Compose + Caddy (HTTPS tự động) + Supabase đám mây: mẫu docker-compose, Caddyfile, Dockerfile nhiều giai đoạn, .env.example, danh sách việc cần làm khi dựng server (SSH, tường lửa, domain, cổng 80/443), sao lưu, giám sát, rollback, quản lý secrets, CI/CD, và cách chung sống với dự án khác trên cùng server. Dùng skill này bất cứ khi nào người dùng nhắc deploy, Hetzner, VPS, Docker, HTTPS/domain, Caddy/Nginx, biến môi trường, backup, hoặc 'đưa web lên cho người khác dùng', kể cả khi chỉ hỏi 'cấu hình server thế nào'."
---

# Deploy: Hetzner + Docker Compose + Caddy + Supabase

> **Chưa dùng ở giai đoạn local-first.** Chỉ đọc và áp dụng khi người dùng nói rõ muốn triển khai. Các tệp mẫu ở đây là để chuẩn bị sẵn, không tạo hay chạy gì trên server nếu chưa được yêu cầu.

Kiến trúc: một VPS chạy 3 container (`caddy` làm reverse proxy HTTPS, `web` Next.js, `worker` gửi nhắc), CSDL và đăng nhập ở Supabase đám mây. Một server, ít phần chuyển động, hợp với lập trình viên đơn lẻ. Mẫu ở `references/`: `docker-compose.yml`, `Caddyfile`, `Dockerfile`, `.env.example`. `docker-compose.yml` đã kiểm tra là YAML hợp lệ; **chưa chạy thử với app thật** vì app chưa tồn tại: khi dựng, kiểm tra tên script build, đường dẫn và `output: 'standalone'`.

## Các quyết định và lý do

- **Cần domain thật** trỏ A record về IP VPS. Web Push và PWA bắt buộc HTTPS, Caddy tự xin/gia hạn chứng chỉ. Tên miền dùng chung kiểu `nip.io` có thể bị giới hạn cấp chứng chỉ vì nhiều người dùng chung; dùng domain riêng.
- **Server đã chạy dự án khác (khóa luận)?** Cổng 80/443 chỉ một dịch vụ giữ được. Hoặc dùng subdomain riêng và gộp vào reverse proxy hiện có, hoặc đưa dự án cũ qua cùng Caddy. Kiểm tra `ss -tlnp` trước khi `docker compose up`. Đặt tên project compose riêng (`-p roadmap`) để không đè container cũ.
- **Supabase tách khỏi server:** sao lưu và nâng cấp CSDL đỡ phải tự lo. Chọn vùng gần người dùng hoặc gần Hetzner; nếu server ở châu Âu, độ trễ từ Việt Nam khoảng vài trăm ms mỗi request, chấp nhận được với app này nhưng **hãy đo thật** trên điện thoại.
- **Worker là container riêng**, không chạy trong tiến trình web: web khởi động lại không làm mất nhắc, và scale độc lập.
- **Gemini gọi từ server qua khóa trong `.env`.** Google Cloud chỉ thêm khi thật sự cần (vd cảnh báo chi tiêu, dịch vụ khác); đừng thêm dịch vụ GCP vào v1 nếu chưa có lý do.

## Danh sách việc dựng server (xem thêm `references/deploy-checklist.md`)

1. Tạo người dùng không phải root, đăng nhập bằng SSH key, tắt đăng nhập mật khẩu và root.
2. Tường lửa chỉ mở 22 (tốt nhất giới hạn theo IP), 80, 443.
3. Bật tự động cập nhật bảo mật. Cài Docker + plugin compose.
4. DNS trỏ domain về VPS, đợi lan truyền rồi mới `docker compose up -d`.
5. `.env` trên server, `chmod 600`, **không commit**; chỉ commit `.env.example`.
6. Kiểm tra: `/api/health` trả 200, HTTPS hợp lệ, Web Push gửi thử tới iPhone thật.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `GEMINI_API_KEY`, `DATABASE_URL` chỉ nằm ở `.env` của server. Biến `NEXT_PUBLIC_*` sẽ nằm trong mã gửi cho trình duyệt: chỉ đặt URL Supabase, khóa anon, khóa VAPID công khai.
- Xoay (rotate) khóa ngay nếu từng bị dán vào chat, log hay repo.
- Cặp khóa VAPID mà đổi thì mọi đăng ký push cũ mất hiệu lực; tạo một lần và giữ.

## Sao lưu và khả năng phục hồi

- Dữ liệu người dùng nằm ở Supabase: kiểm tra gói của bạn có sao lưu tự động không và giữ bao lâu (khác nhau theo gói), và một số gói miễn phí tạm dừng project khi lâu không hoạt động. Đừng giả định, hãy đọc điều khoản hiện hành.
- Thêm `pg_dump` định kỳ (cron trên VPS dùng `DATABASE_URL`) ra nơi khác, giữ nhiều bản xoay vòng, và **thử khôi phục một lần**: sao lưu chưa thử khôi phục thì chưa phải sao lưu.
- Người dùng có nút **xuất/nhập file** dữ liệu của mình (đồng thời là cách thoát khi bạn gặp sự cố).

## Giám sát và vận hành

- `/api/health` cho web; worker ghi nhịp tim (thời điểm vòng lặp cuối) để biết nó còn sống. Dùng dịch vụ kiểm tra uptime bên ngoài, báo qua email/Telegram.
- `docker compose logs`, giới hạn kích thước log của Docker để không đầy đĩa.
- Triển khai bằng `git pull` + `docker compose build` + `up -d`, giữ lại image cũ để **rollback** bằng cách trỏ lại tag trước đó. CI (GitHub Actions) chạy các bài test trong `packages/core` trước khi cho phép deploy.
- Migration CSDL chạy trước khi đưa bản mới lên, ưu tiên thay đổi tương thích ngược để rollback được.

## Khi mở cho người khác dùng

Thêm trang chính sách riêng tư (nêu dữ liệu lưu, cách xóa tài khoản), kiểm tra quy định về bảo vệ dữ liệu cá nhân hiện hành ở Việt Nam, giới hạn tần suất ở Caddy hoặc ở route API, và chạy lại `rls_test.sql` trên project Supabase thật.
