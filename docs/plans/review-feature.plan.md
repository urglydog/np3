# Plan — Module "Ôn luyện" (Kanji 512)

> Trạng thái: **FINAL v1 — đã duyệt 2026-10-16**. CLAUDE.md bất biến #4 đã được sửa theo diff ở §9 (áp dụng cùng ngày). Vẫn **chưa viết code ứng dụng, chưa chạy migration, chưa seed** — đây vẫn chỉ là plan.
> Phạm vi đợt 1 (đã chốt, xem §2): **chỉ 192 kanji bài 1–12** (16×12) + 1.399 dòng ví dụ VNJP. Sách có tổng 32 bài/512 kanji nhưng bài 13–32 **không nạp** ở đợt này — nạp sau bằng cách thêm file + chạy lại script seed (idempotent).

---

## 0. Tóm tắt khảo sát code (mọi dòng kèm đường dẫn đã đọc)

### 0.1 Quy ước monorepo
- `apps/web` (Next.js 16 App Router, route group `(app)` được bảo vệ bởi `apps/web/src/proxy.ts` qua `updateSession`; nhóm `(auth)`, `(onboarding)` riêng).
- `(app)/layout.tsx` redirect `/login` nếu chưa đăng nhập, redirect `/create-plan` nếu chưa có `plans` row; điều hướng chính nằm ở `apps/web/src/components/bottom-nav.tsx` (5 mục cứng: Hôm nay/Sắp tới/Lộ trình/Cần mua/Cài đặt) — **sẽ cần sửa file này để thêm mục "Ôn luyện"**, ghi vào milestone M5.
- Mỗi route theo mẫu `page.tsx` (Server Component, đọc dữ liệu) + `actions.ts` (Server Action, ghi dữ liệu qua Supabase client) + hook logic thuần ở `apps/web/src/lib/*.ts` (ví dụ `apps/web/src/lib/task-detail.ts`, `apps/web/src/lib/roadmap.ts`) + component `'use client'` riêng khi cần tương tác (`apps/web/src/components/*`).
- Truy cập Supabase: **chỉ** qua `apps/web/src/lib/supabase/client.ts` (browser, anon key) và `apps/web/src/lib/supabase/server.ts` (server, đọc session cookie, `getCurrentUser()` cached bằng `cache()` của React). Không tạo client ad-hoc — module review phải theo đúng 2 file này.
- Lỗi chuẩn hoá qua `apps/web/src/lib/errors.ts` (`AppError`, `toUserMessage`).
- Chuỗi hiển thị gom ở `apps/web/src/lib/copy.ts` (hiện có comment nhóm, sẽ thêm nhóm `// Ôn luyện`).
- Token màu: `apps/web/src/app/globals.css` khai báo bằng `@theme inline` (Tailwind v4) — `--color-ink`, `--color-ink-muted`, `--color-surface`, `--color-surface-raised`, `--color-line`, `--color-brand`, `--color-accent`, `--color-danger`, `--color-success`, `--color-warning`. Không có token riêng cho "mastery levels" — cần thêm cách map 5 mức (New/Bad/Cần xác nhận/Good/Mastered) lên token màu có sẵn, không bịa màu literal.
- `apps/web/public/` chỉ có `favicon.ico`, `icons/`, `manifest.webmanifest`, `sw.js` — chưa có thư mục asset lớn nào. `sw.js` (`apps/web/public/sw.js`) hiện **chỉ xử lý push + notificationclick, không cache gì** ("KHÔNG cache API" — comment đầu file).
- Dependency FE hiện có (từ `apps/web/package.json`): `embla-carousel-react` (đã dùng ở `today-carousel.tsx`, có thể tái dùng cho carousel duyệt kanji), `zod` (dùng ở `lib/backup.ts` kiểu Result pattern), `lucide-react`, không có canvas/signature-pad nào — **K2 sẽ dùng Canvas 2D API thuần của browser, không thêm dependency mới** (tránh phải confirm theo mục 9 CLAUDE.md).

### 0.2 `packages/core`
- `packages/core/src/adjustments.ts` là mẫu convention chuẩn: comment đầu file tiếng Việt giải thích nguyên tắc, `export interface` rõ kiểu, `Result`/`Validation` pattern (`{ ok: true; value } | { ok: false; errors }`), hằng số ngưỡng đặt tên ở đầu file (`DEFAULT_LIMITS`).
- Test convention: `packages/core/tests/*.test.mts`, chạy bằng `tsx`, không dùng framework test (không Jest/Vitest) — tự đếm `checks`/`fails`, in `FAIL ...` khi lệch, không `process.exit` nếu không fail (xem `packages/core/tests/progress.test.mts`). Đăng ký thủ công từng file vào script `test` của `packages/core/package.json` (chuỗi `&&` nối tiếp) — **module review phải nối thêm vào chuỗi này**, không tạo runner mới.
- `packages/core/src/index.ts` export tập trung — cần thêm export cho module review mới.
- Không có sẵn hàm chuẩn hoá tiếng Việt/NFKC nào trong `packages/core` — đây là phần mới hoàn toàn.

### 0.3 Supabase / RLS
- `supabase/migrations/20261001030245_init.sql` — mẫu 2 nhóm bảng: **danh mục chung** (`templates`, `template_phases`, `template_resources`, `template_tasks`, `template_task_resources`) RLS `select to authenticated using (is_published)`, ghi bằng service role; và **dữ liệu cá nhân** (`plans`, `plan_task_state`, `plan_resource_state`, `push_subscriptions`, `reminders`, `ai_usage`) RLS owner-only qua `(select auth.uid())` hoặc qua join tới bảng cha. Mọi cột ngày học là `DATE`, không `timestamptz`.
- `supabase/migrations/20261005040000_plan_settings.sql` cho thấy mẫu sửa schema: `alter table` + `create or replace function ... language plpgsql security invoker` trong cùng 1 migration khi RPC cần đổi theo cột mới.
- RPC hiện tại (`create_plan`, `update_plan_progress`, `import_user_plan`) đều `security invoker`, không thấy RPC nào `security definer` — **cần quyết định rõ cho RPC chấm điểm review** (xem §4 RPC).
- `scripts/rls_test.sql` — mẫu test RLS bằng `DO $$ ... $$`, 3 user giả A/B/C tạo qua `insert into auth.users`, chuyển vai bằng `pg_temp.as_user(u)` set `request.jwt.claim.sub`, `set role authenticated`, kiểm bằng `raise exception` nếu sai, in `RLS OK` cuối cùng. Phải nối thêm khối cho 7 bảng mới vào **chính file này** (không tạo file test RLS riêng).
- `npm run check:full` = `npm run check && npm run test:integration`; `test:integration` là chuỗi tsx script nối tiếp bằng `&&` trong `package.json` gốc — **phải thêm script tích hợp review vào chuỗi này** nếu milestone đụng Supabase local thật, theo đúng CLAUDE.md mục 8a.
- `scripts/gen-seed.ts` là mẫu sinh SQL từ JSON nguồn (`data/n3-template.json`) — convention cho script nạp dữ liệu review 512 kanji: đọc CSV/JSON nguồn, sinh SQL hoặc gọi Supabase JS trực tiếp bằng service role, idempotent.

### 0.4 Dữ liệu `kanji512_review_pack/`
- `kanji_512.csv` (512 dòng + header, đã đếm bằng `wc -l`): cột `lesson, order_in_lesson, kanji, unicode_hex, is_kanji, han_viet_main, han_viet_accepted, han_viet_other, meaning_en, note, onyomi, kunyomi, stroke_count, grade, jlpt_old, freq, needs_review, review_note, svg_file`. Đây là nguồn chuẩn cho **thứ tự deck gốc, mã Unicode, SVG, nghĩa tiếng Anh, Hán Việt đầy đủ 512 chữ**.
  - Đếm bằng script tách CSV đúng (không dùng `awk -F','` thô vì vài cột có dấu phẩy trong giá trị): **22 dòng có `han_viet_accepted` khác rỗng** (khớp số 22 nêu trong brief cũ `DATA_CHANGES.md`). Đếm `needs_review=true` bằng `awk` thô ra một số không khớp các nguồn khác do cột `review_note` phía sau có thể chứa dấu phẩy — **plan không chốt số needs_review chính xác bằng shell, script nạp (M1b) phải tự đếm bằng CSV parser đúng và log ra, không suy đoán**.
  - `kunyomi` rỗng ở 49 dòng (đếm thô, có thể lệch do cùng lý do trên — script nạp phải tự xác nhận), `onyomi` rỗng ở ít nhất 8 dòng (gồm `々`, `込`).
