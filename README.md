# Roadmap Planner

PWA vạch lộ trình học/mục tiêu chi tiết: lịch tự tính theo ngày, theo dõi tiến độ, nhắc học, nhắc mua
sách theo ngày cần có. Bản đầu dùng cho lộ trình tự học JLPT N3 + Song ngữ IT.

Xem `docs/PLAN.md` (kế hoạch) và `docs/UpComming_Plan.md` (việc đang làm). Luật làm việc trong
`CLAUDE.md`. **Chế độ hiện tại: local-only** — không deploy, không đụng Supabase cloud/Hetzner.

## Yêu cầu máy

- Node 22 (xem `.nvmrc`), npm
- Docker (để chạy Supabase local qua Supabase CLI) — tùy chọn, chỉ cần khi đụng tới dữ liệu/RLS

## Cài đặt và chạy

```bash
npm install
cp .env.example apps/web/.env.local   # tự điền giá trị thật, xem chú thích trong file
npm run db:start                      # khởi động Supabase local (cần Docker)
npm run dev:web                       # http://localhost:3100 (cố định cổng 3100, tránh đụng cổng 3000 hay bị chiếm)
npm run dev:worker                    # worker: chỉ in nhịp tim, chưa gửi push thật
```

## Kiểm tra

```bash
npm run check       # lint + typecheck + test:core + test apps/web — KHÔNG cần Supabase đang chạy
npm run lint
npm run typecheck
npm run test:core
npm run test:web
```

`npm run check:full` = `check` + `test:integration` (script tích hợp thật, xem bên dưới) — **bắt buộc**
chạy trước khi báo xong hoặc gộp vào `develop` với mọi nhánh `feat/*` đụng DB/RPC/form/Server Action
(xem CLAUDE.md mục 8a).

## Supabase local (seed + RLS)

```bash
npm run db:start          # lần đầu sẽ kéo image Docker, có thể mất vài phút
npm run db:seed:gen       # sinh lại supabase/seed.sql từ data/n3-template.json (nếu sửa template)
npm run db:reset          # áp lại migration + seed sạch — XÓA MỌI TÀI KHOẢN/PLAN LOCAL, kể cả thật
                           # (xem mục "Sao lưu" bên dưới để giữ tiến độ trước khi chạy)
npm run db:migrate        # áp migration MỚI mà GIỮ dữ liệu hiện có (npx supabase migration up)

# Kiểm tra RLS (tạo vài người dùng giả, xác nhận không rò rỉ dữ liệu). CẢNH BÁO: script này đặt
# templates.is_published=false và để lại vài user giả — nếu DB đã có tài khoản thật, KHÔNG chạy
# `db:reset` để dọn (sẽ xóa luôn tài khoản thật); thay vào đó sửa tay:
#   update templates set is_published = true;
#   delete from auth.users where id::text like '00000000%';
docker exec -i supabase_db_np3 psql -U postgres -d postgres < scripts/rls_test.sql
```

Supabase Studio: http://127.0.0.1:54323 sau khi `db:start`.

## Kiểm thử tích hợp (`test:integration` / `check:full`)

`npm run test:integration` chạy một loạt script `scripts/test-*.mts`, mỗi script tạo (các) user thật
qua Auth, thao tác thật qua Supabase local (tạo plan, Bỏ qua/Hoãn/Ghim/Nghỉ, ghi nhận hằng ngày, xuất/
nhập sao lưu...), xác nhận DB + kết quả tính bằng `@roadmap/core` đúng và user khác không tác động
được. Luôn tự xoá user test khi kết thúc (kể cả khi lỗi giữa chừng, qua `try/finally`), **không**
`db reset`.

Cần `npm run db:start` trước, rồi lấy 3 giá trị bằng `npx supabase status` và truyền trên dòng lệnh
(script không đọc `.env*`, không có giá trị mặc định hardcode):

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:integration
# hoặc chạy kèm cả bộ còn lại:
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run check:full
```

Script từ chối chạy nếu `SUPABASE_URL` không trỏ tới `127.0.0.1`/`localhost`.

## Cấu trúc

- `packages/core` — hàm thuần (lịch, ngân sách, nhắc việc, kiểm tra điều chỉnh AI), dùng chung cho
  web và worker để không bao giờ lệch lịch.
- `apps/web` — Next.js (App Router), PWA.
- `apps/worker` — worker Node, sau này gửi Web Push theo outbox `reminders`.
- `supabase/` — schema, migration, seed.
- `deploy/` — mẫu Hetzner, **chưa dùng** (xem `deploy/README.md`).

## Sao lưu (tải xuống trước khi `db reset`)

`npm run db:reset` xóa sạch toàn bộ DB local, **kể cả tài khoản và plan thật của bạn**. Trước khi chạy
lệnh này (hoặc trước khi thử nghiệm gì rủi ro), vào **Cài đặt → Sao lưu → Tải bản sao lưu** (hoặc gọi
`GET /api/backup` khi đã đăng nhập) để tải file `roadmap-backup-YYYY-MM-DD.json`. Sau khi `db reset`,
đăng ký lại tài khoản rồi vào **Cài đặt → Khôi phục từ bản sao lưu**, chọn file vừa tải, xem trước rồi
xác nhận — toàn bộ tiến độ (trạng thái task, ghi nhận hằng ngày, trạng thái mua sách) sẽ được khôi
phục lại nguyên vẹn. File sao lưu không chứa `user_id`, email hay bất kỳ khóa nào.

## Lưu ý

- Thử thông báo push trên iPhone cần HTTPS công khai nên nằm ngoài scaffold này (xem T-013 trong
  `docs/UpComming_Plan.md`).
- Icon PWA trong `apps/web/public/icons/` là khối màu tạm, sinh bằng `apps/web/scripts/gen-icons.mjs`
  — cần thay bằng icon thiết kế thật trước khi dùng thật.
- Đăng ký tài khoản ở local **không cần xác nhận email** (`enable_confirmations = false` trong
  `supabase/config.toml`) để tiện tự test. **Phải bật lại trước khi deploy production**, nếu không
  bất kỳ ai cũng tạo được tài khoản bằng email giả.
