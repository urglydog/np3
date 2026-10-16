# BRIEF — Tính năng "Ôn luyện" (flashcard kanji): yêu cầu LÊN PLAN chi tiết

> Dành cho Claude Code đang chạy trong thư mục chứa source code dự án.
> **Nhiệm vụ của bạn trong lượt này: chỉ viết PLAN. KHÔNG viết code, KHÔNG sửa CLAUDE.md, KHÔNG chạy migration.**
> Kết quả nộp: một file `docs/plans/review-feature.plan.md` (tạo thư mục nếu chưa có) + tóm tắt ngắn trong chat. Sau đó dừng lại; user sẽ mang plan đi review rồi quay lại.

---

## 0. Cách làm việc

1. Vào chế độ plan (nếu có). Đọc **CLAUDE.md** của dự án trước, rồi khảo sát code thật (convention migration, RLS, `packages/core`, `apps/web`, `copy.ts`, error handling, PWA/iOS, test runner, scripts `check`/`check:full`).
2. Đọc `PREVIOUS_PLAN_DRAFT.md` trong gói này: đó là **bản plan nháp cũ**. Nó là điểm xuất phát, không phải chân lý. Mục 4 liệt kê những thứ đã thay đổi so với bản cũ. Nếu bản cũ mâu thuẫn với code thật hoặc với CLAUDE.md, **ghi rõ mâu thuẫn trong plan** thay vì im lặng chọn một bên.
3. Mọi tên file / hàm / bảng được nhắc trong brief hoặc plan cũ đều là **giả định cần xác minh trong repo**. Với mỗi giả định, plan phải ghi "đã xác minh ở `<đường dẫn>`" hoặc "KHÔNG tìm thấy, đề xuất thay bằng …".
4. Quyết định thuộc về user (mục 8): hỏi bằng AskUserQuestion nếu có thể; nếu không, ghi vào mục "Câu hỏi mở" của plan kèm khuyến nghị của bạn. Không tự quyết rồi giấu đi.
5. Không bịa ngưỡng, số liệu hay hành vi. Chỗ nào là giả định, đánh dấu `[GIẢ ĐỊNH]`.

## 1. Bối cảnh và mục tiêu

- Chủ dự án đang tự học tiếng Nhật (hướng N3) theo app **VNJP** với giáo trình **Kanji Look and Learn (512 kanji, 32 bài × 16 chữ)**. VNJP không có chế độ ôn luyện.
- Mục tiêu: thêm vào app của chủ dự án một tính năng **Ôn luyện (flashcard ghi nhớ)**: duyệt kanji, xem chi tiết + thứ tự nét, tạo danh sách riêng, làm quiz theo phạm vi, thống kê mức thành thạo theo từng chữ.
- Dài hạn dự án phục vụ CV và có thể có doanh thu; hiện **ưu tiên tính năng, affiliate để sau**.
- Thiết kế **chung** (entry / list / stat không gắn cứng vào "kanji") để mở rộng từ vựng/ngữ pháp sau, nhưng **chỉ nạp kanji** trong đợt này.

## 2. Ràng buộc cứng

- **CLAUDE.md bất biến #4 (mục 3.4) hiện cấm "flashcard" tuyệt đối.** User đã quyết định: *sửa luật theo hướng có ngoại lệ có điều kiện*, không nới lỏng vô hạn. Câu chữ đề xuất nằm trong `PREVIOUS_PLAN_DRAFT.md`, mục 1.
  - Plan phải đưa ra **câu chữ cuối cùng đề xuất** và coi đây là **bước 0 cần user duyệt trước khi ghi đè**.
  - Plan phải chỉ ra từng điều kiện (a)(b)(c) của ngoại lệ được tính năng này thoả như thế nào. Đặc biệt (a) "dữ liệu gốc chỉ là tham chiếu khách quan" và (b) "danh sách do chính người dùng tự chọn/tạo".
- Không chấm điểm nét vẽ tay, không canvas nhận diện nét. Chiều "viết" là **lật thẻ tự đánh giá** (xem đáp án + thứ tự nét, bấm "Nhớ" / "Chưa nhớ").
- Không cộng đồng, không bình luận, không bài giảng diễn giải, không "ngân hàng đề" soạn sẵn.
- Chuỗi hiển thị cho người dùng: **tiếng Việt**, gom vào `copy.ts` (nhóm mới `// Ôn luyện`) theo convention hiện có.
- Mọi bảng mới có RLS; cập nhật `scripts/rls_test.sql` theo mẫu A/B/anon hiện có.
- Hàm logic thuần ở `packages/core` có test; không thêm dependency npm nếu không cần (nếu đề xuất thêm, phải biện minh).
- Giao diện phải chạy tốt ở 360px, PWA/iOS (không dựa vào hover, safe-area…) theo CLAUDE.md.
- Tuân thủ giấy phép dữ liệu (mục 3.4 dưới đây): đây là yêu cầu pháp lý, không phải tuỳ chọn.

