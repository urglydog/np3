# HANDOFF — Module "Ôn luyện" (Kanji 512), sau khi plan đã duyệt

> Đọc cùng `docs/plans/review-feature.plan.md` (FINAL v1, 2026-10-16). File này chỉ để tiếp tục làm ở máy khác (nhà) — không lặp lại nội dung plan.

## Tóm tắt 10 dòng

1. Plan module "Ôn luyện" (flashcard/quiz kanji) đã FINAL, CLAUDE.md bất biến #4 đã sửa để cho phép (commit riêng).
2. Phạm vi đợt 1: **chỉ 192 kanji bài 1–12** + 1.399 ví dụ VNJP — bài 13–32 (320 kanji) để sau.
3. 4 loại câu hỏi: K1 (gõ Hán Việt kanji), E1 (gõ Hán Việt cả từ ví dụ), K2 (viết tay canvas, tự chấm ✓/✗), E2 (gõ tiếng Nhật theo nghĩa Việt).
4. Hán Việt chấm **đúng dấu thanh**, chỉ khoan dung vị trí dấu (hoà=hòa), không chấp nhận gõ không dấu.
5. Schema: 4 bảng chung (`review_kanji`, `review_example`, `review_example_kanji`, `review_import_batch`) + 4 bảng cá nhân RLS owner-only (`review_list`, `review_list_item`, `review_card_state`, `review_attempt_log`).
6. Logic thuần ở `packages/core/src/review.ts` (chưa viết) + RPC `review_get_quiz_batch`/`review_reveal_answer`/`review_submit_answer` (chưa viết).
7. Thứ tự: **M1a (schema+RLS) làm được ngay**, không cần đợi dữ liệu → M1b (seed 192 kanji) → M2 (core+test) → M3 (FE duyệt) → M4 (FE quiz) → M5 (nav+giấy phép).
8. Ảnh chụp màn hình nguồn VNJP (`resources_512_vnjp/bai_*/16_panel`, `16_detail_panel`) **không nằm trên git**, chỉ có trên máy này.
9. Việc còn nợ trước khi code FE thật mượt: xác nhận 21 ví dụ `needs_review`, chụp lại ảnh bị cắt bài 6/10, chuẩn bị dữ liệu bài 13–32 khi muốn mở rộng.
10. Không có câu hỏi mở nào chặn M1a — có thể bắt đầu ngay khi môi trường Supabase local sẵn sàng.

## Thứ tự làm (bắt buộc M1a trước)

```
M0 (xong) → M1a (schema+RLS, không cần dữ liệu) → M1b (seed 192 kanji) → M2 (packages/core) → M3 (FE duyệt/list) → M4 (FE quiz) → M5 (nav/giấy phép)
```
M1a và M2 có thể làm gần như song song nếu M2 dùng fixture giả trước khi có schema thật — nhưng **migration viết trước thì M2 viết SQL mirror chính xác hơn**, nên vẫn khuyến nghị M1a trước.

## Lệnh kiểm tra môi trường trước khi bắt đầu M1a

```bash
# 1. Repo sạch, đúng nhánh
git status
git log --oneline -5

# 2. Node/npm đúng phiên bản (.nvmrc)
cat .nvmrc && node -v

# 3. Supabase local đang chạy chưa (cần cho mọi việc đụng DB)
npx supabase status || npm run db:start

# 4. Baseline hiện tại vẫn xanh TRƯỚC khi đụng gì (ghi lại số test để so sánh sau M2)
npm run check
# Nếu có Supabase local chạy, chạy luôn:
npm run check:full
```

**Kỳ vọng:** `npm run check` pass hết (lint + typecheck + test:core + test:web); nếu không pass ngay từ đầu, đó là vấn đề môi trường cần xử lý trước, không phải do module review.

## Prompt khởi động M1a (dán được ngay cho Claude Code)