- `kanji512_review_pack/resources_512_vnjp/vnjp_kanji.csv` (192 dòng + header, BOM UTF-8 ở đầu file — `head` cho thấy `﻿lesson,...`, **script nạp phải strip BOM**): cột `lesson, order_in_lesson_vnjp, order_in_lesson_deck, kanji, han_viet_vnjp, han_viet_main_deck, hv_match, meaning_vi_vnjp, onyomi_vnjp, kunyomi_vnjp, onyomi_deck, kunyomi_deck, example_count, source_image, kanji_note`. Đây là nguồn **nghĩa tiếng Việt + thứ tự bài theo VNJP** cho 192/512 chữ (bài 1–12).
- `kanji512_review_pack/resources_512_vnjp/vnjp_examples.csv` (1.399 dòng + header, cũng có BOM): cột `lesson, kanji_parent, order, term, reading_kana, meaning_vi, needs_review, note`. Ví dụ dùng chữ Hán trong `term` (không phải chỉ kana), `kanji_parent` là 1 ký tự kanji — một từ ghép (vd 春夏秋冬) sẽ xuất hiện nhiều dòng, mỗi dòng gắn với 1 `kanji_parent` khác nhau nhưng cùng `term`+`reading_kana`+`meaning_vi` — **xác nhận đúng như brief mô tả, cần dedupe khi nạp (xem §3.3)**.
- `kanji512_review_pack/ATTRIBUTION.md`, `DATA_CHANGES.md`, `PREVIOUS_PLAN_DRAFT.md`, `REVIEW_FEATURE_BRIEF.md` — tài liệu của lượt khảo sát trước. **Mâu thuẫn với prompt hiện tại được ghi ở §1 dưới**.
- `kanji512_review_pack/resources_512_vnjp/bai_N/16_panel/` — ảnh minh hoạ ghi nhớ của sách, **tuyệt đối không đọc nội dung, không nạp, không copy vào repo app** (giữ nguyên trong `kanji512_review_pack/`, không di chuyển).
- `kanji512_review_pack/svg/` — 512 file SVG KanjiVG đã tô màu theo nét, tổng 3.3 MB, tên theo mã Unicode hex 5 ký tự (`04e00.svg`...), giữ header bản quyền CC BY-SA 3.0 ở đầu file — **không chạy SVGO/minify xoá comment**.

### 0.5 Dữ liệu còn thiếu trong gói hiện tại
- `kanji512_review_pack/` **không có** file `kanji_512.apkg`/Anki gốc (đã xử lý thành CSV), nên nguồn chuẩn cho mục 3 của master prompt ("dataset gốc 512 chữ... xác định vị trí thật của file này trong repo") **chính là `kanji512_review_pack/kanji_512.csv` + `.json`** — không có file riêng tên `kanji_512.csv` nào khác trong repo (đã `find` toàn repo, chỉ có 1 bản).
- Bài 13–32 (320 kanji còn lại) **chưa có dữ liệu VNJP enrich** (nghĩa tiếng Việt + ví dụ) — chỉ có trong `kanji_512.csv` (nghĩa tiếng Anh, Hán Việt). Thiết kế nạp phải tăng dần theo đúng yêu cầu.

---

## 1. Mâu thuẫn & điểm cần làm rõ

1. **CLAUDE.md bất biến #4 (mục 3, dòng "App không chứa nội dung học... không flashcard...") cấm thẳng tính năng này.** Đây là xung đột trực tiếp, không thể lách bằng diễn giải — phải sửa luật trước khi code, và việc sửa luật **chỉ được đề xuất, không áp dụng** ở lượt này (§9).
2. **`PREVIOUS_PLAN_DRAFT.md`/`REVIEW_FEATURE_BRIEF.md` (bản nháp cũ) chốt "không chấm điểm nét vẽ, không canvas"** — chiều viết là lật thẻ tự đánh giá thuần. **Prompt hiện tại (master prompt trong hội thoại này) yêu cầu ngược lại**: K2 có canvas viết tay thật, "chấm khoan dung" + nút ✓/✗ tự xác nhận, tuỳ chọn so số nét. Plan này **theo prompt hiện tại** (mới hơn, chi tiết hơn, có 4 loại câu hỏi K1/E1/K2/E2 mà bản cũ không có) — bản cũ bị coi là lỗi thời trên điểm này, nêu rõ để không ai hiểu nhầm là đã chốt "không canvas".
3. **Bản cũ không có khái niệm 4 loại câu hỏi K1/E1/K2/E2, không có dữ liệu ví dụ (`vnjp_examples.csv`), không có yêu cầu so khớp Hán Việt khoan dung tông giọng.** Đây là toàn bộ phần mới so với bản cũ — không có convention cũ để đối chiếu, mọi thiết kế ở §4–§6 là mới.
4. **Bản cũ đề xuất route `apps/web/src/app/(app)/review/`** — plan này giữ nguyên vị trí này vì khớp convention `(app)` hiện tại (đã xác nhận ở §0.1).
5. **Không có khái niệm "danh sách do người dùng tự chọn" nào bắt buộc trong prompt hiện tại** (khác bản cũ, nơi đây là điều kiện (b) của ngoại lệ CLAUDE.md). Prompt hiện tại cho phép quiz dựng sẵn theo bài (16 kanji + ví dụ của bài) **ngay cả khi người dùng chưa tự tạo list nào** — đây làm điều kiện (b) đề xuất ở bản cũ ("danh sách do người dùng tự chọn") không còn đúng 100%, vì "theo bài" vẫn là một danh mục có sẵn do app định nghĩa (dù chỉ là đơn vị tổ chức, không phải "bài giảng"). Plan viết lại điều kiện (b) cho khớp thực tế ở §9.

---

## 2. Quyết định đã chốt (user, 2026-10-16) & giả định còn lại

### 2.1 Quyết định đã chốt — không còn là câu hỏi mở

1. **So khớp Hán Việt: BẮT BUỘC đúng dấu thanh.** Chỉ coi khớp khi 2 chuỗi cùng âm và cùng thanh, khác nhau duy nhất ở **vị trí đặt dấu** trong các vần có nhiều cách gõ hợp lệ (vd `hoà`≡`hòa`, `uý`≡`úy`). `Hỏa`≠`Hóa` (khác thanh hỏi/sắc) **không khớp**. **Không chấp nhận gõ không dấu** (`hoa`, `nhat`... luôn bị coi là sai, không phải "khoan dung" tới mức bỏ dấu). Áp dụng cho K1 và phần so khớp từng âm tiết của E1.
2. **Phạm vi dữ liệu đợt 1: chỉ bài 1–12 (192 kanji, 1.399 ví dụ).** Không nạp bất kỳ phần nào của bài 13–32 (320 kanji còn lại) ở đợt này, **kể cả Hán Việt/nghĩa tiếng Anh đã có sẵn trong `kanji_512.csv`** — để tránh có kanji "nạp nửa" (có K1/K2 nhưng không có E1/E2) gây khó hiểu khi dùng thật. Bài 13–32 nạp sau bằng cách: (a) thêm dữ liệu VNJP tương ứng (giống cấu trúc `vnjp_kanji.csv`/`vnjp_examples.csv` hiện có), (b) chạy lại script seed — idempotent, chỉ thêm dòng mới, không đụng dữ liệu cá nhân (`review_card_state`, `review_list`...) của bài đã nạp trước. **Ràng buộc bắt buộc cho UI/schema:** 32 là tổng số bài cố định của sách (không phụ thuộc dữ liệu đã nạp) — Home phải phân biệt rõ "bài chưa nạp dữ liệu" (hiện mờ/khoá, nhãn "Chưa có dữ liệu") với "bài đã nạp nhưng 0% mastered" (hiện bình thường, vòng % = 0) — không được coi bài chưa nạp là lỗi/rỗng.
3. **Diff sửa CLAUDE.md bất biến #4 ở §9: đã duyệt và đã áp dụng** (xem `CLAUDE.md` mục 3, dòng 4 — sửa cùng ngày, commit riêng). Không còn là đề xuất.
4. **Trang "Nguồn dữ liệu và giấy phép": không vào nav chính.** Đặt dưới dạng **một dòng liên kết nhỏ ở cuối trang Home Ôn luyện** (`review/page.tsx`, footer nhỏ, không phải nút lớn) trỏ tới `review/licenses/page.tsx`. `bottom-nav.tsx` chỉ thêm đúng 1 mục "Ôn luyện" (xem M5), không thêm mục "Giấy phép".
5. **`han_viet_other` (biến thể Nôm/quốc ngữ): giữ cột trong dữ liệu, KHÔNG hiển thị ở UI (không có chế độ bật/tắt), KHÔNG dùng để chấm K1/E1 dưới bất kỳ hình thức nào.** Chỉ dùng nội bộ cho mục đích tham khảo/đối chiếu dữ liệu khi cần (vd script nạp log cảnh báo nếu `han_viet_main` khác xa mọi giá trị trong `han_viet_other`). `han_viet_accepted` (22 biến thể đã chốt, khác `han_viet_other`) vẫn **được dùng để chấm** như §3.1/§3.3 — hai cột có vai trò khác nhau, không nhầm lẫn.