## 3. Gói dữ liệu đi kèm (đã kiểm tra và làm sạch)

### 3.1 Cấu trúc thư mục gói

```
kanji_512.csv          # 512 dòng, UTF-8 (không BOM), dấu phẩy, có header
kanji_512.json         # cùng nội dung dạng JSON
svg/<hex>.svg          # 512 file thứ tự nét, tên = mã Unicode 5 chữ số hex thường (vd 04e00.svg)
ATTRIBUTION.md         # nguồn + giấy phép + văn bản ghi công cần hiển thị trong app
DATA_CHANGES.md        # những gì đã sửa so với file Anki gốc
PREVIOUS_PLAN_DRAFT.md # plan nháp cũ
```

Đề xuất vị trí trong repo (plan được phép đề xuất khác nếu có lý do): dữ liệu nguồn ở `data/review/kanji-look-and-learn-512/` (CSV + JSON), SVG ở `apps/web/public/kanjivg/`.

### 3.2 Cột của `kanji_512.csv`

| Cột | Ý nghĩa | Ghi chú |
|---|---|---|
| `lesson` | Bài 1–32 | **Suy ra từ vị trí** trong deck gốc (16 chữ/bài). Khớp nội dung đã kiểm (bài 1 = số đếm, bài 2 = thứ trong tuần, bài 3 = phương hướng) nhưng **chưa đối chiếu toàn bộ với sách** |
| `order_in_lesson` | 1–16 | Thứ tự trong bài, theo thứ tự deck gốc |
| `kanji` | Ký tự | 512 giá trị khác nhau |
| `unicode_hex` | Mã Unicode, 5 chữ số hex thường | Khớp tên file SVG |
| `is_kanji` | `true`/`false` | Chỉ `々` là `false` |
| `han_viet_main` | Âm Hán Việt chính | Rỗng với `込` (chữ quốc tự) và `々` |
| `han_viet_other` | Các âm khác, phân cách `\|` | Gồm cả biến thể quốc ngữ/Nôm lấy từ KANJIDIC2 (vd "Cuốc", "Càng"). **Không nên hiện mặc định** |
| `meaning_en` | Nghĩa tiếng Anh, phân cách `; ` | Từ KANJIDIC2 |
| `note` | Ghi chú bộ thủ, vd `heart radical (no. 61)` | Tách khỏi nghĩa; 10 dòng có giá trị |
| `onyomi` / `kunyomi` | Âm đọc, phân cách `\|` | Katakana / hiragana. Dạng KANJIDIC2: dấu `.` ngăn gốc và okurigana, `-` là tiền/hậu tố. `kunyomi` rỗng ở 48 chữ, `onyomi` rỗng ở `込` và `々` (hợp lệ, không phải lỗi) |
| `stroke_count` | Số nét | |
| `grade` | Lớp Kyōiku (1–6, 8 = jōyō bậc trung học) | Rỗng ở `々` |
| `jlpt_old` | Cấp JLPT **cũ** 4 mức (4 dễ nhất → 1 khó nhất) từ KANJIDIC2 | **Không phải N5–N1 hiện hành.** Đừng hiển thị như "N3" |
| `freq` | Hạng tần suất báo chí (nhỏ = phổ biến) | Có thể rỗng |
| `needs_review` / `review_note` | Chữ cần người kiểm | 22 dòng. **Dữ liệu curation, không nhất thiết đưa vào DB** — plan quyết định |
| `svg_file` | Đường dẫn tương đối tới SVG | `svg/<hex>.svg` |

### 3.3 Những điều cần biết về dữ liệu

