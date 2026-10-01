# UpComming_Plan — việc đang làm và sắp làm

> Chế độ: **local-only**. Trạng thái: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong · `[!]` bị chặn.
> Mỗi task cần user confirm trước khi bắt đầu (CLAUDE.md mục 1). Khi xong, cập nhật trạng thái ở đây và báo theo khung 1a.

## Đang làm
- [x] **T-000 Scaffold cấu trúc dự án** (theo `MASTER_PROMPT.md`)
  - Xong khi: `npm install` OK; `npm run lint`, `npm run typecheck` sạch; `npm run test:core` ra 1381/13/23/21; web chạy được, `/api/health` trả 200; worker khởi động và tắt sạch; (nếu có Docker) `supabase db reset` nạp đủ 113 task.
  - Đã đạt đủ (có Docker): lint/typecheck/test:core sạch, 1381/13/23/21; seed đủ 4 phase/113 task/10 tài nguyên/193 liên kết, 566h tổng/425h bắt buộc; RLS test đạt (RLS OK) trên Supabase local thật; web + worker chạy và tắt sạch. Nhánh `feat/scaffold`.

## Kế tiếp (theo thứ tự, chưa duyệt)
- [ ] **T-001 P0a: thử push trên desktop (localhost)** — đăng ký, gửi thử bằng `web-push`, bấm thông báo mở đúng trang, 404/410 vô hiệu hóa đăng ký.
- [x] **T-002 Xác minh Supabase local** — chạy seed + `rls_test.sql` (gồm cả RPC `create_plan`) trên Supabase local, in `RLS OK`; cách chạy đã ghi vào README.
- [x] **T-003 Đăng nhập + tạo plan từ template N3** — email/mật khẩu (Supabase Auth local, xác nhận email tắt ở local); `/create-plan` chọn bản gốc 425h hay kèm bổ sung 566h, ngày bắt đầu, giờ/ngày, ngày/tuần, múi giờ mặc định `Asia/Ho_Chi_Minh`. Tạo plan qua RPC `create_plan` (1 transaction, SECURITY INVOKER, v1 mỗi user 1 plan). `proxy.ts` bảo vệ nhóm `(app)`, `(app)/layout.tsx` chuyển hướng sang `/create-plan` nếu chưa có plan.
- [x] **T-004 Màn Hôm nay** — task đang làm/tiếp theo (tính bằng `computeSchedule` từ `@roadmap/core`, không lưu ngày vào DB), nút Xong (lưu `status='done'`, `done_on` theo múi giờ plan), ngày dự kiến hoàn thành, "giờ/ngày cần để xong trong 365 ngày". Chưa làm: nhập số lần viết/phút luyện nói (để sau, chưa có trong phạm vi lượt này).
- [x] **T-004c Ghi nhận hằng ngày** — form (số lần viết/độ chính xác Kana nhập 0-100 lưu 0-1/phút luyện nói) trên `/today` (task hiện tại) và mọi task ở `/roadmap` (kể cả done — ghi bổ sung sau). Khối thống kê trên `/today`: tổng số lần viết, tổng phút luyện nói, mức thành thục tập viết trung bình (`writingMastery` trong `packages/core/src/progress.ts`, có test — loại task `writing_target=0`, chặn ở 1 khi vượt chỉ tiêu, rỗng trả 0). Ghi qua `tracking-mutations.ts` (nhận `SupabaseClient` có sẵn), parser thuần `tracking-forms.ts` (có test).
- [x] **T-004b "Đã học đến đâu"** — lúc tạo plan: tùy chọn "Mình đã học XONG đến hết task…" (gộp vào RPC `create_plan` tham số thứ 7 `p_done_up_to_code`, `done_on` để null). Sau khi có plan: `/settings/update-progress` (tạm đặt ở Cài đặt tới khi có màn Lộ trình), đi qua RPC `update_plan_progress` (tự suy plan từ `auth.uid()`, không nhận `plan_id`), có bước xem trước (task tiếp theo + số lượng + task đầu/cuối) rồi mới xác nhận; kết quả thật hiển thị qua `?updated=N` lấy từ giá trị RPC trả về, không tin số đếm bước xem trước. Logic "task nào <= ngưỡng" nằm ở `packages/core/src/progress.ts` (`tasksToMarkDone`, `nextTaskAfter`), có test.
- [x] **T-005 Màn Lộ trình (chỉ đọc)** — `/roadmap`: 113 task gập theo Phase bằng `<details>` (không JS), Phase chứa task hiện tại mở sẵn; mỗi task hiện tên/nhãn trạng thái chữ/giờ ước tính/Start-Due (hoặc nhãn thay thế nếu done/skipped); task optional-skip hiển thị mờ + "(tùy chọn)"; đầu trang có số xong/tổng (loại task skipped khỏi mẫu số) + ngày dự kiến hoàn thành + link nhảy tới task hiện tại. Dùng lại `loadCurrentPlanSchedule`/`loadPublishedTemplateOutline`, không tính lại lịch. Thêm `currentTaskId`, `groupTasksByPhase` vào `packages/core` (có test), `/today` đã đổi sang dùng `currentTaskId` dùng chung. Thêm `scripts/test-integration.mts` + `npm run check:full` xác nhận Hôm nay và Lộ trình luôn khớp dữ liệu thật qua Supabase local. Chưa làm: mọi thao tác ghi (Bỏ qua/Hoãn/Ghim/Nghỉ) — để T-006.
- [x] **T-006 Thao tác lịch trên `/roadmap`** — Bỏ qua/Bỏ "bỏ qua" (todo/in_progress ⇄ skipped, không áp dụng task done), Hoãn N ngày (`delayTask`), Ghim ngày/Xóa ghim (`pinTask`, hiện cảnh báo `conflict`/`pinClamped`), Nghỉ N ngày (`insertBreak`). Logic ghi tập trung ở `apps/web/src/lib/schedule-mutations.ts` (nhận `SupabaseClient` có sẵn, không import `next/headers`) để Server Action và `scripts/test-schedule-*.mts` gọi chung — không viết lại logic lịch, chỉ gọi `@roadmap/core`. "FormData → tham số" là hàm thuần (`schedule-forms.ts`, có test 23/23). 4 script tích hợp riêng từng thao tác (`test-schedule-{skip,delay,pin,break}.mts`, dùng `scripts/integration-helpers.mts` chung) xác nhận DB+lịch đúng, user khác không tác động được, luôn dọn user test (try/finally), không `db reset`; đã nối vào `npm run check:full`. Lỗi và "không đổi gì" (vd Nghỉ từ ngày không còn task nào) hiện qua banner trên `/roadmap`.
- [ ] **T-007 Màn Sắp tới + Cần mua** — từ `needByDates`/`planPurchases`; trạng thái tài nguyên; ngân sách theo tháng.
- [x] **T-008 Xuất/nhập sao lưu** — Cài đặt → "Tải bản sao lưu" (`GET /api/backup`, `Content-Disposition: attachment; filename="roadmap-backup-YYYY-MM-DD.json"`, không có `user_id`/email/khóa) và "Khôi phục từ bản sao lưu" (2 bước: Xem trước — thiết lập + số task theo trạng thái + cảnh báo ghi đè — rồi Xác nhận). Validate zod strict (từ chối khóa lạ) + giới hạn 1 MB + mọi code phải thuộc đúng template (tối đa 10 lỗi) ở `apps/web/src/lib/backup.ts` (thuần, có test). Ghi atomic qua RPC `import_plan_backup` (migration mới, SECURITY INVOKER, thay toàn bộ plan hiện có của user, từ chối nguyên khối nếu payload sai — đã kiểm bằng `rls_test.sql`: B không ghi đè được A, anon bị chặn, payload sai không để lại dữ liệu dở, gọi 2 lần ra cùng kết quả, đúng 1 hàm). Test tích hợp vòng tròn `scripts/test-backup-roundtrip.mts`: thao tác đa dạng (done/skipped/hoãn/ghi nhận hằng ngày/trạng thái tài nguyên) → export → xóa plan → import → export lại → so khớp từng trường + `computeSchedule` cùng kết quả.
- [ ] **T-009 Cài đặt** — giờ nhắc, giờ yên tĩnh, ngày nghỉ cố định, múi giờ.
- [ ] **T-010 Nhắc việc** — `buildReminders` + `diffReminders` vào bảng `reminders`; worker gửi (desktop); nút "gửi thông báo thử".
- [ ] **T-011 Rà nội dung template** — thêm "Bộ đề JLPT N3" vào danh mục tài nguyên (task `PH3-TEST01` đang thiếu); điền `source_note`; xem lại giờ ước tính (đặc biệt Soumatome 25 giờ).
- [ ] **T-012 Dùng thật 2–4 tuần** — ghi giờ thật so với ước tính, ghi chỗ phiền, chỉnh.

## Bị chặn / hoãn
- [!] **T-013 P0b: thử push trên iPhone** — cần HTTPS công khai (đường hầm tạm hoặc server). Chờ user quyết định.
- [!] **Deploy Hetzner (P8)** — chờ user chủ động yêu cầu.
- [!] **Tùy biến bằng Gemini (P6), thu phí, mục tiêu khác (P7)** — chỉ sau khi có người dùng thật (P5).

## Câu hỏi đang mở (user chốt)
1. ~~Đăng nhập: email/mật khẩu trước hay Google ngay?~~ → đã chốt: email/mật khẩu (T-003).
2. Plan cá nhân dùng bản gốc 425 giờ hay kèm phần bổ sung (566 giờ)?
3. Điện thoại hằng ngày là iPhone hay Android?
4. Tên sản phẩm?
