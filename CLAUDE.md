# 🔒 CLAUDE CODE RULES (Roadmap Planner Session Rules)

> **Dự án:** web app (PWA) vạch lộ trình học/mục tiêu chi tiết: lịch tự tính theo ngày, theo dõi tiến độ, nhắc học, nhắc mua sách theo ngày cần có, tùy biến bằng Gemini. Template đầu tiên là lộ trình tự học JLPT N3 + Song ngữ IT của chính tác giả.
> **Tài liệu:** kế hoạch `docs/PLAN.md` · việc đang làm `docs/UpComming_Plan.md` · kiến thức nghiệp vụ nằm trong `.claude/skills/roadmap-*` (điểm vào: `roadmap-planner-router`). File này chỉ chứa luật cứng; chi tiết nghiệp vụ đọc ở skill.
> **CHẾ ĐỘ HIỆN TẠI: LOCAL-ONLY.** Chỉ phát triển và thử trên máy local. KHÔNG deploy, KHÔNG kết nối server Hetzner, KHÔNG chạy lệnh tác động dịch vụ đám mây (`supabase link`, `supabase db push`, `gcloud`, ssh tới server...) khi user chưa confirm rõ ràng. Skill `roadmap-deploy-hetzner` chỉ đọc khi user yêu cầu triển khai.

## 1. QUY TẮC CONFIRM & GIAO TIẾP
- **Bắt đầu task mới:** BẮT BUỘC confirm trước khi làm.
- **Thay đổi logic lớn (schema, API, auth, công thức lịch):** BẮT BUỘC confirm.
- **Cài dependency mới** ngoài danh sách ở mục 9: BẮT BUỘC confirm (nêu lý do, giấy phép nếu biết).
- **Lệnh có thể xóa dữ liệu** (`supabase db reset`, `rm -rf`, `DROP`): confirm, trừ khi là DB local dev và task đã yêu cầu rõ.
- **Commit & push:** theo mục 8a (đủ điều kiện thì không hỏi lại từng lần).
- **`.env*`:** TUYỆT ĐỐI KHÔNG tạo/sửa/đọc `.env`, `.env.local`... bằng BẤT KỲ cách nào, kể cả qua Bash (`cat`, `echo`, `tee`, `sed`, `cp`, heredoc, redirect `>`/`>>`, `git show`) và kể cả chỉ để tự test cục bộ, không commit. Chỉ được sửa `.env.example` (không chứa giá trị thật). Cần biến mới → thêm vào `.env.example` và báo user tự điền. Cần biến môi trường để tự chạy/test một lệnh → truyền thẳng trên dòng lệnh (`VAR=giá_trị lệnh...`), không ghi ra file; nếu không truyền được theo cách đó thì dừng lại và xin user tự tạo file.
- **Thay đổi nhỏ trong task đang làm:** không cần confirm.
- **Khi có lỗi:** KHÔNG xin lỗi, KHÔNG giải thích dài dòng → tạo systemic change (test, lint rule, ràng buộc) để không tái phát.
- **Workflow:** Plan → đợi user gõ OK/Approve → implement → lint + typecheck + test (xem 8a) → commit (xem 8a) → báo cáo cuối task (1a).
- **Ngôn ngữ:** trao đổi với user bằng tiếng Việt; identifier/tên file bằng tiếng Anh; chuỗi hiển thị cho người dùng và comment nghiệp vụ bằng tiếng Việt.

### 1a. BÁO CÁO CUỐI MỖI TASK (bắt buộc, kể cả khi không hỏi lại)
Tóm tắt ngắn theo đúng khung, không lặp lại chi tiết đã nói trong lúc làm:
1. **Đã xong** — xong cái gì, 1 câu.
2. **Thay đổi gì** — file/vùng nào bị đụng (path).
3. **Thay đổi như nào** — tóm tắt cách sửa, không paste lại code.
4. **Test ở đâu, test như nào** — màn hình/endpoint/lệnh cụ thể đã chạy.
5. **Expected là gì** — kết quả đúng phải trông như thế nào để user tự đối chiếu.
6. **Đã cập nhật plan như nào** — nếu có sửa `docs/UpComming_Plan.md`, nói rõ đã thêm/xoá/đổi mục nào.
7. **Lệch luật / chạm phạm vi nhạy cảm** — liệt kê MỌI lệnh Bash đã chạm file nhạy cảm (`.env*`, khóa, secret) hoặc cấu hình ngoài phạm vi task (vd git config, settings.json), và MỌI lần lệch luật trong CLAUDE.md, kể cả khi đã tự phát hiện và xử lý xong trong cùng lượt. Không có thì ghi "Không có".

