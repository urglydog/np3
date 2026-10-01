---
name: roadmap-budget-resources
description: "Nghiệp vụ mua sách/công cụ và ngân sách cho Roadmap Planner: ngày cần có của từng cuốn (tính từ lịch học), hạn đặt mua (trừ thời gian giao hàng và ngày đệm), trạng thái Chưa mua/Đã đặt/Đã nhận/Đã có, cảnh báo giao trễ, tổng chi theo tháng, gói cốt lõi và gói tùy chọn, phương án thay thế miễn phí, và cách đặt link affiliate ngay trong app. Dùng skill này bất cứ khi nào viết màn hình 'Cần mua', nhắc mua sách, bảng ngân sách, link mua, hoặc cân nhắc kiếm tiền bằng affiliate, kể cả khi người dùng chỉ hỏi 'sách này khi nào cần có' hoặc 'có nên gắn link Shopee'."
---

# Budget & Resources

Vấn đề cần giải: người học đặt sách muộn, sách về sau ngày học, lịch bị lệch. App tự tính *khi nào phải đặt* thay vì để người dùng lướt bảng ngân sách.

## Công thức (`scripts/budget.ts`)

- `needBy(tài nguyên)` = **Start sớm nhất** của các task chưa xong dùng tài nguyên đó (`needByDates`). Task Done/Skipped không tạo nhu cầu. Ngày này **không lưu**, tính lại mỗi khi lịch đổi; nhờ vậy Hoãn một task thì nhắc mua tự dời theo.
- `orderBy = needBy - leadTimeDays - bufferDays` (mặc định đệm 3 ngày). Đồ miễn phí chỉ cần `needBy - 1`.
- Mức khẩn (`urgency`): `overdue` (đã quá hạn đặt), `due_soon` (trong 7 ngày), `upcoming` (trong 30 ngày), `later`.
- Hành động: `order` (chưa đặt), `wait_delivery` (đã đặt, ETA kịp), `late_risk` (đã đặt nhưng ETA sau `needBy`), `get_free` (miễn phí, không đẩy thông báo).
- `monthlySpend` gom chi tiêu chưa đặt theo tháng của hạn đặt; mục quá hạn tính vào tháng hiện tại. Dùng để người dùng thấy "tháng này cần chi bao nhiêu" thay vì cú sốc tổng.

## Quy tắc nghiệp vụ

- **Gói cốt lõi và gói tùy chọn.** Tài nguyên `optional` (vd Pingo AI, 1.588.000 VNĐ) *không nhắc mua* cho đến khi người dùng chọn dùng (`opted_in`). Luôn hiện `free_alternative` cạnh mục đắt. Người học tự túc sẽ rời đi nếu thấy tổng chi lớn ngay từ đầu.
- **Trạng thái "Tôi đã có".** Nút này ẩn mục và dừng mọi nhắc cho nó.
- **Không tự điền ngày cho người dùng:** người dùng chỉ nhập trạng thái (đã đặt, ngày dự kiến giao). Mọi ngày khác đều suy ra.
- **Giá là "giá tham khảo"** kèm `price_checked_at`. Giá sách đổi theo thời điểm; đừng trình bày như báo giá. Đừng tự động cào giá từ sàn khi chưa kiểm tra điều khoản của họ.
- Thời gian giao hàng mặc định 5 ngày là giá trị khởi đầu chưa kiểm chứng; cho người dùng chỉnh theo từng món.

## Link affiliate: để app vẫn là công cụ, không thành trang quảng cáo

Link ra ngoài là hợp lý (người học phải mua ở đâu đó). Cách đặt quyết định cảm giác của người dùng:

1. **Chỉ hiện khi cần:** nút "Mua/tìm" xuất hiện khi mục vào cửa sổ `due_soon` hoặc `upcoming`, không đặt ngay trên cả bảng.
2. **Ghi rõ "link affiliate"** cạnh nút khi `is_affiliate = true`. Đây vừa là minh bạch với người dùng, vừa thường là điều kiện của chương trình tiếp thị liên kết.
3. **Luôn có lựa chọn miễn phí/rẻ hơn** khi có.
4. Đo lượt bấm theo từng tài nguyên (bảng ghi sự kiện đơn giản, không lưu thông tin nhận dạng ngoài `user_id`). Số lượt bấm link sách là tín hiệu gần với doanh thu nhất mà app có, và là dữ liệu đáng xem trước khi tính chuyện thu phí.
5. Trước khi gắn link thật, đọc điều khoản của chương trình affiliate (hoa hồng, hạn cookie, quy định hiển thị thay đổi theo thời điểm).

## Màn hình đề xuất

"Cần mua" liệt kê mục `overdue/due_soon/upcoming` xếp theo hạn đặt, kèm hạn đặt, ngày cần có, giá tham khảo, nút Đã đặt/Đã nhận/Đã có, cảnh báo `late_risk` nổi bật. "Ngân sách" hiện tổng theo tháng (từ `monthlySpend`), tổng cốt lõi, tổng tùy chọn, đã chi, còn phải chi.

## Kiểm thử

```bash
cd scripts && npx tsx run-tests.mts    # 13 phép kiểm tra
```
Test phụ thuộc `roadmap-schedule-engine/scripts/schedule.ts` (đặt cả hai trong `packages/core` thì đổi đường import tương ứng).
