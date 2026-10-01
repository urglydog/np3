# Web Push trên iOS: sự kiện đã kiểm tra (tổng hợp từ tài liệu Apple và nhiều bài hướng dẫn)

- Apple hỗ trợ push cho web app **đã thêm vào màn hình chính** từ iOS/iPadOS 16.4.
- **Không cần tài khoản Apple Developer** để gửi push tới Safari/PWA (Apple nói rõ ở phiên WWDC22 "Meet Web Push for Safari"). Dùng giao thức Web Push chuẩn với khóa VAPID tự tạo, không cần đăng ký gì với Apple.
- `manifest.json` phải có `display: "standalone"`. `PushManager` chỉ xuất hiện trong service worker sau khi app được thêm vào màn hình chính và mở từ icon đó.
- Quyền thông báo phải được xin **từ bên trong app đã cài**, do người dùng bấm (user gesture), không xin được từ tab Safari thường.
- Cần HTTPS.
- Khi service worker nhận sự kiện `push`, **bắt buộc phải hiện thông báo** (Apple không hỗ trợ push im lặng), nếu không Safari có thể coi là lạm dụng và thu hồi đăng ký (hành vi này tôi chưa kiểm tra lại trong tài liệu WebKit hiện hành, hãy kiểm tra).
- Có báo cáo từ lập trình viên rằng đôi khi push iOS chạy ban đầu rồi ngừng bất ngờ. Coi push là kênh *cố gắng gửi*, không phải kênh đảm bảo.
- Dữ liệu của web app trên màn hình chính có bộ đếm "ngày dùng" riêng nên không bị dọn sau 7 ngày như tab Safari; tuy vậy bộ nhớ vẫn ở chế độ "cố gắng lưu", không đảm bảo vĩnh viễn. Dữ liệu quan trọng phải nằm trên server.
- Dữ liệu nhập trong tab Safari không tự chuyển sang app đã cài; hai nơi lưu riêng.

Cần kiểm tra lại với phiên bản iOS hiện hành khi triển khai, vì Apple thay đổi hành vi theo bản phát hành.