- Nguồn gốc: file Anki cộng đồng `Kanji_Look_and_Learn_full_512_kanjis.apkg`. Nội dung nghĩa/âm đọc/Hán Việt của deck khớp từng ký tự với **KANJIDIC2** (đã đối chiếu 511/512). Deck **không** chứa gợi nhớ hay hình minh hoạ của sách.
- **Hán Việt**: trường `vietnam` của KANJIDIC2 xếp **theo thứ tự chữ cái, không theo độ phổ biến**, và lẫn biến thể Nôm. Ví dụ `読` ghi "Đậu, Độc". Vì vậy `han_viet_main` đã được chọn lại (xem `DATA_CHANGES.md`). **UI chỉ nên dùng `han_viet_main` làm âm chính.** 22 chữ đánh dấu `needs_review` là chỗ còn tranh luận.
- **`々` (bài 28, vị trí 15)** là dấu lặp, không phải kanji, không có trong KANJIDIC2. Cần user đối chiếu sách xem đó có thực sự là chữ thứ 512 hay deck đã thay một kanji khác. Plan phải đề xuất cách xử lý (mục 8).
- **SVG** là bản KanjiVG tô màu theo từng nét (qua `kanji_colorize.py`), có số thứ tự nét, kích thước khoảng 327px, tổng ~2,2 MB. Mỗi file giữ nguyên header giấy phép CC BY-SA 3.0. **Không được xoá/nén bỏ comment đầu file** (đừng chạy SVGO với `removeComments`).
- Tên SVG theo mã Unicode đã thống nhất, nên **không cần suy ra mã từ ký tự** như plan cũ giả định, và **không cần tải KanjiVG riêng**.

### 3.4 Giấy phép (bắt buộc đưa vào plan)

- Nghĩa/âm đọc/Hán Việt/số nét: KANJIDIC2 © EDRDG, **CC BY-SA** (theo trang giấy phép hiện hành của EDRDG; phải kèm link tới tài liệu và giấy phép của nhóm). Thứ tự nét: KanjiVG © Ulrich Apel, **CC BY-SA 3.0**.
- Plan phải gồm: (1) trang/màn "Nguồn dữ liệu và giấy phép" trong app, (2) ghi công ngay trong màn chi tiết kanji (nơi hiện SVG), (3) file `ATTRIBUTION.md`/`LICENSES` trong repo, (4) nhận định về ảnh hưởng của Share-Alike lên bảng dữ liệu dẫn xuất. Plan **không đưa kết luận pháp lý chắc chắn**; nêu giả định và để user tự cân nhắc.

## 4. Thay đổi so với plan nháp cũ (plan mới phải phản ánh)

1. **Thêm cột Hán Việt** vào `review_entries` (`han_viet` text + `han_viet_alt` text[], hoặc tương đương). Hán Việt là điểm khác biệt có giá trị với người học Việt.
2. **Ngôn ngữ nghĩa**: dữ liệu có `meaning_en` + Hán Việt; **chưa có nghĩa tiếng Việt**. Câu hỏi "nghĩa tiếng Anh hay Việt" của plan cũ được thu hẹp thành: hiện `han_viet_main` + `meaning_en` và (tuỳ chọn) cho user tự nhập `meaning_vi` sau. Plan đề xuất, user chốt.
3. **SVG đã có sẵn, đặt tên theo mã Unicode**, bỏ bước "tải 512 file từ KanjiVG" và bỏ việc suy mã.
4. **Thêm trường**: `stroke_count`, `note` (bộ thủ). Có thể thêm `grade`, `freq`, `jlpt_old` nếu plan thấy hữu ích (nhớ chú thích `jlpt_old` là hệ cũ).
5. **Tách `is_kanji`**: `々` cần cách xử lý rõ (loại khỏi quiz, hoặc gắn cờ).
6. **Script nạp phải có kiểm tra tự động**: đúng 512 dòng, 512 chữ duy nhất, 32 bài × 16 chữ, mọi `svg_file` tồn tại, `lesson`/`order_in_lesson` liên tục, cảnh báo (không fail) với dòng `needs_review`. Idempotent (chạy lại không nhân đôi). Ghi bằng service role.
7. **Đề xuất mới để plan đánh giá (không bắt buộc, phân loại rõ "MVP" / "sau")**:
   - Nhập danh sách ôn từ **CSV/TSV do người dùng tự tạo** (khớp điều kiện (b) của ngoại lệ, và tránh phân phối thêm nội dung có bản quyền).
   - **Lịch ôn đơn giản** (cột `due_at`, hàm thuần kiểu Leitner) thay vì chỉ bucket theo streak.
   - **Nối với Lộ trình**: khi một bài VNJP được đánh dấu xong trong tracker, gợi ý thêm 16 kanji của bài đó vào danh sách ôn. Plan phải kiểm tra tracker hiện có để xem khả thi không và chi phí.
   - Cân nhắc service worker/PWA cache cho 512 SVG (lazy cache theo từng chữ, không precache cả 2,2 MB). Plan chọn và biện minh.