```
Đọc docs/plans/review-feature.plan.md (FINAL v1) mục §3 (Mô hình dữ liệu), §3.4 (RLS) và §10 (M1a).
Viết migration mới supabase/migrations/<timestamp>_review_schema.sql theo đúng schema ở §3.1/§3.2
(8 bảng review_*, trigger kiểm item_id polymorphic, RLS ở §3.4). KHÔNG seed dữ liệu ở bước này
(M1b làm riêng). Cập nhật scripts/rls_test.sql nối thêm khối test cho 8 bảng mới theo đúng mẫu
A/B/anon hiện có (mục "Hành vi RLS cần test" ở §3.4 của plan). Sau khi viết xong: npm run db:reset,
chạy rls_test.sql, in "RLS OK"; chạy npm run check:full; báo cáo theo khung CLAUDE.md mục 1a.
Nhánh làm việc: feat/review-schema (tạo từ develop hoặc main theo CLAUDE.md mục 8).
```

## Việc người dùng còn nợ (không chặn code, nhưng cần làm trước khi coi dữ liệu là "chốt")

- [ ] Chụp lại ảnh bài 6 (chữ 明) và bài 10 (chữ 白) trong `resources_512_vnjp/` — ảnh hiện bị cắt, danh sách ví dụ của 2 kanji này có thể chưa đủ (xem `kanji512_review_pack/DATA_CHANGES.md` "Việc chưa làm được").
- [ ] Rà lại 21 ví dụ gắn `needs_review=1` trong `vnjp_examples.csv` — xác nhận đúng/sai, sau đó đặt `confirmed_at` (khi đã có cột này sau M1b) để các ví dụ này được đưa vào quiz.
- [ ] Rà lại 22 chữ `han_viet_accepted`/`needs_review` trong `kanji_512.csv` liệt kê ở `DATA_CHANGES.md` — đặc biệt các chữ lệch Hán Việt với KANJIDIC2 đã sửa tay (晩/着/払/戦/伝/両/予/政), chưa đối chiếu từ điển Hán Việt chính thức nào.
- [ ] Khi muốn mở rộng bài 13–32: chuẩn bị dữ liệu dạng giống `vnjp_kanji.csv`/`vnjp_examples.csv` hiện có (cùng cột), đặt vào `data/review/kanji-look-and-learn-512/`, chạy lại script seed (idempotent, M1b) — không cần đổi schema.
- [ ] Quyết định việc phát hành công khai (nếu có ý định sau này): đọc lại §8 của plan ("Cần quyết định lại trước khi phát hành công khai") — ảnh hưởng giấy phép CC BY-SA của KANJIDIC2/KanjiVG lên mã nguồn, và việc dùng danh sách 512 chữ theo đúng thứ tự 1 sách cụ thể (Japan Times).

## Ghi chú vận hành máy/dữ liệu

- **Ảnh nguồn VNJP (`kanji512_review_pack/resources_512_vnjp/bai_*/16_panel/`, `16_detail_panel/`) chỉ có trên máy này, KHÔNG có trên remote git** (bị loại trừ có chủ đích trong `.gitignore`, xem commit riêng). Nếu làm tiếp ở máy khác (nhà):
  - **Không cần copy ảnh qua USB/cloud** — toàn bộ dữ liệu cần cho code (Hán Việt, nghĩa, ví dụ, thứ tự bài) đã nằm đủ trong 3 file đã commit: `vnjp_kanji.csv`, `vnjp_examples.csv`, `vnjp_kanji_examples.json` (+ `kanji_512.csv`/`.json`, `svg/`, các file `.md`).
  - Chỉ cần copy ảnh nếu muốn **tiếp tục đối chiếu/kiểm tra nguồn gốc dữ liệu** (vd xác nhận lại 1 Hán Việt bằng cách nhìn lại ảnh chụp sách) — việc này hiếm và không chặn code.
- `kanji512_review_pack/svg/` (512 file, 3.3 MB, CC BY-SA 3.0 KanjiVG) **đã commit đầy đủ** dù M1b chỉ copy 192 file đầu vào `apps/web/public/kanjivg/` — giữ cả 512 trong gói nguồn để sẵn sàng cho lúc nạp bài 13–32.
