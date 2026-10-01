# Master prompt: dựng cấu trúc dự án Roadmap Planner bằng Claude Code

## Cách dùng (3 bước)

1. **Giải nén bộ này thành thư mục dự án** và mở terminal ở đó. Cấu trúc phải như sau (thư mục `.claude/skills` phải có sẵn **trước khi** mở Claude Code, vì tạo thư mục skill mới giữa phiên đòi hỏi khởi động lại):
   ```
   roadmap-planner/
   ├── CLAUDE.md
   ├── MASTER_PROMPT.md          (file này)
   ├── docs/PLAN.md
   ├── docs/UpComming_Plan.md
   └── .claude/skills/roadmap-*/   (7 skill)
   ```
2. **Mở Claude Code tại thư mục đó**, gõ `/skills` và kiểm tra thấy đủ 7 skill `roadmap-*`.
3. **Dán nguyên khối prompt bên dưới.** Claude Code sẽ làm theo hai pha: Pha A chỉ lập kế hoạch rồi dừng chờ bạn gõ `OK`; Pha B mới tạo file.

**Điều kiện máy:** Node 22+, npm, git. Docker (cho Supabase local) là tùy chọn lúc scaffold: có thì kiểm tra được phần cơ sở dữ liệu, không có thì phần đó được ghi rõ là chưa kiểm chứng.

## Prompt (dán nguyên khối)

````markdown
Bạn đang làm việc trong thư mục gốc của dự án **Roadmap Planner** (web app PWA vạch lộ trình học, lịch tự tính theo ngày, nhắc học và nhắc mua sách). Nhiệm vụ của lượt này: **dựng cấu trúc dự án cơ bản (scaffold)**, chưa viết tính năng.

## 0. Đọc trước, theo thứ tự
1. `CLAUDE.md` (luật cứng, bạn phải tuân thủ suốt phiên).
2. `docs/PLAN.md` và `docs/UpComming_Plan.md`.
3. `.claude/skills/roadmap-planner-router/SKILL.md`, rồi `SKILL.md` của 6 skill con và các tệp trong `scripts/`, `references/`, `assets/` của chúng (đây là nguồn mã và dữ liệu đã được kiểm thử, bạn sẽ chép từ đó).

## 1. Chế độ làm việc
- **LOCAL-ONLY.** Không deploy, không ssh, không `supabase link`/`db push`, không gọi dịch vụ đám mây, không dựng đường hầm.
- Không tạo/sửa/đọc `.env*` (chỉ viết `.env.example`).
- Không sửa `CLAUDE.md`, `docs/PLAN.md`, và bất cứ thứ gì trong `.claude/skills/`. Chỉ được cập nhật trạng thái trong `docs/UpComming_Plan.md`.
- Không thêm dependency ngoài danh sách ở `CLAUDE.md` mục 9 mà chưa hỏi.
- **Không viết tính năng thật** trong lượt này: không đăng nhập hoàn chỉnh, không giao diện nghiệp vụ, không worker gửi thật, không Gemini, không thanh toán, không file triển khai chạy được.

## 2. PHA A: chỉ lập kế hoạch (CHƯA tạo hay sửa file nào)
Trả lời bằng đúng 5 mục rồi DỪNG, chờ tôi gõ `OK`:
1. Tóm tắt những gì bạn hiểu về dự án (tối đa 10 dòng) để tôi xác nhận.
2. Cây thư mục sẽ tạo (theo mục 3) và bất kỳ chỗ nào bạn muốn khác đi, kèm lý do.
3. Danh sách lệnh sẽ chạy.
4. Danh sách dependency sẽ cài, đối chiếu với `CLAUDE.md` mục 9; ghi rõ cái nào nằm ngoài danh sách.
5. Các điểm chưa rõ hoặc rủi ro cần tôi quyết (kể cả: dùng `create-next-app` hay tạo tay; Docker có sẵn không).

## 3. PHA B: triển khai (chỉ sau khi tôi gõ OK)
Cấu trúc đích:
```
./
├── CLAUDE.md  MASTER_PROMPT.md  (có sẵn, giữ nguyên)
├── .claude/skills/              (có sẵn, giữ nguyên)
├── docs/PLAN.md  UpComming_Plan.md
├── README.md                    (tạo: cách chạy local)
├── package.json                 (private; workspaces: apps/*, packages/*)
├── .nvmrc  .gitignore  .env.example  tsconfig.base.json  eslint.config.mjs
├── .github/workflows/ci.yml     (lint, typecheck, test:core; chưa bắt buộc)
├── data/n3-template.json
├── packages/core/               (@roadmap/core)
├── apps/web/                    (@roadmap/web, Next.js)
├── apps/worker/                 (@roadmap/worker, Node)
├── supabase/                    (config.toml, migrations/, seed.sql)
├── scripts/                     (gen-seed.ts, import_template.py, rls_test.sql)
└── deploy/                      (mẫu Hetzner, CHƯA DÙNG)
```

