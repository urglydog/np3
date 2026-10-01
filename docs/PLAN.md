# Kế hoạch triển khai Roadmap Planner

Web app (PWA) giúp một người vạch lộ trình học/mục tiêu chi tiết, theo dõi việc hằng ngày, và biết khi nào phải mua sách. Bản đầu dùng cho chính bạn với lộ trình N3 + Song ngữ IT, nhưng thiết kế để mở cho nhiều người.

Tài liệu này không cam kết thời gian. Mỗi giai đoạn có **cổng**: chưa đạt tiêu chí thì không sang giai đoạn sau.

## 1. Quyết định kiến trúc (tôi đã giả định, bạn sửa nếu khác)

| Hạng mục | Quyết định | Lý do |
|---|---|---|
| Nền tảng | PWA, thêm vào màn hình chính | Không cần App Store hay tài khoản Apple trả phí; một bản code cho điện thoại và máy tính; thông báo thật qua Web Push |
| Ngôn ngữ | TypeScript cho web và worker | Lịch ở trình duyệt và ở worker phải giống hệt nhau, nên dùng chung một gói `core`. FastAPI chỉ thêm khi cần tái dùng worker Gemini có sẵn |
| Frontend/API | Next.js (App Router) | Bạn đã quen; route API cho đăng ký push và gọi Gemini |
| Dữ liệu + đăng nhập | Supabase (Postgres + Auth + RLS) | Đã dùng; RLS cho đa người dùng từ ngày đầu |
| Nhắc việc | Worker Node riêng + bảng `reminders` (outbox) | Web không có thông báo hẹn giờ trên máy; server phải gửi đúng giờ |
| Hosting | Hetzner, Docker Compose, Caddy (HTTPS tự động) — **giai đoạn sau; hiện chỉ chạy local** | Rẻ, bạn đã có, ít phần chuyển động; phát triển trên server quá rủi ro |
| AI | Gemini, chỉ gọi từ server, chỉ "điều chỉnh template" | An toàn và rẻ; ngày tháng do mã tính |
| Phạm vi nội dung | Không chứa nội dung học, không ngân hàng đề | Giữ app là công cụ sắp xếp, không thành khóa học |

## 1a. Chế độ phát triển: local-first

Mọi thứ chạy trên máy bạn: Supabase CLI (Postgres + Auth + Studio trong Docker), `npm run dev` cho web, một tiến trình riêng cho worker. Không deploy, không kết nối Supabase cloud hay server Hetzner. Dữ liệu học thật của bạn không rời máy.

Hệ quả cần biết: **thử push trên iPhone cần HTTPS công khai** nên bị hoãn (P0b). Push trên trình duyệt desktop ở `localhost` vẫn thử được (P0a). Nếu muốn thử iPhone sớm mà chưa deploy, có thể mở đường hầm HTTPS tạm thời tới máy local, nhưng việc này phơi bản dev ra internet nên chỉ làm khi có đăng nhập và đóng ngay sau khi thử.

## 2. Các giai đoạn

**Quy mô:** S = vài buổi tối, M = một đến hai tuần làm đều, L = lâu hơn. Đây là cảm nhận tương đối, không phải ước lượng đã kiểm chứng.

### P0a. Thử nghiệm push trên desktop, local (S)
Trang tối giản + `manifest` + service worker + đăng ký push + lệnh gửi thử, chạy ở `localhost` trên Chrome/Edge.
- **Xong khi:** đăng ký, gửi thử, bấm thông báo mở đúng trang; đăng ký hết hạn (404/410) bị đánh dấu vô hiệu.

### P0b. Thử nghiệm push trên iPhone — CỔNG, hoãn đến khi có HTTPS công khai (S)
Cần địa chỉ HTTPS (đường hầm tạm hoặc server sau này). Cài vào màn hình chính iPhone thật.
- **Xong khi:** thông báo thử đến iPhone ổn định ít nhất 3 ngày liên tục; mở app từ icon thấy giao diện đầy đủ.
- **Nếu không đạt:** phương án dự phòng là app Expo trên Android, hoặc chấp nhận chỉ có nhắc trong app trên iPhone. Chưa đạt thì đừng hứa thông báo iPhone với người dùng.

### P1. Lõi nghiệp vụ và dữ liệu (S–M)
Sao chép bốn module vào `packages/core`, áp `schema.sql` lên Supabase, nạp template N3, chạy `rls_test.sql` trên project thật.
- **Xong khi:** tất cả test đạt trong CI (lịch khớp file Sheet, mua sách, nhắc việc, kiểm tra đầu ra AI); RLS đạt trên Supabase thật.

### P2. Bản dùng được cho chính bạn (M)
Đăng nhập (một người dùng là đủ), tạo plan từ template N3 (chọn dùng bản gốc 425 giờ hay kèm phần bổ sung), các màn: **Hôm nay**, **Sắp tới**, **Lộ trình**, **Cần mua**; thao tác Xong/Bỏ qua/Hoãn/Ghim/Nghỉ; xuất/nhập sao lưu; cài PWA.
- **Xong khi:** bạn dùng nó thay Google Sheet hằng ngày trên điện thoại.

### P3. Nhắc việc (S–M)
Đồng bộ `reminders` (diff), worker gửi, nhắc học + nhắc mua, giờ yên tĩnh, nút "gửi thông báo thử".
- **Xong khi:** một tuần nhận nhắc đúng giờ, đổi lịch thì nhắc đổi theo, không gửi trùng.