### 2.2 Giả định còn lại (plan tự chọn, đảo được, không cần duyệt lại)

- `[GIẢ ĐỊNH]` Vị trí dữ liệu nguồn: copy (không di chuyển `kanji512_review_pack/`) các file cần cho app vào `data/review/kanji-look-and-learn-512/` (`vnjp_kanji.csv`, `vnjp_examples.csv`, phần lọc `lesson<=12` của `kanji_512.csv`) theo đúng convention `data/n3-template.json` hiện có; SVG vào `apps/web/public/kanjivg/<hex>.svg` (static, Next serve trực tiếp, giống `public/icons/`) — **chỉ copy 192 file SVG của bài 1–12 ở đợt này**, không copy cả 512 file (đúng quyết định 2.1.2). `kanji512_review_pack/` gốc giữ lại làm hồ sơ nguồn/ghi công, không xoá.
- `[GIẢ ĐỊNH]` Đặt tên bảng tiền tố `review_` để tránh đụng tên bảng hiện có và dễ `grep`.
- `[GIẢ ĐỊNH]` Ngưỡng mastery giữ đúng số trong master prompt (Mastered streak≥3, Good=2, Cần xác nhận=1, Bad=0-và-đã-từng-sai, New=chưa làm) — coi là đã chốt vì master prompt ghi rõ, không phải đề xuất của plan.
- `[GIẢ ĐỊNH]` `review_entry` không tồn tại cho `々` (bài 28, vị trí 15, `is_kanji=false`) — **nằm trong bài 13–32 theo deck gốc (bài 28), nên theo quyết định 2.1.2, `々` KHÔNG nạp ở đợt này**, để lại xử lý cùng lúc bổ sung bài 13–32 sau. Ghi chú này giữ nguyên thiết kế cột `is_kanji` trong schema để sẵn sàng cho lúc đó.
- `[GIẢ ĐỊNH]` `needs_review=true` (cả ở `review_kanji` và `review_example`, trong phạm vi 192 kanji/1.399 ví dụ của đợt này): vẫn nạp đầy đủ, gắn cờ `needs_review`, **loại khỏi candidate pool của quiz cho tới khi được xác nhận** (cột `confirmed_at` null = chưa xác nhận); không xây màn hình admin riêng trong đợt này — thay bằng dòng liên kết "Nguồn dữ liệu và giấy phép" ở Home (quyết định 2.1.4) hiển thị thêm số liệu "N chữ/ví dụ đang chờ xác nhận Hán Việt" dạng text tĩnh, và script nạp in danh sách ra console log khi chạy. Việc xác nhận thật (đổi `confirmed_at`) để **ngoài phạm vi đợt này** — xem §11, và là 1 trong các việc người dùng còn nợ (xem HANDOFF).
- `[GIẢ ĐỊNH]` K2 không dùng nhận diện nét vẽ bằng máy (không OCR/ML) — "chấm khoan dung" nghĩa là: ẩn đáp án → người dùng vẽ trên canvas từ trí nhớ (không chấm) → bấm "Xem đáp án" (RPC `review_reveal_answer`, không sửa `review_card_state`) → hiện kanji thật + SVG thứ tự nét + tuỳ chọn so sánh "số nét bạn vẽ" (đếm số nét chấm trên canvas, thuần client) với `stroke_count` (chỉ hiển thị cảnh báo lệch, không chặn) → người dùng tự bấm ✓/✗ (RPC `review_submit_answer` với `self_assessed=true`). Server không bao giờ nhận ảnh canvas.
- `[GIẢ ĐỊNH]` `maxQuestions` (trần số câu) = Σ theo từng mục đã chọn của (số loại câu áp dụng cho mục đó): kanji đóng góp tối đa 2 (K1+K2, trừ khi bị loại vì `needs_review`), example đóng góp tối đa 2 (E1+E2, trừ khi `needs_review`). Thanh trượt cho chọn số câu từ 1 đến trần này.
- `[GIẢ ĐỊNH]` Một RPC `review_submit_answer` dùng chung cho cả 4 loại câu hỏi (phân nhánh theo `question_type` trong hàm), **không** tách 4 RPC riêng — giữ số lượng hàm `public.*` gọn, dễ audit RLS/kiểm tra chữ ký theo mẫu `rls_test.sql` hiện có (đếm "đúng 1 hàm tên X").
- `[GIẢ ĐỊNH]` `review_attempt_log.raw_answer_text` lưu nguyên văn người dùng gõ (không phải ảnh canvas) để làm dữ liệu cho biểu đồ/debug sau — không chứa gì nhạy cảm hơn nội dung học tiếng Nhật, không cần ẩn.

Không còn câu hỏi mở nào chặn M0→M1a. Việc còn nợ dữ liệu (ảnh bị cắt, 21 ví dụ needs_review, bài 13–32) được liệt kê trong `docs/plans/review-feature.HANDOFF.md`, không chặn code.

---

## 3. Mô hình dữ liệu

### 3.1 Bảng chung (đọc-only với người dùng, ghi bằng script nạp dùng service role)