Làm tuần tự B1 → B8. Sau mỗi bước chạy kiểm tra liên quan; chỉ sang bước sau khi bước trước đạt.

### B1. Gốc repo
- Kiểm tra `git status`. Nếu chưa là repo: `git init`, tạo nhánh `main` và `develop`, rồi làm việc trên nhánh `feat/scaffold`. Nếu đã là repo: tạo `feat/scaffold` từ nhánh hiện tại.
- `package.json` gốc với scripts: `lint`, `typecheck`, `test:core`, `check` (= lint + typecheck + test:core), `dev:web`, `dev:worker`, `db:start`, `db:stop`, `db:reset` (bọc `supabase` CLI), `db:seed:gen`.
- `.nvmrc` = 22. `.gitignore`: `node_modules`, `.next`, `dist`, `.env*` nhưng giữ `!.env.example`, `supabase/.temp`, `supabase/.branches`, `coverage`, `.DS_Store`.
- `tsconfig.base.json` strict. `eslint.config.mjs` (flat config, `typescript-eslint`): cấm `no-explicit-any`, `no-unused-vars` (cho phép tên bắt đầu `_`), và **bỏ qua** `.claude/**`, `deploy/**`, `**/.next/**`, `**/dist/**`.
- `.env.example`: mọi biến cần có kèm chú thích nguồn giá trị (URL/khóa Supabase local do `supabase start` in ra; VAPID tạo bằng `npx web-push generate-vapid-keys --json`; `GEMINI_API_KEY`/`GEMINI_MODEL` để trống; `AI_DAILY_LIMIT_PER_USER`). Không có giá trị thật.

### B2. `packages/core` (chép mã đã kiểm thử, KHÔNG đổi logic)
Chép: `schedule.ts` từ `roadmap-schedule-engine/scripts/`; `budget.ts` từ `roadmap-budget-resources/scripts/`; `reminders.ts` từ `roadmap-push-reminders/scripts/`; `adjustments.ts` từ `roadmap-ai-generation/scripts/` → `packages/core/src/`.
- Sửa **chỉ** đường import: các import tương đối sang skill khác thành `./schedule` và `./budget` (không đuôi `.ts`).
- `src/index.ts`: `export *` từ 4 module.
- Chép `roadmap-schedule-engine/references/golden-vectors.json` và `roadmap-data-model/assets/n3-template.json` → `packages/core/tests/fixtures/`. Chép thêm `n3-template.json` → `data/`.
- Chép 4 bộ test: `run-golden.mts` → `tests/schedule.test.mts`, và `run-tests.mts` của budget/push-reminders/ai-generation → `tests/budget.test.mts`, `tests/reminders.test.mts`, `tests/adjustments.test.mts`. Sửa **chỉ** đường import (về `../src/...`) và đường dẫn fixture (`./fixtures/...`). Không đổi bất kỳ phép kiểm tra nào.
- `package.json` (`@roadmap/core`, `"type": "module"`, `exports` trỏ `./src/index.ts`, scripts `test` chạy tuần tự 4 file bằng `tsx`, `typecheck`, `lint`). `tsconfig.json` kế thừa base: `strict`, `moduleResolution: Bundler`, `noUnusedLocals`, `noUnusedParameters`, `types: ["node"]`, include `src` và `tests`.
- **Cổng:** `npm run test:core` phải in đúng `1381/1381`, `13/13`, `23/23`, `21/21` kiểm tra đạt; `tsc` sạch. Nếu lệch, dừng và báo, không sửa test cho khớp.

### B3. `supabase/` và dữ liệu
- `npx supabase init` (chỉ tạo `config.toml` local; không `link`).
- Tạo migration đầu bằng `npx supabase migration new init`, dán nội dung nguyên văn của `roadmap-data-model/references/schema.sql` (không sửa).
- Viết `scripts/gen-seed.ts` sinh `supabase/seed.sql` từ `data/n3-template.json`: nạp 1 template `is_published = true`, 4 phase, 113 task, 10 tài nguyên, liên kết task-tài nguyên (liên kết bằng `code`, không hardcode UUID). Kiểm tra `supabase/config.toml` đã trỏ đúng tới `seed.sql`.
- Chép `roadmap-data-model/scripts/import_template.py` và `rls_test.sql` vào `scripts/` (tham khảo, không bắt buộc dùng).
- **Nếu có Docker:** `npx supabase start`, `npx supabase db reset`, rồi xác nhận bằng truy vấn: 4 phase, 113 task, 10 tài nguyên, 193 liên kết task-tài nguyên, tổng `est_hours` = 566, tổng của task `optional = false` = 425. Điều chỉnh `rls_test.sql` cho khớp cách giả lập người dùng của Supabase local, chạy đạt, và ghi cách chạy vào README. **Nếu không có Docker:** ghi rõ "chưa kiểm chứng phần DB" và đừng cài Postgres riêng.