### P4. Dùng thật 2–4 tuần (thời gian lịch, không phải công sức)
Ghi số giờ thật so với ước tính, ghi chỗ phiền. Chốt template: nguồn biên soạn, điều chỉnh giờ, thêm bộ đề JLPT vào danh mục (hiện thiếu), điền link mua và nhãn affiliate.
- **Xong khi:** bạn mở app ít nhất 5 ngày mỗi tuần và không còn quay lại Sheet.

### P5. Mở cho người khác, quy mô nhỏ (M)
Đăng ký, trang chính sách riêng tư, giới hạn tần suất, nút góp ý trong app. Đo: số người tạo plan, tỉ lệ còn dùng sau 7 ngày, số lượt bấm link sách, số người xin lộ trình cho mục tiêu khác.
- **Xong khi:** có vài chục người tạo plan và một phần quay lại sau 1–2 tuần. **Cổng quyết định** có làm tiếp P6–P7 hay không.

### P6. Tùy biến bằng Gemini (M)
Route sinh đề xuất điều chỉnh, kiểm tra, hạn mức theo người dùng, bước kiểm tra khả thi. Xem `roadmap-ai-generation`.
- **Xong khi:** tỉ lệ đầu ra qua kiểm tra chấp nhận được, chi phí mỗi lần gọi đã đo thật.

### P7. Doanh thu và mở rộng (chỉ khi P5 có tín hiệu)
Affiliate theo ngữ cảnh ở màn "Cần mua", sau đó mới tính phí tùy biến (PayOS/VietQR), rồi mục tiêu khác ngoài N3.

### P8. Đưa lên server (khi bạn sẵn sàng)
Triển khai theo `roadmap-deploy-hetzner`: domain thật, HTTPS, sao lưu có thử khôi phục, giám sát. Chỉ làm khi bản local đã dùng ổn định và bạn chủ động quyết định.

## 3. Đường song song: biên soạn và xác thực nội dung lộ trình

Lộ trình hiện là kinh nghiệm cá nhân, chưa được kiểm chứng. Không có chương trình chuẩn chính thức để sao chép: JLPT công bố cấu trúc bài thi (N3: 140 phút; Từ vựng 30, Ngữ pháp + Đọc 70, Nghe 40) nhưng không công bố danh sách từ vựng/Kanji chính thức. Các nguồn ngoài ước tính N3 từ số 0 trong khoảng **450 đến 1.700 giờ**, nên 425 giờ ban đầu thấp hơn mọi nguồn và 566 giờ nằm ở mức thấp.

Cách làm cho lộ trình đáng tin hơn:
1. Đối chiếu từng task với **mục lục giáo trình** (Minna I/II, Soumatome, Shinkanzen); lộ trình là bản xếp lịch của các sách đó, nên nội dung đúng hay sai do sách quyết định.
2. Thêm luyện Đọc và Nghe sớm hơn (hiện chỉ có ở Phase 3) vì hai phần này chiếm phần lớn thời gian thi.
3. Nhờ một người dạy tiếng Nhật hoặc người đã đậu N3 xem qua; ghi vào `templates.source_note`.
4. Ghi rõ "ước tính của tác giả"; dùng giờ thật của người dùng để hiệu chỉnh dần.
5. Không hứa tỉ lệ đậu hay mốc thời gian.

## 4. Rủi ro và cách giảm

| Rủi ro | Cách giảm |
|---|---|
| Push iOS không ổn định | P0 là cổng; luôn có màn trong app; nút gửi thử |
| Phạm vi phình thành khóa học | Giữ ranh giới "không chứa nội dung học" |
| Chi phí Gemini | Chỉ điều chỉnh template; hạn mức; cache; ghi token |
| Nội dung lộ trình sai/lạc quan | Mục 3; nhãn "ước tính"; dữ liệu giờ thật |
| Điều khoản affiliate | Đọc điều khoản; ghi rõ link affiliate; chỉ hiện đúng ngữ cảnh |
| Dữ liệu cá nhân và pháp lý | Chính sách riêng tư; kiểm tra quy định hiện hành ở Việt Nam trước khi mở |
| Một mình vận hành | Ít phần chuyển động; sao lưu thử khôi phục; giám sát và nhịp tim worker |
| Supabase gói miễn phí tạm dừng/giới hạn | Đọc điều khoản hiện hành; nâng gói khi mở công khai |
| Dùng chung server với khóa luận | Project compose riêng; kiểm tra cổng 80/443; subdomain |
| Lịch lệch giữa trình duyệt và worker | Chung gói `core` + golden tests lấy từ Sheet |

## 5. Việc cần bạn chốt

1. Đăng nhập bằng gì (email, Google)? Một người dùng ban đầu thì đơn giản nhất.
2. Domain/subdomain nào cho app?
3. Điện thoại hằng ngày của bạn là iPhone hay Android? (quyết định mức ưu tiên của P0b)
4. Plan cá nhân của bạn dùng bản gốc 425 giờ hay kèm phần bổ sung (566 giờ)?
5. (Khi tới P8) Máy chủ Hetzner đang ở khu vực nào, và cổng 80/443 đang do dịch vụ nào giữ?
6. Tên sản phẩm và giao diện chỉ tiếng Việt trước, đúng không?

## 6. Những gì bộ skill này đã và chưa kiểm chứng

Đã chạy test thật: bộ tính lịch (đối chiếu từng ngày với công thức trong file Sheet), mua sách, tạo nhắc việc, kiểm tra đầu ra AI, schema Postgres + RLS với hai người dùng giả. Chưa kiểm chứng: Supabase thật, push trên iPhone thật, `docker compose` với app thật, gọi Gemini thật, giá và thời gian giao hàng của sách.