```sql
-- supabase/migrations/<ts>_review_schema.sql (migration MỚI, không sửa migration cũ)

create table review_kanji (
  id uuid primary key default gen_random_uuid(),
  unicode_hex text not null unique,              -- '04e00' — khớp tên file SVG, nguồn: kanji_512.csv
  kanji text not null unique,
  is_kanji boolean not null default true,        -- false chỉ cho 々
  deck_lesson int not null,                       -- 1..32, từ kanji_512.csv.lesson (thứ tự deck gốc).
                                                   -- Đợt 1 CHỈ seed deck_lesson<=12 (quyết định 2.1.2) —
                                                   -- cột vẫn nhận 1..32 để sẵn sàng cho lúc nạp bài 13-32.
  deck_order int not null,                        -- 1..16, kanji_512.csv.order_in_lesson
  vnjp_lesson int,                                -- null nếu ngoài bài 1-12 (chưa có dữ liệu VNJP) — cột giữ nullable cho bài 13-32
                                                   -- dù đợt 1 luôn có giá trị (chỉ seed kanji đã khớp VNJP)
  vnjp_order int,                                 -- thứ tự hiển thị trong bài theo VNJP (order_in_lesson_vnjp)
  han_viet_main text,                             -- rỗng hợp lệ cho 込/々 (thuộc bài 13-32, KHÔNG seed đợt 1 — xem quyết định 2.1.2);
                                                   -- cột giữ nullable để không phải đổi schema khi nạp bài 13-32 sau
  han_viet_accepted text[] not null default '{}', -- biến thể được CHẤP NHẬN khi chấm (22 chữ lệch VNJP/deck trong toàn bộ 512; chỉ phần nằm trong bài 1-12 được seed đợt này)
  han_viet_other text[] not null default '{}',    -- CHỈ lưu tham khảo nội bộ — quyết định 2.1.5: KHÔNG hiển thị UI, KHÔNG dùng để chấm, không có cờ bật/tắt
  meaning_en text,
  meaning_vi text,                                -- null nếu ngoài bài 1-12; đợt 1 luôn có giá trị vì chỉ seed kanji đã khớp VNJP
  onyomi text[] not null default '{}',
  kunyomi text[] not null default '{}',
  stroke_count int,
  note text,                                      -- ghi chú bộ thủ
  svg_path text not null,                         -- '/kanjivg/04e00.svg'
  needs_review boolean not null default false,
  review_note text,
  confirmed_at timestamptz,                       -- null = đang chờ xác nhận Hán Việt, loại khỏi quiz
  source text not null default 'kanji-look-and-learn-512',
  created_at timestamptz not null default now(),
  check (deck_lesson between 1 and 32),
  check (deck_order between 1 and 16)
);
create unique index review_kanji_deck_pos_idx on review_kanji(deck_lesson, deck_order);

create table review_example (
  id uuid primary key default gen_random_uuid(),
  term text not null,                             -- dạng kanji, vd '一つ'
  reading_kana text not null,
  meaning_vi text,
  needs_review boolean not null default false,
  note text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (term, reading_kana)                      -- định danh ổn định theo mục 3 quy tắc nạp của prompt
);

-- Một ví dụ có thể thuộc nhiều kanji cha (春夏秋冬, 森林...) — N-N, tránh đếm trùng khi gộp phạm vi
create table review_example_kanji (
  example_id uuid not null references review_example(id) on delete cascade,
  kanji_id uuid not null references review_kanji(id) on delete cascade,
  lesson_context int not null,                    -- bài VNJP nơi cặp này xuất hiện (vnjp_examples.csv.lesson)
  primary key (example_id, kanji_id)
);

create table review_import_batch (                -- nhật ký mỗi lần chạy script nạp, phục vụ audit phạm vi đã seed (quyết định 2.1.2)
  id uuid primary key default gen_random_uuid(),
  source text not null,
  imported_at timestamptz not null default now(),
  kanji_count int not null,
  example_count int not null,
  needs_review_kanji_count int not null,
  needs_review_example_count int not null,
  notes text
);
```

### 3.2 Bảng cá nhân (RLS owner-only)

```sql
create table review_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table review_list_item (
  list_id uuid not null references review_list(id) on delete cascade,
  item_type text not null check (item_type in ('kanji','example')),
  item_id uuid not null,                          -- không FK trực tiếp (polymorphic) — ràng buộc bằng trigger (xem dưới)
  added_at timestamptz not null default now(),
  primary key (list_id, item_type, item_id)
);

create table review_card_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('kanji','example')),
  item_id uuid not null,
  question_type text not null check (question_type in ('K1','E1','K2','E2')),
  correct_count int not null default 0 check (correct_count >= 0),
  wrong_count int not null default 0 check (wrong_count >= 0),
  streak int not null default 0 check (streak >= 0),
  mastery_level text not null default 'new' check (mastery_level in ('new','bad','to_confirm','good','mastered')),
  last_reviewed_at timestamptz,
  primary key (user_id, item_type, item_id, question_type),
  check ((item_type = 'kanji' and question_type in ('K1','K2')) or (item_type = 'example' and question_type in ('E1','E2')))
);

create table review_attempt_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('kanji','example')),
  item_id uuid not null,
  question_type text not null check (question_type in ('K1','E1','K2','E2')),
  is_correct boolean not null,
  self_assessed boolean not null default false,   -- true chỉ cho K2
  raw_answer_text text,                            -- null cho K2 (không có text, chỉ self-assess)
  client_attempt_id uuid not null unique,          -- idempotency: resend không ghi trùng
  answered_at timestamptz not null default now()
);
create index review_attempt_log_user_item_idx on review_attempt_log(user_id, item_type, item_id, question_type);
```

**Ràng buộc polymorphic (`item_id` không FK trực tiếp vì có 2 bảng khả năng):** dùng **trigger** `check_review_item_exists()` (constraint trigger, `before insert or update`) trên `review_list_item`, `review_card_state`, `review_attempt_log` — kiểm `exists (select 1 from review_kanji where id = item_id)` khi `item_type='kanji'`, tương tự cho `'example'`; raise exception nếu không thấy. Lý do dùng trigger thay vì 2 cột FK riêng + check "đúng 1 không null": giữ đúng 1 cột `item_id`, đơn giản hoá code TS (không phải xử lý `kanji_id is null xor example_id is null`), đánh đổi là ràng buộc không hiện ở `\d` như FK thật — ghi rõ trong migration comment.

### 3.3 Ánh xạ cột CSV → DB & xử lý trường hợp đặc biệt

| Nguồn | Cột DB | Ghi chú |
|---|---|---|
| `kanji_512.csv.lesson/order_in_lesson` | `review_kanji.deck_lesson/deck_order` | Luôn có, 512 dòng |
| `vnjp_kanji.csv.lesson/order_in_lesson_vnjp` | `review_kanji.vnjp_lesson/vnjp_order` | Chỉ 192 dòng khớp theo ký tự `kanji`; còn lại null |
| `vnjp_kanji.csv.meaning_vi_vnjp` | `review_kanji.meaning_vi` | Chỉ 192 dòng |
| `kanji_512.csv.han_viet_accepted` (22 dòng) | `review_kanji.han_viet_accepted` (text[], tách bằng `\|`) | Hợp nhất thêm `vnjp_kanji.csv.han_viet_vnjp` nếu khác `han_viet_main` và chưa có trong accepted — VNJP và deck gốc có thể lệch thêm ngoài 22 dòng đã biết, script phải tự phát hiện lệch (so `han_viet_main` hai nguồn) và log, không âm thầm bỏ |
| `vnjp_examples.csv` (1.399 dòng) | `review_example` (dedupe theo `term+reading_kana`) + `review_example_kanji` (1 dòng cho mỗi `(example, kanji_parent)` gặp trong CSV) | Ví dụ xuất hiện ở N kanji cha → N dòng CSV, 1 dòng `review_example`, N dòng `review_example_kanji` |
| `々` (kanji_512 dòng có `is_kanji=false`) | `review_kanji` với `is_kanji=false`, `han_viet_main=null` | Trigger/constraint ở tầng ứng dụng (packages/core `buildQuizPlan`) loại khỏi K1/K2 khi `is_kanji=false or han_viet_main is null` |
| `needs_review=true` (cả 2 CSV) | `needs_review=true`, `confirmed_at=null` | Loại khỏi candidate pool quiz (packages/core `pickQuizCandidates` lọc `confirmed_at is not null`) |
| BOM đầu file `vnjp_kanji.csv`/`vnjp_examples.csv` | — | Script nạp strip BOM (`﻿`) trước khi parse cột đầu |

**Câu hỏi khả dụng theo mục:** mỗi `review_kanji` có `question_type` áp dụng = `{K1, K2}` nếu `is_kanji=true and han_viet_main is not null and confirmed_at is not null`, ngược lại `{}`. Mỗi `review_example` có `{E1, E2}` nếu `meaning_vi is not null and confirmed_at is not null`, ngược lại `{}`. **Đợt 1 không seed kanji/ví dụ nào thiếu `meaning_vi`/`han_viet_main`** (quyết định 2.1.2 loại bỏ hẳn tình huống "nạp nửa"), nên công thức này chỉ thật sự phát huy tác dụng khi bài 13–32 được nạp sau — giữ nguyên trong schema/`packages/core` từ đầu để không phải đổi logic lúc đó.

### 3.4 RLS