### B4. `apps/web` (Next.js, App Router, TypeScript strict, Tailwind)
- Dùng `create-next-app` không tương tác hoặc tạo tay (theo điều đã chốt ở Pha A). `next.config` có `transpilePackages: ['@roadmap/core']`. Import core bằng `@roadmap/core`.
- **Design token** trong `globals.css` (CSS variables) ánh xạ vào Tailwind theme: `ink`, `ink-muted`, `ink-faint`, `surface`, `surface-raised`, `line`, `accent`. Chừa safe-area (`env(safe-area-inset-*)`).
- `src/app/layout.tsx`: `viewport-fit=cover`, link `manifest.webmanifest`, `apple-touch-icon`, `theme-color`, `lang="vi"`. Điều hướng đáy kiểu điện thoại với biểu tượng `lucide-react` outline.
- Trang placeholder (mỗi trang chỉ có tiêu đề + dòng "Chưa triển khai (xem T-00x trong UpComming_Plan)"): `(auth)/login`, `(app)/today`, `(app)/upcoming`, `(app)/roadmap`, `(app)/buy`, `(app)/settings`. Trang gốc chuyển hướng tới `/today`.
- API: `api/health` trả `{ ok: true }`; `api/push/subscribe` trả 501 JSON "chưa triển khai".
- `src/lib/`: `supabase/client.ts` và `supabase/server.ts` (dùng `@supabase/ssr`, chỉ khóa anon công khai), `errors.ts` (`AppError`, `toUserMessage`), `copy.ts` (chuỗi hiển thị, gồm các câu trung thực: giờ là ước tính, giá tham khảo, nhãn affiliate), `env.ts` (kiểm tra biến môi trường công khai bằng `zod`). `QueryProvider` cho TanStack Query.
- PWA: `public/manifest.webmanifest` (`display: standalone`), `public/sw.js` (mẫu trong `roadmap-push-reminders/references/worker-and-client.md`, **chưa đăng ký**), icon PNG tạm tạo bằng một script Node chỉ dùng module có sẵn (ghi TODO thay icon thật).
- **Không** để khóa `service_role` hoặc bí mật vào `NEXT_PUBLIC_*` hay file client.

### B5. `apps/worker`
- `@roadmap/worker`: `src/index.ts` đọc env bằng `zod`, import một hàm từ `@roadmap/core` (vd `todayInTimeZone`) để chứng minh nối workspace, ghi nhịp tim mỗi 60 giây ra log, tắt gọn khi nhận `SIGINT`/`SIGTERM`. **Không gửi gì.** Scripts: `dev` (`tsx watch`), `typecheck`, `lint`.

### B6. `deploy/`
- Chép các tệp mẫu từ `roadmap-deploy-hetzner/references/` vào `deploy/`, kèm `deploy/README.md` ghi rõ "CHƯA DÙNG: dự án đang ở chế độ local-first". Không chạy, không lint.

### B7. Tài liệu
- `README.md`: yêu cầu máy, các lệnh (`npm install`, `cp .env.example .env.local` do tôi tự làm, `npm run db:start`, `npm run dev:web`, `npm run dev:worker`, `npm run check`), cách chạy test DB, ghi chú "local-only".
- Cập nhật trạng thái T-000 trong `docs/UpComming_Plan.md`.

### B8. Kiểm tra cuối (chạy thật và báo kết quả)
1. `npm install` thành công.
2. `npm run lint` và `npm run typecheck` không lỗi.
3. `npm run test:core`: 1381, 13, 23, 21 đều đạt.
4. `npm run dev:web` rồi `curl` `/api/health` (200, `{"ok":true}`) và các trang placeholder (200).
5. `npm run dev:worker` khởi động, in nhịp tim, tắt sạch.
6. (Nếu có Docker) seed và RLS như B3.
7. `git status` sạch sau khi commit.

## 4. Commit
Chia commit theo nhóm logic trên nhánh `feat/scaffold` (`chore:`/`feat:`/`test:`/`docs:`). Chỉ commit khi các kiểm tra ở B8 mục 1–3 đã đạt. Không push (nếu chưa có remote).

## 5. Báo cáo cuối
Theo đúng khung 1a của `CLAUDE.md`. Thêm một mục **"Chưa kiểm chứng"** liệt kê những gì bạn không thể chạy được trong lượt này (vd phần DB nếu thiếu Docker) và mọi chỗ bạn đã lệch khỏi bản mô tả này, kèm lý do.
````

## Sau khi Claude Code chạy xong, bạn tự kiểm tra nhanh

```bash
npm run check                  # lint + typecheck + test:core; phải thấy 1381/13/23/21
npm run dev:web                # mở http://localhost:3000, thu cửa sổ về ~360px để xem bố cục điện thoại
curl -s localhost:3000/api/health
git log --oneline              # các commit nhóm theo logic
```

Nếu `test:core` không ra đúng 1381/13/23/21, đừng chấp nhận bản scaffold: nghĩa là một test đã bị sửa hoặc xóa khi chép.

**Lưu ý:** Supabase CLI chạy local cần Docker. Việc thử thông báo trên iPhone cần HTTPS công khai nên **không** nằm trong scaffold này (xem T-013 trong `docs/UpComming_Plan.md`).
