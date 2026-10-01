---
name: roadmap-schedule-engine
description: "Bộ tính lịch cho Roadmap Planner: tự tính ngày Start/Due của mọi task từ ngày bắt đầu, giờ học mỗi ngày, ngày học mỗi tuần; Done/Skipped không chiếm lịch; lịch luôn bắt đầu từ hôm nay nếu ngày bắt đầu đã qua; các thao tác Hoãn, Ghim ngày, Nghỉ N ngày. Dùng skill này bất cứ khi nào viết hoặc sửa code liên quan đến lịch học, ngày dự kiến hoàn thành, 'hôm nay học gì', dời/hoãn task, hay chuyển công thức của file Sheet sang code, kể cả khi người dùng chỉ nói 'tính ngày' hoặc 'lệch ngày'. Có sẵn mã TypeScript đã kiểm thử với đáp án chuẩn từ file Sheet."
---

# Schedule Engine

Hàm thuần `computeSchedule(tasks, settings, today)` trong `scripts/schedule.ts`. Copy file này vào `packages/core` của app; đừng viết lại công thức, vì lịch ở trình duyệt, route API và worker phải giống hệt nhau.

## Mô hình

- Mỗi task có `estHours`. Người học dành `hoursPerDay` giờ trong mỗi ngày học, `daysPerWeek` ngày mỗi tuần. Ngày nghỉ được trải đều (không gắn với thứ nào), nên một ngày lịch trung bình có `hoursPerDay × daysPerWeek / 7` giờ.
- **Neo lịch:** `anchor = max(startDate, today)`. Ngày bắt đầu đã qua thì lịch của phần chưa xong chạy từ hôm nay. Lý do: người học dở dang không nên thấy toàn bộ task "trễ"; app là lịch trượt, trả lời "hôm nay làm gì".
- **Done và Skipped không chiếm lịch** (Start/Due = null, không cộng giờ). Skip là "tôi không làm task này", Done là "đã xong"; cả hai đều giải phóng lịch cho task sau.
- Với task chưa xong, `cumBefore` là tổng giờ của các task chưa xong đứng trước:
  - `start = anchor + floor(cumBefore / giờMỗiNgàyLịch) + offset`
  - `due = max(start, anchor + ceil(cumAfter / giờMỗiNgàyLịch) - 1 + offset)`
  - Dùng `round(x, 6)` trước floor/ceil để chặn sai số dấu phẩy động (ví dụ 7.0000000001 thành 8).
- Hai task nhỏ có thể cùng nằm trong một ngày (Start trùng Due của task trước): đó là đúng, không phải lỗi.

## Hoãn, Ghim, Nghỉ: đều là "ngày ghim"

Chỉ lưu một cột `pinned_start` cho mỗi task (xem `roadmap-data-model`). Cả ba thao tác quy về nó:

| Thao tác | Hàm | Hiệu ứng |
|---|---|---|
| Hoãn task N ngày | `delayTask` | ghim = Start hiện tại + N; task đó và mọi task sau dời đúng N ngày |
| Ghim ngày bắt đầu | `pinTask` | ghim muộn hơn lịch tự tính: tạo khoảng nghỉ; ghim sớm hơn: vẫn tôn trọng nhưng `conflict = true` để UI cảnh báo trùng lịch |
| Nghỉ N ngày từ ngày D | `insertBreak` | ghim task chưa xong đầu tiên có Start >= D, cộng N ngày |

Ghim nằm trong quá khứ tự hết hiệu lực (`pinClamped`), lịch quay về hôm nay. Ghim được lưu dạng **ngày tuyệt đối** chứ không phải "số ngày dời", vì lịch trượt theo hôm nay: số ngày dời tương đối sẽ trôi mãi.

Giới hạn đã biết: nghỉ rơi vào giữa một task đang chạy thì dời task *kế tiếp*, không cắt đôi task hiện tại.

## Quy tắc khi dùng

- Luôn truyền `today = todayInTimeZone(plan.timezone)`. Không gọi `new Date()` bên trong tính toán lịch.
- Ngày ở biên là chuỗi `YYYY-MM-DD`; bên trong dùng số ngày UTC. Không cộng ngày bằng `Date` cục bộ (lỗi giờ mùa hè/múi giờ).
- Tính lịch ở client để giao diện phản hồi tức thì; worker tính lại bằng cùng hàm khi tạo nhắc. Đừng lưu `start/due` vào DB.
- Task tùy chọn (`optional`) chưa được người dùng bật thì truyền `status: 'skipped'`.
- `requiredHoursPerDayFor365` cho biết cần bao nhiêu giờ mỗi ngày học để xong trong 365 ngày. Hiển thị nó cạnh ngày dự kiến hoàn thành: người nhập quá ít giờ sẽ thấy ngay lộ trình dài nhiều năm.

## Kiểm thử

```bash
cd scripts && npx tsx run-golden.mts     # 1.381 phép kiểm tra
```
`references/golden-vectors.json` có 4 kịch bản với từng ngày Start/Due, Cum của 113 task, **tính bằng công thức trong file Sheet** (LibreOffice). `run-golden.mts` so engine với đáp án đó và có thêm các ca Hoãn/Ghim/Nghỉ tính tay. Sửa công thức thì chạy lại; muốn đổi quy tắc có chủ đích thì tạo lại golden từ Sheet đã sửa, đừng sửa số bằng tay cho khớp.