```sql
alter table review_kanji enable row level security;
alter table review_example enable row level security;
alter table review_example_kanji enable row level security;
alter table review_import_batch enable row level security;
alter table review_list enable row level security;
alter table review_list_item enable row level security;
alter table review_card_state enable row level security;
alter table review_attempt_log enable row level security;

-- Danh mục chung: đọc được nếu đã xác nhận (confirmed_at not null) — needs_review chưa xác nhận vẫn SELECT được
-- (để browse/UI vẫn hiện, chỉ loại khỏi quiz ở tầng ứng dụng) nhưng client biết để hiện nhãn "đang chờ xác nhận".
create policy review_kanji_read on review_kanji for select to authenticated using (true);
create policy review_example_read on review_example for select to authenticated using (true);
create policy review_example_kanji_read on review_example_kanji for select to authenticated using (true);
-- review_import_batch: KHÔNG tạo policy nào cho authenticated (deny-all mặc định của RLS) — chỉ service role đọc được.

create policy review_list_owner on review_list for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy review_list_item_owner on review_list_item for all to authenticated
  using (exists (select 1 from review_list l where l.id = list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from review_list l where l.id = list_id and l.user_id = (select auth.uid())));
create policy review_card_state_owner on review_card_state for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- attempt_log: append-only — chỉ select+insert, KHÔNG update/delete (không policy cho 2 lệnh này = bị chặn)
create policy review_attempt_log_select on review_attempt_log for select to authenticated
  using (user_id = (select auth.uid()));
create policy review_attempt_log_insert on review_attempt_log for insert to authenticated
  with check (user_id = (select auth.uid()));
```

**Hành vi RLS cần test (theo CLAUDE.md mục 3.2 + master prompt mục 4.3):**
- B cố `insert into review_card_state (user_id=A's id, ...)` → vi phạm `with check` → lỗi `42501`.
- B cố `update review_list set name=... where id = <list của A>` → 0 dòng bị đổi, không lỗi (RLS ẩn hàng, không phải exception).
- Anon (chưa đăng nhập) `select * from review_kanji` → bị chặn (role `authenticated` only, anon không match policy) — xem mẫu 3 user A/B/C hiện có trong `rls_test.sql`, cần thêm 1 nhánh "anon" nếu bản hiện tại chưa có (phải đọc lại khi code, chưa xác nhận bằng khảo sát này).
- A tạo `review_list_item` trỏ `item_id` không tồn tại trong `review_kanji` → trigger chặn, không liên quan RLS nhưng phải test cùng khối.
- A gọi `review_submit_answer` cho `item_id` thuộc `review_kanji` nhưng `question_type='E1'` → phải bị từ chối (check constraint ở `review_card_state`, RPC phải validate trước khi insert để trả lỗi rõ ràng, không dựa 100% vào DB constraint).

---

## 4. RPC

Theo mẫu `create_plan`/`update_plan_progress` (`security invoker`, raise exception tiếng Việt khi sai).

### 4.1 `review_get_quiz_batch(p_item_refs jsonb, p_question_types text[], p_limit int)`
- Input: danh sách `{item_type, item_id}` đã chọn (từ list/bài/smart-scope — FE tự lọc trước khi gọi), loại câu hỏi muốn, số câu tối đa.
- Lọc server-side: chỉ nhận `item_id` mà `confirmed_at is not null` và loại câu hỏi hợp lệ với `item_type`; **không bao giờ trả về `han_viet_main`, `han_viet_accepted`, `meaning_vi` (với E1/E2), `reading_kana` (với E2)** — chỉ trả đúng phần "đề" theo từng loại:
  - K1: `{item_id, kanji}` (đề = ký tự kanji, chấm Hán Việt)
  - E1: `{item_id, term}` (đề = từ dạng kanji, chấm Hán Việt cả từ)
  - K2: `{item_id, han_viet_main, meaning_en, stroke_count_hint: stroke_count if requested}` (đề = Hán Việt+nghĩa Anh, **không có `kanji`**)
  - E2: `{item_id, meaning_vi, han_viet_main_of_parent?}` (đề = nghĩa tiếng Việt, chấm từ tiếng Nhật gõ vào — **không có `reading_kana`, không có `term`**)
- Trả về mảng đã trộn ngẫu nhiên (`order by random()` hoặc trộn ở TS sau khi nhận — **chốt lúc viết code M2**, không chặn duyệt plan; nếu cần reproducibility cho test thì trộn ở TS với seed cố định).

### 4.2 `review_reveal_answer(p_item_type text, p_item_id uuid, p_question_type text)`
- Chỉ dùng cho K2 (và có thể dùng chung cho "xem đáp án" sau khi K1/E1/E2 đã nộp, phục vụ UI hiện giải thích — nhưng với K1/E1/E2 đáp án đã trả về trong response của `review_submit_answer`, nên **chỉ K2 cần gọi hàm này trước khi tự chấm**).
- Trả về `{kanji, svg_path, stroke_count, han_viet_main, meaning_en}` — không ghi gì vào DB (chỉ SELECT), không tính vào `review_attempt_log`.

### 4.3 `review_submit_answer(p_item_type text, p_item_id uuid, p_question_type text, p_answer_text text, p_self_correct boolean, p_client_attempt_id uuid)`
- 1 transaction: validate `(item_type, question_type)` hợp lệ → với K1/E1/E2: so khớp bằng hàm SQL mirror của `packages/core` (xem §5) để tính `is_correct`; với K2: `is_correct := p_self_correct` (bỏ qua `p_answer_text`).
- Chặn **đáp án đã lộ trước khi trả lời**: với K1/E1/E2, hàm tự tra `review_kanji`/`review_example` để so khớp — client không bao giờ cần biết đáp án trước.
- Upsert `review_card_state` theo logic `applyAnswer` (mirror TS, xem §5), insert `review_attempt_log` với `on conflict (client_attempt_id) do nothing` rồi đọc lại hàng đó để trả về idempotent (resend không tính 2 lần).
- Trả về `{is_correct, correct_answer_display, new_streak, new_mastery_level}` để FE hiện ngay (giải thích/nghĩa tiếng Việt cho E1 hiện ở đây, sau khi đã trả lời — đúng yêu cầu "chỉ hiện sau khi trả lời").

### 4.4 Thống kê Home/chi tiết, Smart scope
- **Không cần RPC riêng** — đọc thẳng qua Supabase JS từ Server Component (RLS tự áp dụng), giống `apps/web/src/lib/task-detail.ts`. Các hàm `apps/web/src/lib/review-stats.ts` (mới) tổng hợp: % mastered theo bài/toàn bộ (đếm `review_card_state` theo điều kiện), danh sách "streak thấp nhất/ít ôn nhất/chưa làm" lấy từ `review_card_state` LEFT JOIN `review_kanji`/`review_example` rồi đưa vào `packages/core.pickQuizCandidates` để xếp hạng (logic xếp hạng là hàm thuần, câu SQL chỉ lấy dữ liệu thô).

---

## 5. `packages/core/src/review.ts`

Theo convention `adjustments.ts` (comment đầu file, `interface` rõ kiểu, hằng số ngưỡng đặt tên).

