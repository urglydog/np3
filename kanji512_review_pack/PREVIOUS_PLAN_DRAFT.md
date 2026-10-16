> ⚠️ **LỖI THỜI trên điểm canvas/viết tay (2026-10-16).** Bản nháp này chốt "không chấm điểm nét vẽ,
> không canvas, chiều viết là lật thẻ tự đánh giá thuần" (xem mục "Các quyết định đã chốt với user"
> dưới đây). Plan chính thức hiện tại — `docs/plans/review-feature.plan.md` (FINAL v1) — đi NGƯỢC
> lại điểm này: có canvas viết tay thật (K2), 4 loại câu hỏi K1/E1/K2/E2, dữ liệu ví dụ VNJP, so
> khớp Hán Việt khoan dung vị trí dấu thanh. Đừng lấy phần canvas/viết tay của file này làm căn cứ.
> Các phần còn lại (schema sơ bộ, milestone M1-M5, vị trí route) chỉ còn giá trị tham khảo lịch sử —
> plan chính thức đã viết lại chi tiết hơn và có thể khác. File này giữ nguyên, không xoá, không sửa
> nội dung gốc bên dưới.

Tính năng "Ôn luyện" (flashcard ghi nhớ) — bắt đầu với Kanji Look and Learn 512
Context
Mục tiêu dài hạn là nâng tầm dự án cho CV, nhưng theo quyết định của user, việc này ưu tiên tính năng trước, affiliate để sau. Nhu cầu thật: user đang tự học theo app VNJP (32 bài × 16 kanji = 512 kanji, theo sách Kanji Look and Learn 512), nhưng VNJP không có chế độ ôn luyện. Các app ôn luyện kiểu "Kana app" (ảnh minh hoạ) có UX rất tốt (list tuỳ chọn, quiz sinh câu hỏi theo scope, thống kê % thành thạo per ký tự, xem thứ tự nét) nhưng thu phí. User muốn tự làm tính năng này ngay trong app của mình.

Xung đột đã xử lý: CLAUDE.md bất biến #4 cấm "flashcard" tuyệt đối. User đã quyết định (qua AskUserQuestion): sửa luật, thêm ngoại lệ có điều kiện — không phải nới lỏng vô hạn. Việc sửa CLAUDE.md là bước đầu tiên của task này, viết tường minh để không bị diễn giải lan sang hướng "app nội dung học" nói chung.

Các quyết định đã chốt với user:

Dữ liệu 512 kanji: user tự chuẩn bị file (CSV/JSON), tôi viết script nạp.
Chế độ viết tay: chỉ hiển thị thứ tự nét để tự xem, KHÔNG chấm điểm nét vẽ → bỏ hẳn canvas nhận diện nét trong MVP, giảm độ phức tạp rất nhiều.
Schema: thiết kế chung (entry/list/review-stat không gắn cứng vào "kanji"), chỉ nạp dữ liệu Kanji trước, dễ mở rộng từ vựng/ngữ pháp sau.
Vì hệ quả của quyết định "không chấm điểm nét vẽ", chiều "viết" của flashcard (nghĩa/âm → nhớ cách viết) sẽ là self-assessment kiểu lật thẻ (xem đáp án + thứ tự nét, tự bấm "Nhớ"/"Chưa nhớ") thay vì canvas vẽ có chấm điểm — không cần xây công nghệ nhận diện nét tay.