## 2. NGUYÊN TẮC KHÔNG PHÁ VỠ
- Không ảnh hưởng chức năng đang hoạt động tốt.
- Không tự ý thay đổi kiến trúc, stack, naming convention.
- Khóa bí mật (Supabase service role, VAPID private, Gemini) không bao giờ xuất hiện trong mã nguồn, log, test fixture, commit, hay câu trả lời.
- Local-only: xem khung đầu file.

## 3. BẤT BIẾN NGHIỆP VỤ (chi tiết ở skill router; đây là phần không được vi phạm)
1. **Ngày Start/Due do `packages/core` tính.** Không lưu ngày suy ra vào DB (chỉ lưu `start_date`, `hours_per_day`, `days_per_week`, `status`, `pinned_start`); không để LLM sinh ngày; không cộng/trừ ngày bằng `Date` cục bộ; "hôm nay" lấy từ `todayInTimeZone(tz)` rồi truyền vào hàm thuần.
2. **Mọi bảng dữ liệu cá nhân có RLS + policy.** Bảng mới → cập nhật `rls_test.sql` và chạy lại. `service_role` chỉ ở server/worker, không bao giờ vào code có thể bundle xuống trình duyệt, không đặt trong `NEXT_PUBLIC_*`.
3. **LLM chỉ chọn trong danh mục**; mọi đầu ra qua `validateAdjustments` trước khi dùng; lỗi thì quay về template gốc.
4. **App không chứa nội dung học** (không bài giảng, ngân hàng đề, flashcard, chấm bài, cộng đồng).
5. **Chữ hiển thị phải trung thực:** giờ học là *ước tính*; giá là "giá tham khảo" kèm ngày; link affiliate ghi rõ; không hứa đậu hay mốc thời gian.
6. **Không phụ thuộc push:** màn Hôm nay / Sắp tới / Cần mua phải dùng được khi không có thông báo.
7. **`packages/core/src` là hàm thuần:** không import Next/React/Supabase/DOM/`fs`, không tự đọc đồng hồ.

## 4. QUY TẮC `packages/core`
- Đổi công thức → chạy `npm run test:core`. `tests/fixtures/golden-vectors.json` là đáp án lấy từ file Sheet gốc: **KHÔNG sửa tay cho khớp**. Muốn đổi quy tắc có chủ đích → confirm rồi tạo lại golden từ nguồn.
- **Test fail:** xác định bên nào sai (code hay đáp án tính tay) TRƯỚC khi sửa. Cấm sửa kỳ vọng cho xanh mà không nêu lý do.
- Số thực: `round(x, 6)` trước `floor/ceil` (chống 7.0000000001 thành 8).
- Số phép kiểm tra hiện có (lịch 1381, mua sách 13, nhắc việc 23, kiểm tra AI 21) chỉ được giữ nguyên hoặc tăng. Giảm nghĩa là có test bị xóa → báo user.