```ts
export const MASTERY_STREAK = { mastered: 3, good: 2, toConfirm: 1 } as const; // ngưỡng, có thể chỉnh
export const TOTAL_BOOK_LESSONS = 32; // cố định theo cấu trúc sách, KHÔNG phụ thuộc dữ liệu đã seed —
  // dùng để Home vẽ đủ 32 ô bài, phân biệt "chưa nạp dữ liệu" (bài > số bài lớn nhất có trong DB) với "đã nạp, 0%"

export type MasteryLevel = 'new' | 'bad' | 'to_confirm' | 'good' | 'mastered';
export interface CardState {
  correctCount: number; wrongCount: number; streak: number; masteryLevel: MasteryLevel; lastReviewedAt: string | null;
}

export function calculateMastery(streak: number, wrongCount: number): MasteryLevel { ... }
  // streak>=3 mastered; streak===2 good; streak===1 to_confirm; streak===0 && wrongCount>0 bad; else new

export function applyAnswer(state: CardState, isCorrect: boolean, nowIso: string): CardState { ... }
  // đúng: streak+1, correctCount+1; sai/pass: streak=0, wrongCount+1; luôn gọi calculateMastery; không đọc đồng hồ (nhận nowIso)

export function normalizeHanVietSyllable(input: string): string { ... }
  // NFC, hạ chữ thường, trim, quy về vị trí dấu thanh chuẩn cho các vần nhiều cách gõ (oa/uy/...)

export function compareHanVietAnswer(userInput: string, acceptedForms: string[]): boolean { ... }
  // tách theo khoảng trắng để chấm từng âm tiết (dùng cho E1 ghép nhiều chữ); so khớp từng âm tiết
  // bằng normalizeHanVietSyllable; trả false nếu số âm tiết không khớp số chữ trong term

export function normalizeJapaneseAnswer(input: string): string { return input.normalize('NFKC').trim(); }
export function compareJapaneseAnswer(userInput: string, correctReading: string): boolean { ... } // so khớp chính xác sau NFKC

export type QuestionType = 'K1' | 'E1' | 'K2' | 'E2';
export type ItemType = 'kanji' | 'example';
export interface QuizCandidate {
  itemType: ItemType; itemId: string; applicableQuestionTypes: QuestionType[]; cardStates: Partial<Record<QuestionType, CardState>>;
}
export type SmartStrategy = 'least_streak' | 'least_accuracy' | 'least_reviewed' | 'unseen_first';
export function pickQuizCandidates(candidates: QuizCandidate[], strategy: SmartStrategy, limit: number): QuizCandidate[] { ... }

export function maxQuestionsFor(candidates: QuizCandidate[]): number { ... } // Σ applicableQuestionTypes.length
export interface QuestionEnvelope { itemType: ItemType; itemId: string; questionType: QuestionType }
export function buildQuizPlan(candidates: QuizCandidate[], questionTypes: QuestionType[], maxQuestions: number): QuestionEnvelope[] { ... }
  // cap theo maxQuestionsFor, lọc theo questionTypes được chọn, không sinh câu cho loại không áp dụng

export function masteredRatio(states: CardState[]): number { ... } // vòng % Home = mastered / total, total=0 → trả 0 (không NaN)
```

**Test dự kiến (`packages/core/tests/review.test.mts`, cùng chuỗi `&&` của `packages/core/package.json`):**
- `calculateMastery`: 5 case đủ 5 mức (new/bad/to_confirm/good/mastered), case biên streak=3 vs 2.
- `applyAnswer`: đúng liên tiếp 3 lần → mastered; sai sau khi đã mastered → streak về 0, bad (không giữ "đã từng mastered" — đúng tinh thần "sai → streak=0").
- `normalizeHanVietSyllable`/`compareHanVietAnswer` — hành vi đã chốt ở quyết định 2.1.1, bảng test tối thiểu (M2 viết đủ, không chỉ các case này):
  | Input A | Input B | Kỳ vọng | Lý do |
  |---|---|---|---|
  | `hoà` | `hòa` | khớp | chỉ khác vị trí dấu thanh, cùng thanh huyền |
  | `uý` | `úy` | khớp | chỉ khác vị trí dấu thanh, cùng thanh sắc |
  | `Hỏa` | `Hóa` | **không khớp** | khác thanh (hỏi vs sắc) |
  | `Nhất` | ` nhất ` | khớp | case-fold + trim, không đổi thanh |
  | `hanh` | `hành` | **không khớp** | gõ không dấu — quyết định 2.1.1 cấm tuyệt đối |
  | `hoa` | `hoà` | **không khớp** | thiếu dấu thanh hoàn toàn, không phải lệch vị trí dấu |
  | `trươc` | `trước` | **không khớp** | thiếu dấu thanh (ví dụ âm tiết nhiều dấu phụ) |
- `compareJapaneseAnswer`: `もの` vs `モノ` sau NFKC (NFKC không gộp hiragana/katakana — nếu khi code M2 phát hiện `vnjp_examples.csv.reading_kana` thật sự lẫn cả 2 kiểu viết cho cùng từ, cần quay lại hỏi user; khảo sát dữ liệu hiện tại ở §0.4 không thấy dấu hiệu này, giữ nguyên NFKC thuần cho đợt 1).
- `buildQuizPlan`/`maxQuestionsFor`: cap đúng công thức, loại kanji `is_kanji=false`/`confirmed_at=null` khỏi K1/K2.
- `pickQuizCandidates`: mỗi strategy cho đúng thứ tự dự kiến trên tập dữ liệu giả cố định.

**Test tương đương RPC↔TS:** `scripts/test-review-grading-equivalence.mts` (tích hợp, cần Supabase local) — chạy cùng bảng test case Hán Việt/Nhật ở trên qua RPC `review_submit_answer` thật, so `is_correct` trả về với kết quả hàm TS tương ứng; nối vào `test:integration` nếu cần (milestone M4).

---

## 6. Frontend

### 6.1 Cây route (`apps/web/src/app/(app)/review/`)
- `review/page.tsx` — Home: vòng % tổng (tái dùng pattern `progress-rings.tsx`), % theo từng bài (đủ `TOTAL_BOOK_LESSONS=32` ô cố định; bài 13–32 — chưa seed ở đợt này — hiện mờ/khoá nhãn "Chưa có dữ liệu", KHÔNG hiện như bài rỗng/lỗi, phân biệt rõ với bài đã nạp nhưng 0% mastered), 3 lối vào: Duyệt kanji / Danh sách của tôi / Luyện tập, **và 1 dòng liên kết nhỏ ở footer trang trỏ tới `review/licenses`** (quyết định 2.1.4 — không vào nav chính, không là nút lớn).
- `review/browse/page.tsx` — lưới 512 kanji (ảo hoá cuộn hoặc phân trang theo bài, **không render 512 DOM node cùng lúc trên điện thoại yếu** — quyết định kỹ thuật ở M3), chọn nhiều → thanh hành động nổi "Thêm vào danh sách" / "Luyện ngay".
- `review/browse/[hex]/page.tsx` — chi tiết 1 kanji: glyph lớn, Hán Việt, on/kun, ví dụ (từ `review_example_kanji`), thống kê 2 thẻ K1/K2, SVG KanjiVG (xem §6.3), bảng tập viết tay (canvas, lưới ô + nét mẫu mờ, nút bật/tắt).
- `review/lists/page.tsx` + `actions.ts` — CRUD list cá nhân.
- `review/quiz/new/page.tsx` — chọn scope (list / theo bài dựng sẵn / smart strategy), loại câu hỏi, thanh trượt số câu (cap theo `maxQuestionsFor`).
- `review/quiz/[sessionId]/page.tsx` + `QuizRunner` (`'use client'`, component mới ở `apps/web/src/components/quiz-runner.tsx`) — chạy từng câu, gọi Server Action bọc RPC `review_submit_answer`/`review_reveal_answer`.
- `review/licenses/page.tsx` — trang "Nguồn dữ liệu và giấy phép" (nội dung từ `ATTRIBUTION.md`, dịch/rút gọn tiếng Việt). Chỉ vào được qua liên kết nhỏ ở footer `review/page.tsx` + liên kết ghi công cạnh SVG ở trang chi tiết kanji (§6.3) — không có trong `bottom-nav.tsx`.

### 6.2 Copy mới (`apps/web/src/lib/copy.ts`, nhóm `// Ôn luyện`)
Danh sách key cần thêm (không viết nội dung ở plan, chỉ liệt kê để ước lượng): tiêu đề 7 trang trên, nhãn 5 mức mastery, nhãn 4 loại câu hỏi (hiển thị cho người dùng bằng tên dễ hiểu, không phải mã K1/E1/K2/E2), thông báo rỗng ("Chưa có danh sách nào", "Bài này chưa có ví dụ, đang chờ bổ sung"), cảnh báo IME đang gõ, nhãn nút ✓/✗ tự xác nhận K2, disclaimer giấy phép rút gọn hiện ở màn chi tiết.

