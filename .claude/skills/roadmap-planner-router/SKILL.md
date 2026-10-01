---
name: roadmap-planner-router
description: "Router cho dự án web 'Roadmap Planner': app lập lộ trình học/mục tiêu chi tiết (lịch tự tính theo ngày, theo dõi tiến độ, nhắc học, nhắc mua sách theo ngày cần có, tạo lộ trình tùy biến bằng Gemini), chạy trên Next.js + Supabase + Hetzner, dùng như PWA trên điện thoại. LUÔN dùng skill này đầu tiên bất cứ khi nào người dùng nhắc đến lộ trình học, task/Phase, lịch Start/Due, Hoãn/Nghỉ/Skip task, nhắc học hoặc mua sách, ngân sách sách, thông báo đẩy/PWA/iPhone, Gemini tạo lộ trình, template N3, deploy Hetzner/Docker/Supabase cho app này, kể cả khi họ không nói tên dự án. Router quyết định đọc skill con nào (schedule-engine, data-model, budget-resources, push-reminders, ai-generation, deploy-hetzner) và áp các nguyên tắc bất biến của dự án."
---

# Roadmap Planner: Router và nguyên tắc bất biến

Skill này là điểm vào của cả bộ. Việc của nó: (1) nhận diện người dùng đang làm phần nào, (2) chuyển sang đúng skill con, (3) giữ các nguyên tắc dùng chung không bị phá khi viết code.

## Chế độ hiện tại: local-first

Giai đoạn này chỉ phát triển và thử **trên máy local** (Supabase CLI + Docker, `npm run dev`). Không deploy, không đụng server Hetzner, không chạy lệnh tác động Supabase cloud. Skill `roadmap-deploy-hetzner` chỉ đọc khi người dùng chủ động yêu cầu triển khai. Kiểm thử trên iPhone cần HTTPS công khai nên được hoãn cho đến khi người dùng quyết định (xem `roadmap-push-reminders`).

## Sản phẩm là gì (và không là gì)

App web (PWA) giúp một người **vạch lộ trình, theo dõi việc hằng ngày, và biết khi nào phải mua sách**. Template đầu tiên là lộ trình tự học JLPT N3 + Song ngữ IT do chính tác giả biên soạn và đang tự dùng. Bản đầu dùng cho một người, nhưng mọi thứ thiết kế để mở cho nhiều người.

**Ranh giới phạm vi (giữ chặt, đây là cách app không biến thành khóa học):** app *không chứa nội dung học*: không bài giảng, không ngân hàng đề, không flashcard, không chấm bài, không cộng đồng. App chỉ sắp xếp việc học bằng nội dung có sẵn bên ngoài (sách, app, đề) và theo dõi điểm thi thử do người dùng tự nhập. Nếu yêu cầu mới trượt khỏi ranh giới này, nói rõ và đề xuất cách giữ phạm vi.

## Bảng định tuyến

| Người dùng đang làm gì | Đọc skill |
|---|---|
| Tính ngày Start/Due, Done/Skipped, Hoãn/Ghim/Nghỉ, "hôm nay", giờ/ngày, ngày/tuần | `roadmap-schedule-engine` |
| Bảng CSDL, RLS, migration, nạp template N3, Supabase Auth, quyền truy cập dữ liệu | `roadmap-data-model` |
| Mua sách/app, ngày cần có, hạn đặt, ngân sách theo tháng, link affiliate, giá | `roadmap-budget-resources` |
| Thông báo, PWA, service worker, VAPID, iPhone, worker gửi nhắc, đăng ký push | `roadmap-push-reminders` |
| Gemini tạo/điều chỉnh lộ trình, prompt, schema đầu ra, hạn mức AI, chi phí AI | `roadmap-ai-generation` |
| Hetzner, Docker Compose, HTTPS, domain, secrets, sao lưu, CI/CD, giám sát (chỉ khi người dùng yêu cầu triển khai) | `roadmap-deploy-hetzner` |