1. Sửa CLAUDE.md (bất biến #4)
Thay nguyên văn mục 3.4 bằng:

App không chứa nội dung học soạn sẵn kiểu giáo trình (không bài giảng dạng video/text, ngân hàng đề thi, chấm bài tự luận, cộng đồng/thảo luận). Ngoại lệ có điều kiện: công cụ ôn luyện ghi nhớ (flashcard) cho các đơn vị kiến thức rời (kanji, từ vựng...) được phép, với điều kiện: (a) dữ liệu gốc (chữ/nghĩa/âm đọc) chỉ là tham chiếu khách quan, không phải bài giảng diễn giải; (b) danh sách ôn luyện do chính người dùng tự chọn/tạo, không có "ngân hàng đề" soạn sẵn theo giáo trình bán cho người khác; (c) không chấm điểm bài tự luận/nét vẽ, không có cộng đồng/thảo luận/bình luận. Dữ liệu nguồn mở (vd thứ tự nét KanjiVG) phải ghi rõ giấy phép và nguồn trong app.
Trình bày đoạn này cho user duyệt lại câu chữ trước khi ghi đè (vẫn trong phạm vi đã được đồng ý "sửa luật", nhưng câu chữ cụ thể nên để user xác nhận lần cuối vì đây là file luật của toàn dự án).

2. Schema DB (supabase/migrations/, migration mới)
Theo đúng convention đã khảo sát (supabase/migrations/20261001030245_init.sql): tách bảng dùng chung (giống template_*) và bảng cá nhân có RLS (giống plan_task_state).

review_entries (dùng chung, đọc-only với user, ghi qua seed script/service role): id uuid pk, kind text ('kanji', mở rộng sau), term text (ký tự), meaning text, reading_on text[], reading_kun text[], lesson_no int, sort_in_lesson int, source text ('kanji-look-and-learn-512'), unicode_codepoint text (suy ra tự động từ term lúc seed, dùng để map file KanjiVG). RLS: select to authenticated using (true).
review_lists (cá nhân): id uuid pk, user_id, kind text, name text, created_at. RLS owner-only, pattern giống plans.
review_list_entries (nối N-N): composite PK (list_id, entry_id), sort int. RLS qua join review_lists.user_id = (select auth.uid()), giống pattern plan_task_state.
review_entry_stats (mastery cá nhân theo entry, không theo list vì 1 entry có thể ở nhiều list): composite PK (user_id, entry_id), correct_count int, wrong_count int, streak int, mastery_level text, last_reviewed_at timestamptz. RLS owner-only.
Cập nhật scripts/rls_test.sql: thêm khối test cho 4 bảng trên theo đúng mẫu hiện có (A/B/anon), bắt buộc theo CLAUDE.md mục 6.

3. packages/core/src/review.ts (hàm thuần, có test)
Theo convention adjustments.ts (Result pattern, comment đầu file tiếng Việt):

calculateMastery(correctCount, wrongCount, streak): MasteryLevel — bucket theo streak (bad / to_confirm / good / mastered), ngưỡng là hằng số đặt đầu file, dễ chỉnh.
applyAnswer(stat, isCorrect): ReviewEntryStat — chuyển trạng thái thuần: đúng → streak+1, correct_count+1; sai → streak=0, wrong_count+1; rồi gọi calculateMastery. Không đọc đồng hồ — nếu cần last_reviewed_at thì nhận timestamp từ tham số.
pickQuizEntries(candidates, strategy, limit) — strategy giống "Smart quiz" của app tham khảo: least_mastered_score / least_mastered_streak / least_reviewed / new_first; với customized thì FE tự lọc theo list trước khi gọi hàm này.
buildQuizQuestions(entries, questionTypes, maxQuestions) — sinh danh sách câu hỏi (loại recognition_to_reading chấm bằng so khớp text, loại recall_to_writing là thẻ lật tự chấm), cap số câu theo entries.length × questionTypes.length, giống logic "tăng số kí tự → tăng số câu nhưng có trần" ở ảnh Quiz settings.
Thêm file test packages/core/tests/review.test.mts theo tsx-runner convention hiện có, đăng ký vào packages/core/package.json script test. Đây là bộ test mới (không phải golden vectors từ Sheet) — thống nhất case kỳ vọng với user khi code xong, không tự bịa ngưỡng mastery mà không nói rõ.

4. FE — route mới apps/web/src/app/(app)/review/
Theo convention server component + actions.ts + component con ở apps/web/src/components/, dùng token màu có sẵn (--color-*), icon lucide-react, chuỗi hiển thị gom vào copy.ts (nhóm mới // Ôn luyện), lỗi qua AppError/toUserMessage.

review/page.tsx — tổng quan: % thành thạo theo kind, lối vào "Danh sách của tôi" / "Duyệt kanji" / "Luyện tập".
review/browse/page.tsx — bảng 512 kanji (lưới), bấm vào xem chi tiết: nghĩa, âm on/kun, thống kê cá nhân, thứ tự nét (SVG KanjiVG render tĩnh hoặc animate bằng CSS stroke-dasharray, không cần canvas/thư viện mới). Có chế độ chọn nhiều → thêm vào list.
review/lists/page.tsx + actions — CRUD list cá nhân, thêm/bớt entry.
review/quiz/page.tsx — chọn scope (list cụ thể / smart theo strategy), loại câu hỏi, số câu (UI cap theo công thức ở review.ts) → bắt đầu.
review/quiz/[sessionId] hoặc client component QuizRunner ('use client') — chạy từng câu, gọi server action chấm + cập nhật review_entry_stats khi làm xong (dùng applyAnswer từ packages/core).
Nguồn thứ tự nét: dùng KanjiVG (CC BY-SA 3.0, SVG theo mã Unicode, có sẵn thứ tự nét) — chỉ tải về đúng ~512 file SVG cần dùng (không vendor toàn bộ bộ dữ liệu), đặt ở apps/web/public/kanjivg/, kèm file LICENSE/ghi chú nguồn, và hiển thị credit trong màn chi tiết kanji. Không cần thêm dependency npm nào (SVG tĩnh + CSS).

5. Dữ liệu 512 kanji — việc của user trước khi tôi code M1
User chuẩn bị file CSV/JSON gồm các cột: lesson (1-32), order_in_lesson (1-16), kanji (ký tự), meaning, onyomi (phân cách bằng | nếu nhiều âm), kunyomi (tương tự). Không cần cột unicode — tôi suy ra tự động từ ký tự lúc chạy script nạp. Câu hỏi mở cần user quyết khi chuẩn bị file: nghĩa ghi bằng tiếng Anh (theo sách gốc) hay dịch tiếng Việt? (CLAUDE.md yêu cầu chuỗi hiển thị người dùng là tiếng Việt, nhưng nghĩa Hán tự trong sách gốc là tiếng Anh — cần user chọn, không tự quyết).

6. Thứ tự triển khai (milestone, mỗi milestone báo cáo riêng theo mục 1a)
M1: Sửa CLAUDE.md + migration schema + RLS + cập nhật scripts/rls_test.sql + script nạp dữ liệu (chờ file từ user).
M2: packages/core/src/review.ts + test.
M3: FE duyệt kanji + xem chi tiết/thứ tự nét + quản lý list cá nhân.
M4: FE luồng quiz (chọn scope → làm bài → chấm → lưu stat).
M5: Trang tổng quan "Ôn luyện" + gắn vào navigation chính của app.
Việc không làm trong đợt này (ghi nhận để khỏi quên, không tự làm thêm): biểu đồ "mastery evolution theo ngày" (cần bảng lịch sử riêng), mở rộng sang từ vựng/ngữ pháp, âm thanh phát âm (TTS).

Kiểm thử
npm run check sau mỗi milestone đụng code (lint + typecheck + test:core + test apps/web).
M1 đụng DB/RLS thật → bắt buộc npm run check:full theo CLAUDE.md mục 8a (cần Supabase local chạy), và chạy lại scripts/rls_test.sql xác nhận RLS OK cho 4 bảng mới.
M2: npm run test:core phải pass, số lượng test tăng thêm so với mốc hiện tại (không giảm các mục cũ).
M3/M4: test thủ công trên trình duyệt ở 360px + kiểm tra PWA/iOS theo mục 5 CLAUDE.md (không dùng hover, safe-area, v.v.) vì đây là màn hình tương tác nhiều (chọn entry, chạy quiz).