## 5. Plan phải có những phần sau

1. **Tóm tắt khảo sát code**: convention thật tìm thấy (đường dẫn, mẫu), mâu thuẫn với plan cũ.
2. **Bước 0 — sửa CLAUDE.md**: câu chữ đề xuất cuối cùng + bảng đối chiếu điều kiện (a)(b)(c).
3. **Schema**: SQL/migration dự kiến cho từng bảng (cột, kiểu, khoá, index, RLS policy), lý do thiết kế chung, ánh xạ cột CSV → cột DB, xử lý `々`/`込`/`needs_review`.
4. **Nạp dữ liệu**: script, vị trí file, kiểm tra, cách chạy trên local/prod, rollback.
5. **`packages/core`**: chữ ký hàm, kiểu dữ liệu, quy tắc chuyển trạng thái, **ngưỡng mastery là hằng số có tên và đề xuất giá trị kèm lý do; nêu rõ đó là giả định**, danh sách test case dự kiến (đặt tên case, đầu vào, kỳ vọng).
6. **Frontend**: cây route, server/client component, server action, trạng thái loading/lỗi/rỗng, luồng quiz từng bước (chọn phạm vi → câu hỏi → chấm → lưu), cách hiển thị SVG thứ tự nét (`<img>` hay inline; cân nhắc bảo mật và tương tác), ghi công trong màn chi tiết, layout 360px, copy tiếng Việt cần thêm (liệt kê key).
7. **Bảo mật/RLS/quyền riêng tư**: ma trận ai đọc/ghi gì trên từng bảng, các vòng lặp lạm dụng (user ghi stat cho entry không tồn tại, list của người khác…), test RLS dự kiến.
8. **Giấy phép & ghi công**: như mục 3.4.
9. **Milestone (M1…Mn)**: mỗi milestone có phạm vi, file đụng tới, lệnh kiểm tra (`npm run check` / `check:full`), tiêu chí hoàn thành, rủi ro. Nếu muốn đổi thứ tự M1–M5 của plan cũ thì nêu lý do.
10. **Câu hỏi mở + khuyến nghị**.
11. **Rủi ro & những thứ ngoài phạm vi**.

## 6. Kiểm thử và nghiệm thu (plan phải bám)

- Mỗi milestone đụng code: `npm run check` (lint + typecheck + test:core + test web).
- Milestone đụng DB/RLS: `npm run check:full` và chạy lại `scripts/rls_test.sql` cho các bảng mới (theo CLAUDE.md).
- Số test trong `packages/core` phải **tăng**, không giảm.
- Test thủ công giao diện ở 360px + PWA/iOS cho màn chọn nhiều entry và màn quiz.
- Không tự bịa golden vectors: các test mới là bộ test mới; thống nhất kỳ vọng với user.

## 7. Ngoài phạm vi đợt này

Biểu đồ tiến bộ theo ngày (cần bảng lịch sử), từ vựng/ngữ pháp, TTS/âm thanh, chấm nét vẽ, cộng đồng, affiliate.

## 8. Câu hỏi mở cần user quyết (plan nêu khuyến nghị cho từng câu)

1. **`々`**: giữ như entry đặc biệt, loại khỏi quiz, hay thay bằng đúng chữ thứ 512 sau khi user đối chiếu sách?
2. **Nghĩa hiển thị**: `han_viet_main` + `meaning_en` là đủ cho MVP, hay cần `meaning_vi` do user nhập?
3. **22 chữ `needs_review`**: user tự duyệt `han_viet_main` trước khi nạp, hay nạp rồi sửa sau?
4. **Lộ trình**: có làm tích hợp "bài VNJP xong → gợi ý thêm kanji bài đó" trong đợt này không?
5. **Lịch ôn (`due_at`)**: đưa vào MVP hay để sau?
6. **Nhập CSV người dùng**: MVP hay sau?
7. **Câu chữ cuối cùng của CLAUDE.md #4**.

## 9. Cách báo lại

Khi xong: (1) lưu plan vào `docs/plans/review-feature.plan.md`, (2) trong chat chỉ nêu: đường dẫn file plan, các mâu thuẫn tìm thấy giữa brief/plan cũ/code thật, danh sách câu hỏi mở. **Không bắt đầu M1.**