Việc cắt qua nhiều skill thì đọc theo thứ tự: `data-model` -> `schedule-engine` -> `budget-resources` -> `push-reminders` -> `ai-generation` -> `deploy-hetzner`, vì phần sau dựa vào phần trước (nhắc việc cần lịch, lịch cần dữ liệu).

## Cấu trúc mã đề xuất

```
apps/web            Next.js (App Router, TypeScript): giao diện + route API
apps/worker         Node: đọc bảng reminders mỗi phút, gửi Web Push
packages/core       schedule.ts, budget.ts, reminders.ts, adjustments.ts  (hàm thuần, có test)
supabase/migrations schema.sql (từ roadmap-data-model)
```
Một ngôn ngữ (TypeScript) cho cả trình duyệt lẫn worker, để lịch ở mọi nơi tính bằng *cùng một hàm*. Python/FastAPI chỉ thêm khi cần tái dùng worker Gemini có sẵn.

## Nguyên tắc bất biến (kèm lý do)

1. **Ngày tháng do mã tính, không do LLM và không lưu ngày suy ra.** Chỉ lưu: `start_date`, `hours_per_day`, `days_per_week`, `status`, `pinned_start`. Lịch đổi mỗi lần trạng thái đổi; ngày lưu sẵn sẽ lệch.
2. **Ngày là `DATE`; "hôm nay" tính theo múi giờ người dùng** (`todayInTimeZone`) rồi truyền vào hàm thuần. Hàm thuần không tự đọc đồng hồ, nên test được.
3. **Mọi dữ liệu cá nhân gắn `user_id` (hoặc qua `plan_id`) và có RLS từ ngày đầu**, dù chỉ có một người dùng. Khóa `service_role` chỉ ở server/worker, không bao giờ ra trình duyệt.
4. **LLM chỉ chọn trong danh mục và đề xuất số trong biên cho phép**; đầu ra bị kiểm tra trước khi dùng (xem `roadmap-ai-generation`).
5. **Không phụ thuộc vào push.** Push trên iOS cần PWA đã cài và có thể ngừng bất ngờ; luôn có màn "Hôm nay", "Sắp tới", "Cần mua" trong app.
6. **Trung thực với người dùng:** giờ học là *ước tính* (các nguồn ngoài ước tính N3 từ số 0 trong khoảng 450 đến 1.700 giờ), không hứa đậu hay mốc thời gian; giá là "giá tham khảo + ngày cập nhật"; link affiliate phải ghi rõ.
7. **Công thức lịch chỉ đổi khi test chuẩn vẫn đạt.** `roadmap-schedule-engine/references/golden-vectors.json` lấy từ file Sheet gốc; sửa công thức mà làm lệch đáp án là lỗi, trừ khi chủ dự án chủ động đổi quy tắc.

## Quan hệ với skill `lms-security-implementation`

Skill đó dành riêng cho dự án AI-Powered LMS (Spring Boot, Celery). Đừng áp các luật riêng của LMS (`@PreAuthorize`, FFmpeg, DTO của Entity) vào code này. Chỉ dùng chung *tinh thần*: không hardcode khóa, coi đầu ra LLM là dữ liệu không tin cậy, sanitize prompt, giới hạn tần suất.

## Đã kiểm chứng gì, chưa kiểm chứng gì

Đã chạy test thật: bộ tính lịch (1.381 phép kiểm tra, phần lớn so từng ngày với file Sheet), lịch mua sách, tạo nhắc việc, kiểm tra đầu ra AI, schema Postgres + RLS với hai người dùng giả trên Postgres 16 thường.
**Chưa kiểm chứng (cần làm khi có app):** hành vi riêng của Supabase (Auth thật, vai trò), thông báo push trên iPhone thật, `docker compose` với app thật, gọi Gemini thật. Đừng coi các phần này là đã xong.
