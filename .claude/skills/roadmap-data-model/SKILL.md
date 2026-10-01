---
name: roadmap-data-model
description: "Mô hình dữ liệu Postgres/Supabase cho Roadmap Planner: bảng template (phase, task, tài nguyên), dữ liệu cá nhân (plan, trạng thái task, trạng thái tài nguyên), push_subscriptions, reminders (outbox), ai_usage, kèm RLS và script nạp template N3 gồm 113 task. Dùng skill này bất cứ khi nào viết migration, truy vấn Supabase, chính sách RLS, nạp hoặc sửa template lộ trình, thiết kế API đọc/ghi dữ liệu người dùng, hoặc khi hỏi 'lưu cái này ở đâu', kể cả khi chỉ nhắc 'database', 'bảng', 'user_id', 'Supabase Auth'."
---

# Data Model (Postgres/Supabase)

`references/schema.sql` là nguồn sự thật. `assets/n3-template.json` là template N3 (4 phase, 113 task, 10 tài nguyên). `scripts/import_template.py` nạp template, chạy lại nhiều lần vẫn an toàn.

## Hai nhóm bảng

**Danh mục dùng chung (chỉ đọc với người dùng):** `templates`, `template_phases`, `template_tasks`, `template_resources`, `template_task_resources`. Chỉ người dùng đã đăng nhập mới đọc, chỉ khi `templates.is_published`. Ghi bằng `service_role` (script nhập, trang quản trị).

**Dữ liệu cá nhân (chỉ chủ sở hữu):** `plans`, `plan_task_state`, `plan_resource_state`, `push_subscriptions`, `reminders` (chỉ đọc với người dùng; worker ghi), `ai_usage` (chỉ đọc; server ghi).

Tách như vậy để người dùng sửa template của mình (bỏ task, đổi giờ) mà không đụng vào danh mục gốc: mọi tùy biến nằm ở `plan_task_state` và `plans`.

## Quy tắc

- **Không lưu ngày Start/Due.** Chỉ lưu `plans.start_date`, `hours_per_day`, `days_per_week` và `plan_task_state.status/pinned_start`. Xem `roadmap-schedule-engine`.
- **Mọi bảng cá nhân có RLS bật.** Policy dùng `(select auth.uid())` để Postgres đánh giá một lần cho cả truy vấn thay vì từng hàng. Bảng con (`plan_task_state`, `plan_resource_state`) kiểm tra quyền qua `plans`, nên khi chèn phải có `plan_id` thuộc về mình.
- **Không bao giờ để client ghi `reminders` hoặc `ai_usage`.** Nếu cho phép, người dùng tự cấp mình thêm hạn mức AI hoặc giả mạo thông báo. Hai bảng này chỉ có policy `select`.
- **`service_role` bỏ qua RLS:** chỉ dùng ở server/worker, không đặt vào biến `NEXT_PUBLIC_*`. Với API route chạy theo danh nghĩa người dùng, dùng client có JWT của họ để RLS vẫn có hiệu lực.
- **Tạo plan:** copy trạng thái mặc định cho mọi task. Task `optional` chưa được chọn thì `status = 'skipped'`; tài nguyên `tier = 'optional'` thì `opted_in = false`.
- **`origin` và `optional` của task:** `v4.1` là lộ trình gốc của tác giả (99 task, 425 giờ); `v4.2-added` là phần bổ sung (14 task, +141 giờ) đánh dấu `optional`. Người dùng chọn dùng bản nào khi tạo plan. Cộng hai phần ra 566 giờ.
- Kiểu `numeric` cho giờ, `DATE` cho ngày (không dùng `timestamptz` cho ngày học).
- Template cần thêm `source_note` (giáo trình nào, ai duyệt) trước khi mở cho người khác; đây là nơi ghi nguồn gốc của lộ trình, vì lộ trình chưa được kiểm chứng ngoài kinh nghiệm cá nhân.

## Vấn đề dữ liệu đã biết trong template N3

- Task `PH3-TEST01` (thi thử) dùng "Bộ đề JLPT N3 mốc các năm" nhưng danh mục chi phí không có mục này, nên không có nhắc mua. Cần thêm tài nguyên hoặc ghi rõ là nguồn miễn phí.
- `buy_url` còn trống và `is_affiliate = false` cho mọi tài nguyên; điền khi có link, và đặt `is_affiliate = true` nếu là link tiếp thị liên kết.
- Giá và thời gian giao hàng mặc định (5 ngày) là giá trị khởi đầu, chưa kiểm chứng; điền `price_checked_at` khi cập nhật.

## Nạp và kiểm thử

```bash
pip install psycopg2-binary
DATABASE_URL=postgresql://... python3 scripts/import_template.py --publish
```
`scripts/rls_test.sql` kiểm tra RLS bằng hai người dùng giả (cách chuẩn bị ở đầu file): người B không đọc, sửa, chèn hay mạo danh được dữ liệu của người A; người dùng không ghi được danh mục, `reminders`; template chưa xuất bản không đọc được. Đã chạy đạt trên Postgres 16 thường, **chưa chạy trên Supabase thật** (Auth và vai trò khác một chút), nên chạy lại bản kiểm thử trên project Supabase trước khi mở cho người khác.