## 5. QUY TẮC FE (Next.js) & LINT
- Sau mỗi thay đổi: `npm run lint` + `npm run typecheck` (toàn workspace). Cấm: `no-explicit-any`, `no-unused-vars`, thiếu import. Biến không dùng mà phải giữ → đặt tên bắt đầu `_`; `catch {}` không cần tham số khi không dùng lỗi.
- `npm run build` (apps/web) chỉ bắt buộc khi đổi `next.config`, PWA/service worker, hoặc trước khi user báo chuẩn bị deploy.
- **Tương thích đa thiết bị — LUÔN cân nhắc TRƯỚC khi code**, không đợi báo lỗi: app là PWA dùng chủ yếu trên điện thoại. Tự hỏi "còn chạy đúng trên Safari iOS (PWA đã cài), Android Chrome, màn 360px không?". Cụ thể: feature-detect `PushManager`/`Notification`/`serviceWorker` và có fallback graceful; xin quyền thông báo chỉ từ cú bấm của người dùng; phát hiện chế độ đã cài bằng `display-mode: standalone`/`navigator.standalone`; chừa `env(safe-area-inset-*)`; không dựa vào hover; mọi màn dùng được ở 360px.
- **Truy cập dữ liệu** chỉ qua `lib/supabase/client.ts` (trình duyệt) và `lib/supabase/server.ts` (server). CẤM tạo client Supabase ad-hoc. Route handler luôn lấy user từ session, không tin `user_id` trong body.
- **Lỗi:** chuẩn hóa qua `lib/errors.ts` (`AppError`, `toUserMessage`); hiện lý do thật khi an toàn, cấm nuốt lỗi âm thầm.
- **Màu/border:** dùng design token trong `globals.css`/Tailwind theme (`border-line`, `text-ink`, `bg-surface`...), CẤM literal color trừ khi cố ý. **Icon:** `lucide-react` outline, không emoji; nhãn nút ngắn, mô tả đầy đủ đặt ở `title`.
- **Chuỗi hiển thị** tập trung ở `lib/copy.ts` (dễ rà câu chữ trung thực, nhãn affiliate).
- **Nội dung do LLM/người dùng sinh:** không `dangerouslySetInnerHTML`; Markdown phải qua sanitizer.
- Component dùng API trình duyệt phải `'use client'` và guard `typeof window`.

## 6. QUY TẮC DATABASE / SUPABASE
- Đổi schema → migration MỚI trong `supabase/migrations/` (không sửa migration đã áp dụng) + confirm trước.
- Bảng mới: bật RLS + policy + cập nhật `rls_test.sql`. Ngày học dùng `DATE`, không `timestamptz`.
- Đổi response shape/route API → cập nhật type dùng chung cùng lúc.
- Seed template sinh từ `data/n3-template.json`; số liệu đối chiếu: 4 phase, 113 task, 10 tài nguyên, 99 task gốc = 425 giờ, tổng 566 giờ.
- Không chạy lệnh nhắm vào Supabase cloud.

## 7. QUY TẮC WORKER / PUSH / AI
- **Worker:** gửi qua outbox `reminders`, idempotent theo `dedupe_key`, `FOR UPDATE SKIP LOCKED`, xử lý 404/410 (vô hiệu hóa đăng ký), đặt TTL. Nội dung thông báo tối thiểu (tên task/sách + link sâu).
- **AI:** chỉ gọi từ server; khóa và tên model từ env; hạn mức theo người dùng; đầu vào sanitize + bọc thẻ; đầu ra validate.
- **Trước khi báo một tính năng "đã nối dây đầy đủ"** (auth thật + DB thật + RLS thật) → PHẢI đọc tới tận đáy hàm xử lý dữ liệu, không dừng ở "route có thật, được gọi thật". Cấm số liệu hardcode giả làm dữ liệu thật.

## 8. QUY TẮC GIT
- Nhánh: `main` (không push thẳng), `develop`, nhánh làm việc `feat/<tên-ngắn>`.
- Commit format: `feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`.
### 8a. ĐƯỢC PHÉP TỰ COMMIT (và push nếu đã có remote) vào nhánh `feat/*` khi ĐỦ CẢ 2 điều kiện
1. Việc đang làm đã xong (không dở dang).
2. Đã kiểm tra đúng cấp độ: `npm run lint` + `npm run typecheck` + `npm run test:core`; nếu đụng DB/RLS thì thêm kiểm tra seed + RLS; nếu task có yêu cầu test cụ thể thì chạy đúng test đó và phải pass.
- Push thẳng `main`/`develop` luôn phải confirm. Có nghi ngờ/bug lạ giữa chừng → sửa xong, verify lại rồi mới commit, không commit code còn nghi vấn.

