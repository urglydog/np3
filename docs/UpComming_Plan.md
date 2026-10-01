# UpComming_Plan — việc đang làm và sắp làm

> Chế độ: **local-only**. Trạng thái: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong · `[!]` bị chặn.
> Mỗi task cần user confirm trước khi bắt đầu (CLAUDE.md mục 1). Khi xong, cập nhật trạng thái ở đây và báo theo khung 1a.

## Đang làm
- [ ] **T-000 Scaffold cấu trúc dự án** (theo `MASTER_PROMPT.md`)
  - Xong khi: `npm install` OK; `npm run lint`, `npm run typecheck` sạch; `npm run test:core` ra 1381/13/23/21; web chạy được, `/api/health` trả 200; worker khởi động và tắt sạch; (nếu có Docker) `supabase db reset` nạp đủ 113 task.

## Kế tiếp (theo thứ tự, chưa duyệt)
- [ ] **T-001 P0a: thử push trên desktop (localhost)** — đăng ký, gửi thử bằng `web-push`, bấm thông báo mở đúng trang, 404/410 vô hiệu hóa đăng ký.
- [ ] **T-002 Xác minh Supabase local** — chạy seed + điều chỉnh và chạy `rls_test.sql` trên Supabase local; ghi lại cách chạy vào README.
- [ ] **T-003 Đăng nhập + tạo plan từ template N3** — email/mật khẩu (Supabase Auth local); hộp thoại chọn: bản gốc 425 giờ hay kèm phần bổ sung; nhập ngày bắt đầu, giờ/ngày, ngày/tuần, múi giờ.
- [ ] **T-004 Màn Hôm nay** — task đang làm/tiếp theo, nút Xong, nhập số lần viết/phút luyện nói; ngày dự kiến hoàn thành và "giờ/ngày cần để xong trong 365 ngày".
- [ ] **T-005 Màn Lộ trình** — 113 task gập theo Phase, trạng thái, Start/Due tính từ `packages/core`.
- [ ] **T-006 Thao tác lịch** — Xong, Bỏ qua, Hoãn, Ghim ngày, Nghỉ N ngày; lưu `status`/`pinned_start`; cảnh báo `conflict`.
- [ ] **T-007 Màn Sắp tới + Cần mua** — từ `needByDates`/`planPurchases`; trạng thái tài nguyên; ngân sách theo tháng.
- [ ] **T-008 Xuất/nhập sao lưu** — file JSON dữ liệu của người dùng; thử khôi phục.
- [ ] **T-009 Cài đặt** — giờ nhắc, giờ yên tĩnh, ngày nghỉ cố định, múi giờ.
- [ ] **T-010 Nhắc việc** — `buildReminders` + `diffReminders` vào bảng `reminders`; worker gửi (desktop); nút "gửi thông báo thử".
- [ ] **T-011 Rà nội dung template** — thêm "Bộ đề JLPT N3" vào danh mục tài nguyên (task `PH3-TEST01` đang thiếu); điền `source_note`; xem lại giờ ước tính (đặc biệt Soumatome 25 giờ).
- [ ] **T-012 Dùng thật 2–4 tuần** — ghi giờ thật so với ước tính, ghi chỗ phiền, chỉnh.

## Bị chặn / hoãn
- [!] **T-013 P0b: thử push trên iPhone** — cần HTTPS công khai (đường hầm tạm hoặc server). Chờ user quyết định.
- [!] **Deploy Hetzner (P8)** — chờ user chủ động yêu cầu.
- [!] **Tùy biến bằng Gemini (P6), thu phí, mục tiêu khác (P7)** — chỉ sau khi có người dùng thật (P5).

## Câu hỏi đang mở (user chốt)
1. Đăng nhập: email/mật khẩu trước (giả định hiện tại) hay Google ngay?
2. Plan cá nhân dùng bản gốc 425 giờ hay kèm phần bổ sung (566 giờ)?
3. Điện thoại hằng ngày là iPhone hay Android?
4. Tên sản phẩm?