### 6.3 Hiển thị SVG thứ tự nét
- `<img src="/kanjivg/<hex>.svg">` tĩnh cho chế độ xem nhanh (lưới duyệt); ở màn chi tiết, **inline SVG** (fetch nội dung, render qua `dangerouslySetInnerHTML`?) — **KHÔNG được dùng `dangerouslySetInnerHTML`** theo CLAUDE.md mục 5 ("Nội dung do LLM/người dùng sinh... Markdown phải qua sanitizer") — nhưng SVG này là **asset tĩnh do app tự host, không do người dùng/LLM sinh**, nên rủi ro XSS không áp dụng theo đúng nghĩa luật; tuy vậy để an toàn và nhất quán, **dùng `<img>` cho hiển thị tĩnh + CSS `@keyframes stroke-dasharray` cho animation nếu cần "nét chạy"**, tránh đụng tới `dangerouslySetInnerHTML` hoàn toàn (giữ đơn giản, không cần parse SVG ở React). Animation thứ tự nét nâng cao (vẽ từng nét) để **sau** nếu M3 không đủ thời gian — fallback tối thiểu là ảnh tĩnh có đánh số nét (đã có trong file KanjiVG màu theo nét).
- Ghi công hiển thị ngay dưới SVG ở màn chi tiết (link `/review/licenses`).

### 6.4 Canvas viết tay (K2)
- `<canvas>` thuần, không thêm dependency. Nghe `pointerdown/pointermove/pointerup` (không `mousedown`, để chạy đúng trên iOS Safari/Android Chrome theo CLAUDE.md mục 5), vẽ bằng Canvas 2D `lineTo`. Đếm số nét = số lần `pointerdown→pointerup` có di chuyển (ngưỡng khoảng cách nhỏ để lọc tap nhầm). Nút "Xoá" vẽ lại, nút "Xem đáp án" gọi `review_reveal_answer`.
- Bố cục 360px: canvas vuông, chiều rộng = `min(viewport width - 32px, 320px)`, không dùng `vw` tuyệt đối để tránh vỡ layout khi bàn phím ảo mở (K1/E1/E2 có input text, cần test bàn phím ảo không che nút xác nhận — theo CLAUDE.md mục 5).

### 6.5 Bàn phím & IME (K1/E1/E2)
- `<input>` thường (không `type=number`), bắt `onCompositionStart`/`onCompositionEnd` để **không chấm khi đang compose** (đúng yêu cầu prompt) — chặn submit (disable nút) trong lúc `isComposing=true`.
- E2 gõ tiếng Nhật trên điện thoại Việt thường không có bàn phím Nhật — **ghi chú rủi ro UX ở §10**, không phải bug để sửa trong plan này (ngoài khả năng của app).

### 6.6 Trạng thái loading/lỗi/rỗng
- Theo mẫu `apps/web/src/app/(app)/roadmap/loading.tsx`, `apps/web/src/app/(app)/upcoming/loading.tsx` — thêm `loading.tsx` tương ứng cho `review/browse`, `review/quiz/[sessionId]`.
- Lỗi qua `AppError`/`toUserMessage` (`apps/web/src/lib/errors.ts`), không nuốt lỗi âm thầm.

---

## 7. Bảo mật/RLS — ma trận quyền

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `review_kanji`, `review_example`, `review_example_kanji` | authenticated: tất cả | service role only | service role only | service role only |
| `review_import_batch` | service role only | service role only | — | — |
| `review_list`, `review_list_item` | chủ sở hữu | chủ sở hữu (trigger chặn `item_id` rác) | chủ sở hữu | chủ sở hữu |
| `review_card_state` | chủ sở hữu | chủ sở hữu (qua RPC, không insert trực tiếp từ client — RPC `security invoker` vẫn chịu RLS nên policy vẫn cần đúng) | chủ sở hữu | không cho (không có policy delete — giữ lịch sử, xoá mastery không hợp lý) |
| `review_attempt_log` | chủ sở hữu | chủ sở hữu, qua RPC | không cho | không cho |

**Vòng lặp lạm dụng đã nghĩ tới:** (1) User A thêm `item_id` của B vào `review_list_item` của chính A — hợp lệ, vì `review_kanji`/`review_example` là dữ liệu chung, không phải "của B"; không phải lỗ hổng. (2) User gọi `review_submit_answer` với `item_id` không tồn tại → trigger/validate raise exception, không tạo rác. (3) User gọi lại `review_submit_answer` với `client_attempt_id` cũ sau khi mạng lag → `on conflict do nothing`, không tính 2 lần, trả lại kết quả đã lưu. (4) User cố gọi RPC với `question_type` không khớp `item_type` (vd E1 cho `item_type='kanji'`) → RPC tự validate trả lỗi rõ trước khi đụng DB (không dựa hoàn toàn vào CHECK constraint để lỗi thân thiện hơn).

---

## 8. Giấy phép & ghi công

Theo đúng `ATTRIBUTION.md` đã có trong `kanji512_review_pack/` — copy nội dung (rút gọn tiếng Việt, giữ link) vào `review/licenses/page.tsx` + giữ 1 bản `ATTRIBUTION.md`/`LICENSES.md` ở gốc repo (hoặc `data/review/kanji-look-and-learn-512/ATTRIBUTION.md`) để không phải lục `kanji512_review_pack/` khi deploy sau này. Ghi công ngắn lặp lại ở màn chi tiết kanji (gần SVG). File SVG giữ nguyên comment đầu file, không minify. Mục "Cần quyết định lại trước khi phát hành công khai" (không phải tư vấn pháp lý, chỉ đánh giá rủi ro):
- Nội dung VNJP © VNJPCLUB và *Kanji Look and Learn* © Japan Times — app chỉ dùng danh sách 512 chữ + thứ tự bài (không hình minh hoạ/gợi nhớ), nhưng việc "danh sách 512 chữ theo đúng thứ tự 1 sách cụ thể" là tài sản biên soạn của nhà xuất bản; dùng cá nhân/local-only như hiện tại rủi ro thấp, dùng công khai cho nhiều người cần người có hiểu biết pháp lý xem lại.
- KANJIDIC2/KanjiVG là CC BY-SA — Share-Alike có thể lan sang **dữ liệu dẫn xuất** (`review_kanji`/`review_example` và file nạp), ghi công là đủ cho phần dữ liệu; ảnh hưởng tới **mã nguồn ứng dụng** (có phải mở mã theo CC BY-SA không) là câu hỏi pháp lý thật, plan không kết luận.

---