## 9. STACK KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI
- **FE:** Next.js (App Router), React, TypeScript strict, TailwindCSS, lucide-react
- **State/dữ liệu server:** TanStack Query (không thêm Redux/Zustand)
- **Monorepo:** npm workspaces (không thêm pnpm/turbo/nx)
- **DB/Auth:** Supabase (Postgres + Auth + RLS); local qua Supabase CLI + Docker
- **Worker:** Node + TypeScript + `web-push`
- **AI:** Gemini, chỉ gọi từ server
- **Test core:** tsx runners (giữ nguyên). Thêm Vitest/Playwright cần confirm.
- **Dependency được dùng ngay:** next, react, react-dom, typescript, tailwindcss, postcss, autoprefixer, @tailwindcss/postcss, @supabase/supabase-js, @supabase/ssr, @tanstack/react-query, lucide-react, zod, web-push, supabase (CLI), tsx, eslint, @eslint/js, typescript-eslint, eslint-config-next, @types/*. Còn lại: confirm. Dùng bản ổn định mới nhất lúc cài, không tự nâng major về sau.

## 10. LỖI PHỔ BIẾN CẦN NHỚ
- ESLint: biến không dùng đặt tên `_x`; `catch {}`.
- Lịch: dùng số ngày UTC, không `Date` cục bộ; làm tròn `r6` trước `floor/ceil`.
- Đáp án tính tay trong test cũng có thể sai: kiểm tra đáp án trước khi sửa code.
- `NEXT_PUBLIC_*` bị đóng gói gửi cho trình duyệt: không đặt bí mật ở đó.
- Service worker: không cache API; sửa `sw.js` thì kiểm tra bản mới có kích hoạt.
- RLS: dùng `(select auth.uid())`; kiểm thử bằng hai người dùng.
- iOS: push chỉ hoạt động trong PWA đã cài, từ iOS 16.4; dữ liệu trong tab Safari và trong app đã cài là hai nơi riêng.
- Môi trường máy dev hiện tại: Next.js 16, Tailwind v4 (token khai báo bằng `@theme` trong CSS, không dùng `tailwind.config.js` kiểu v3); đặt `agentRules: false` trong `next.config.ts` (Next 16 mặc định tự sinh `AGENTS.md`/`CLAUDE.md` mỗi lần `next dev`, phải tắt); cổng 3000 hay bị công cụ khác trên máy chiếm nên web cố định chạy ở cổng 3100; npm workspaces có thể tạo `node_modules` lồng ngay trong `apps/*`/`packages/*` khi version một gói lệch giữa các package — đó là hành vi bình thường của npm, không phải lỗi.
- Next.js 16 đổi tên file convention `middleware.ts` → `proxy.ts` (hàm export đổi tên `middleware` → `proxy`); đọc `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` nếu nghi ngờ quy ước đã đổi tiếp ở bản sau.
- `supabase/config.toml` đang để `[auth.email] enable_confirmations = false` (đăng ký xong đăng nhập được ngay, không cần xác nhận email) — chỉ đúng cho **local-only**. **BẮT BUỘC bật lại `enable_confirmations = true`** (và cấu hình SMTP thật) trước khi deploy production, nếu không ai cũng tạo được tài khoản bằng email không có thật.

## 11. CHECKLIST ĐẦU PHIÊN
- Đọc kỹ file RULES này.
- Đọc `docs/UpComming_Plan.md`.
- Nếu đụng nghiệp vụ: đọc `roadmap-planner-router` rồi skill con tương ứng.
- Hỏi user task tiếp theo → propose plan → confirm → implement.

## 12. PHÁT HIỆN LỖI CÙNG LOẠI VỚI LỖI USER BÁO — SỬA LUÔN, KHÔNG CHỈ BÁO
- Khi đang sửa một lỗi user chỉ ra, nếu `grep`/rà soát thấy chỗ khác có **đúng cùng pattern lỗi** (vd cùng kiểu cộng ngày bằng `Date` cục bộ, cùng thiếu feature-detect cho một Web API, cùng thiếu RLS) → sửa liên thông tất cả trong cùng lượt.
- Chỉ áp dụng cho lỗi cùng loại/cùng nguyên nhân gốc; lỗi không liên quan phát hiện trong lúc làm thì báo riêng, không tự sửa.
