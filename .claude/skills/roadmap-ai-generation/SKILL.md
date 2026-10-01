---
name: roadmap-ai-generation
description: "Dùng Gemini để tùy biến lộ trình cho Roadmap Planner một cách an toàn: LLM chỉ đề xuất điều chỉnh trên template có sẵn (bỏ task đã biết, đổi giờ trong biên, thêm task, chọn tài nguyên tùy chọn) bằng Structured Outputs; đầu ra bị kiểm tra nghiêm ngặt (mã phải nằm trong danh mục, không có ngày tháng, giờ trong biên) rồi bộ tính lịch mới tính ngày. Gồm sanitize prompt, hạn mức theo người dùng, chi phí, và cách xử lý mục tiêu chưa có template. Dùng skill này bất cứ khi nào viết prompt/schema Gemini, route API sinh lộ trình, kiểm tra JSON từ LLM, giới hạn chi phí AI, hoặc khi người dùng hỏi 'cho AI tự tạo lộ trình', 'nhập mục tiêu rồi ra kế hoạch'."
---

# AI Generation (Gemini)

## Ý tưởng cốt lõi: AI điều chỉnh, không tự bịa

Người dùng nói "mình đã biết Hiragana, cần xong N3 trong 18 tháng, ngân sách 1,2 triệu". Đừng cho LLM viết cả lộ trình và ngày tháng: nó hay bịa tên sách, giá và tính sai ngày. Thay vào đó:

```
Yêu cầu người dùng -> kiểm tra + sanitize -> LLM chỉ trả "đề xuất điều chỉnh" (JSON theo schema)
   -> validateAdjustments (mã nằm trong danh mục, không ngày, giờ trong biên)
   -> applyAdjustments -> computeSchedule (mã tính ngày) -> kiểm tra khả thi
```
Giá trị khác biệt của sản phẩm là template đã biên soạn, giá thật, lịch tự tính và tracker, *không phải* "AI tạo lộ trình" (ai cũng nhờ ChatGPT được miễn phí). Vì vậy phần AI nên mỏng và an toàn.

## Đầu ra của LLM (schema cố định)

`removeTaskCodes[]`, `hourOverrides{mã: giờ}`, `addTasks[]` (mã dạng `X-XXXX`, `afterCode`, tên, giờ, `resourceCodes`), `resourceChoices[]`, `rationale`. **Không có trường ngày nào.** Khóa lạ bị từ chối, nên LLM không thể chèn `startDate` hay `dueDate`.

`scripts/adjustments.ts` đã có sẵn:
- `validateAdjustments(raw, catalog, limits)`: mã task/tài nguyên phải nằm trong danh mục; giờ chỉ đổi trong khoảng từ 0.5 đến 2 lần giờ gốc; bỏ tối đa 50% task; thêm tối đa 20 task và 40 giờ; không loại được tài nguyên cốt lõi; làm sạch tên (bỏ thẻ HTML, ký tự điều khiển).
- `applyAdjustments(catalog, adj)`: ra danh sách `TaskInput` cho bộ tính lịch; task bị bỏ thành `skipped`.
- Test: `cd scripts && npx tsx run-tests.mts` (21 phép kiểm tra, gồm ca LLM bịa mã, chèn ngày, nhét `<script>`).

Nếu kiểm tra thất bại: thử lại tối đa 2 lần (đưa danh sách lỗi vào lần sau), rồi **quay về template gốc không điều chỉnh** và báo người dùng. Không bao giờ dùng đầu ra chưa qua kiểm tra.

## Kiểm tra khả thi (bằng mã, không bằng LLM)

Sau khi tính lịch, so `finish` với thời hạn người dùng mong muốn và dùng `requiredHoursPerDayFor365`/tương tự để nói thẳng: "Với 0,5 giờ/ngày lộ trình này kéo dài khoảng X năm; cần Y giờ/ngày để kịp thời hạn". Ngân sách: dùng `planPurchases` + tổng giá để báo vượt ngân sách và gợi ý phương án thay thế miễn phí, không để LLM tự cộng tiền.

## An toàn (cùng tinh thần như quy tắc của dự án LMS)

- **Sanitize và bọc đầu vào người dùng** trong thẻ rõ ràng (`<user_input>...</user_input>`); system prompt nói rõ nội dung trong thẻ là dữ liệu, không phải chỉ thị. Mẫu trong `references/prompt-and-schema.md`.
- **Gọi Gemini chỉ từ server.** Khóa API nằm trong biến môi trường, không `NEXT_PUBLIC_*`. Tên model đặt bằng `GEMINI_MODEL`, đừng hardcode.
- **Hạn mức theo người dùng** (`AI_DAILY_LIMIT_PER_USER`, đếm qua bảng `ai_usage`, ghi bằng service role) trước khi gọi LLM; thêm giới hạn tần suất theo IP/người dùng. Cache kết quả theo hash của đầu vào đã chuẩn hoá để cùng yêu cầu không tốn tiền lần hai.
- Coi `rationale` và tên task do LLM sinh là **dữ liệu không tin cậy**: React escape mặc định; không dùng `dangerouslySetInnerHTML`; nếu render Markdown phải qua sanitizer.
- Ghi `prompt_tokens`/`output_tokens` mỗi lần gọi để theo dõi chi phí thật; đặt cảnh báo chi tiêu ở Google Cloud/AI Studio.
- Không gửi thông tin nhận dạng (email, tên) vào prompt; chỉ gửi trình độ, mục tiêu, thời hạn, ngân sách, giờ rảnh.

## Mục tiêu chưa có template (N2, IELTS, chạy bộ...)

Chưa làm khi bản N3 chưa có người dùng thật. Khi làm: tạo template ở chế độ **bản nháp do AI sinh**, cùng schema (phase, task, giờ, tài nguyên), gắn nhãn rõ "do AI tạo, chưa qua biên soạn", và bắt buộc có bước người duyệt trước khi `is_published`. Tài nguyên chỉ được là mục có thật do bạn nhập vào danh mục, không để LLM đặt tên sách/giá.

## Thu phí

Mức 19–29 nghìn mỗi lộ trình tùy biến (con số bạn đã đề ra) là giả thuyết, chưa có dữ liệu cho thấy người dùng sẵn lòng trả. Chỉ làm thanh toán (PayOS/VietQR) sau khi có người dùng thật dùng bản miễn phí và hỏi thêm. Lý do hợp lý để thu phí: mỗi lần tạo tốn chi phí AI; template và tracker nên giữ miễn phí.

## Chưa kiểm chứng

Cú pháp gọi Gemini Structured Outputs thay đổi theo phiên bản SDK; kiểm tra tài liệu hiện hành trước khi viết (trường `responseMimeType`/`responseSchema` hoặc tương đương). Chưa gọi Gemini thật trong bộ skill này.