## 9. Sửa CLAUDE.md (bất biến #4) — ĐÃ DUYỆT, ĐÃ ÁP DỤNG 2026-10-16

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ mục 3. BẤT BIẾN NGHIỆP VỤ
-4. **App không chứa nội dung học** (không bài giảng, ngân hàng đề, flashcard, chấm bài, cộng đồng).
+4. **App không chứa nội dung học soạn sẵn kiểu giáo trình** (không bài giảng dạng video/text diễn giải,
+   ngân hàng đề thi, chấm bài tự luận, cộng đồng/thảo luận/bình luận).
+   **Ngoại lệ có điều kiện — công cụ ôn luyện ghi nhớ (flashcard/quiz) cho đơn vị kiến thức rời**
+   (kanji, từ vựng, sau này có thể mở rộng loại khác), được phép khi thoả ĐỦ CẢ BA:
+   (a) Dữ liệu gốc hiển thị (chữ/nghĩa/âm đọc/ví dụ) chỉ là **tham chiếu khách quan** lấy từ nguồn
+       mở hoặc do người dùng tự nhập, không phải bài giảng diễn giải tự soạn của dự án;
+   (b) **Không có "ngân hàng đề" soạn sẵn theo giáo trình để bán/phân phối cho người khác** — tổ
+       chức theo đơn vị có sẵn trong nguồn dữ liệu (ví dụ "theo bài" của một cuốn sách cụ thể) hoặc
+       theo danh sách người dùng tự chọn đều được phép, miễn không đóng gói lại nội dung giáo trình
+       để phân phối ngoài phạm vi cá nhân;
+   (c) **Không chấm bài tự luận, không có cộng đồng/bình luận/thảo luận.** Chấm viết tay (nếu có)
+       chỉ ở mức khoan dung + tự xác nhận (✓/✗ do người dùng bấm), không phải nhận diện/chấm điểm
+       tự động bằng máy cho nội dung tự do.
+   Dữ liệu nguồn mở dùng trong tính năng ôn luyện (vd thứ tự nét KanjiVG, KANJIDIC2) phải ghi rõ
+   giấy phép và nguồn ngay trong app.
```

**Đối chiếu điều kiện (a)(b)(c) với module này:**
- (a) Đạt — dữ liệu Hán Việt/âm đọc/nghĩa lấy từ KANJIDIC2 (nguồn mở, có ghi công), ví dụ lấy từ VNJP (dữ liệu tác giả tự tổng hợp từ việc học, không phải bài giảng tự soạn mới); không có lời giải thích ngữ pháp/diễn giải nào do app viết thêm.
- (b) **Không đạt 100% theo câu chữ bản cũ** ("danh sách do chính người dùng tự chọn/tạo") vì prompt hiện tại cho phép "quiz dựng sẵn theo bài" — đây là lý do câu chữ đề xuất ở trên **đổi (b) thành "không đóng gói để phân phối"** thay vì "chỉ người dùng tự chọn", phản ánh đúng thực tế: tổ chức theo bài của 1 sách cụ thể vẫn ổn miễn app không bán/phân phối lại nội dung đó, khác với việc có con ngân hàng đề thi JLPT soạn sẵn để chấm điểm thật.
- (c) Đạt — K2 chỉ tự xác nhận, không AI/thuật toán chấm nét vẽ; không cộng đồng.

**Đã áp dụng nguyên văn vào `CLAUDE.md` mục 3, dòng 4 (quyết định 2.1.3), commit riêng tách khỏi thay đổi tài liệu plan.**

---

## 10. Milestone

| # | Phạm vi | File chính | Kiểm tra | Song song được? |
|---|---|---|---|---|
| **M0** | Khảo sát + duyệt plan này + chốt câu chữ CLAUDE.md | `docs/plans/review-feature.plan.md`, `CLAUDE.md` | user đọc & OK | — |
| **M1a** | Migration schema + RLS + RPC khung (chưa cần dữ liệu thật) + nối `scripts/rls_test.sql` | `supabase/migrations/<ts>_review_schema.sql`, `scripts/rls_test.sql` | `npm run check:full`, `rls_test.sql` in `RLS OK` | **Có** — không cần chờ dữ liệu bài 13–32, chỉ cần schema đúng |
| **M1b** | Copy dữ liệu vào `data/review/...` (chỉ `vnjp_kanji.csv`/`vnjp_examples.csv` + phần `kanji_512.csv` lọc `lesson<=12`) + SVG 192 file vào `public/kanjivg/` + script nạp (idempotent, chỉ seed 192 kanji/1.399 dòng ví dụ bài 1–12, tự đếm/log needs_review, strip BOM, dedupe example) | `data/review/kanji-look-and-learn-512/`, `apps/web/public/kanjivg/`, `scripts/seed-review.ts` | script chạy 2 lần liên tiếp cho cùng kết quả (idempotent); log đúng **192 kanji, 1.399 dòng ví dụ gộp về N example duy nhất** (N sau dedupe theo `(term, reading_kana)` — chưa biết trước, script tự in ra); **không có dòng nào thuộc deck_lesson>12** | Sau M1a, độc lập M2 |
| **M2** | `packages/core/src/review.ts` + test + mirror SQL cho `review_submit_answer` | `packages/core/src/review.ts`, `packages/core/tests/review.test.mts`, `packages/core/src/index.ts` | `npm run test:core` tăng số test, không giảm | Sau M1a (cần biết schema để viết mirror SQL), độc lập M1b nếu dùng fixture giả |
| **M3** | FE duyệt/chi tiết/danh sách (không có quiz) | `review/page.tsx`, `review/browse/*`, `review/lists/*`, `copy.ts`, `review-stats.ts` | `npm run check`, test thủ công 360px + PWA/iOS | Sau M1b + M2 |
| **M4** | FE quiz + Server Action gọi RPC + test tương đương RPC↔TS | `review/quiz/*`, `quiz-runner.tsx`, `scripts/test-review-grading-equivalence.mts` | `npm run check:full` (đụng RPC thật), test thủ công quiz 4 loại câu trên 360px | Sau M2 + M1a (cần RPC thật) |
| **M5** | Nav (`bottom-nav.tsx` thêm mục), trang giấy phép, hoàn thiện copy | `components/bottom-nav.tsx`, `review/licenses/page.tsx` | `npm run check` | Cuối cùng |

**M1a làm được ngay sau khi CLAUDE.md được sửa (M0), không chờ bài 13–32** — đúng tiêu chí bắt buộc của master prompt.

---

## 11. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Hán Việt lệch giữa `kanji_512.csv`/`vnjp_kanji.csv` ngoài 22 dòng đã biết | Script nạp (M1b) tự so sánh 2 nguồn, log mọi lệch phát hiện thêm, không âm thầm chọn 1 bên |
| Thuật toán so khớp "khung âm + thanh" sai trong trường hợp hiếm (từ Hán Việt có phụ âm đầu/cuối đặc biệt) | Bảng test case cụ thể (§5) duyệt trước khi code; test tương đương RPC↔TS phát hiện sớm nếu SQL mirror lệch TS |
| Ảnh VNJP bài 6 (明)/bài 10 (白) bị cắt → danh sách ví dụ thiếu | Không chặn tiến độ; ghi `needs_review`/log số ví dụ mỗi kanji, dễ phát hiện bất thường (vd 0 ví dụ bất ngờ) sau khi nạp |
| Canvas K2 trên Safari iOS (PWA đã cài) — độ trễ `pointermove`, `touch-action` chặn scroll | Test thủ công thật trên thiết bị theo CLAUDE.md mục 5 ở M4; `touch-action: none` trên canvas, `overscroll-behavior` ở container |
| SVG (đợt 1: 192 file, ước lượng ~1.2 MB theo tỉ lệ 3.3MB/512) làm nặng lưới duyệt nếu tải hết cùng lúc; tăng dần khi bài 13-32 nạp sau (tới 3.3MB/512 file) | `<img loading="lazy">`, phân trang/ảo hoá theo bài ở `review/browse` (M3); không precache toàn bộ trong `sw.js` |
| Hiệu năng truy vấn thống kê Home (đợt 1: 192×2 + N×2 ví dụ ≈ vài trăm card mỗi user; tăng lên tới ~3000 khi đủ 512 kanji + ~1000 ví dụ) | Index đã có trên PK; nếu chậm thật khi đo, cân nhắc view/aggregate — **đo trước khi tối ưu**, không tối ưu sớm |
| Giấy phép CC BY-SA lan sang mã nguồn | Mục "Cần quyết định lại trước khi phát hành công khai" (§8), không tự quyết |
| `々` hoặc dòng needs_review khiến script nạp crash nếu không xử lý rỗng | Test nạp phải có case cụ thể cho `々`, cho dòng `han_viet_main` rỗng, trước khi chạy trên toàn bộ 512 dòng |

---

## 12. Ngoài phạm vi đợt này

- Phát âm/TTS.
- Biểu đồ tiến bộ theo ngày (bảng `review_attempt_log` đã thiết kế đủ cột để làm sau, không cần đổi schema).
- **Nạp bài 13–32 (320 kanji còn lại) — quyết định 2.1.2, dứt khoát ngoài phạm vi đợt này**, kể cả phần Hán Việt/nghĩa Anh đã có sẵn trong `kanji_512.csv`. Khi có dữ liệu VNJP tương ứng: chỉ thêm file + chạy lại script nạp (idempotent) — không cần đổi schema/`packages/core`.
- Màn hình admin xác nhận `needs_review` (`confirmed_at`) — hiện chỉ có log console + hiển thị số lượng tĩnh ở `review/licenses`.
- Nhập danh sách CSV/TSV do người dùng tự tạo.
- Tích hợp "bài VNJP xong trong tracker lộ trình N3 → gợi ý thêm kanji bài đó vào review" (tracker N3 hiện tại không có khái niệm "bài kanji VNJP" — cần thiết kế riêng nếu muốn làm).
- Lịch ôn kiểu Leitner (`due_at`).
- Animation nét vẽ chạy từng nét (chỉ có ảnh tĩnh KanjiVG tô màu theo nét ở MVP).

---

## 13. Tóm tắt cho chat (xem cuối lượt)

(Nội dung tóm tắt ≤15 dòng + câu hỏi mở được đưa riêng trong tin nhắn chat, không lặp lại ở đây.)
