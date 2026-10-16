# Nguồn dữ liệu và giấy phép

Gói dữ liệu "Kanji 512" dùng cho tính năng Ôn luyện được tổng hợp từ các nguồn mở sau. Văn bản dưới đây là bản ghi công đề xuất hiển thị trong app (màn "Nguồn dữ liệu và giấy phép" và màn chi tiết kanji).

## Văn bản ghi công (bản đề xuất, tiếng Việt)

- **Nghĩa, âm on/kun, số nét, âm Hán Việt (một phần)**: lấy từ tệp KANJIDIC2, © Electronic Dictionary Research and Development Group (EDRDG), dùng theo giấy phép Creative Commons Attribution-ShareAlike. Xem https://www.edrdg.org/edrdg/licence.html và https://www.edrdg.org/wiki/index.php/KANJIDIC_Project. Một số âm Hán Việt đã được dự án này chỉnh sửa lại.
- **Hình thứ tự nét**: KanjiVG © 2009–2026 Ulrich Apel, giấy phép Creative Commons Attribution-ShareAlike 3.0 (https://kanjivg.tagaini.net/). Hình đã được tô màu theo nét bằng kịch bản `kanji_colorize.py` (https://github.com/cayennes/kanji-colorize).
- **Danh sách 512 chữ và thứ tự bài**: theo giáo trình *Kanji Look and Learn* (The Japan Times). Dự án không chứa hình minh hoạ, lời gợi nhớ hay nội dung giải thích của giáo trình.

## Ghi chú kỹ thuật

| Nguồn | Giấy phép | Dùng cho | Ghi chú |
|---|---|---|---|
| KANJIDIC2 (EDRDG) | CC BY-SA (trang EDRDG hiện ghi phiên bản 4.0; bản sao cũ ghi 3.0) | `meaning_en`, `onyomi`, `kunyomi`, `stroke_count`, `grade`, `jlpt_old`, `freq`, `han_viet_*` | Phải kèm liên kết tới tài liệu và giấy phép của EDRDG. Trường SKIP code (nếu dùng sau) có giấy phép riêng |
| KanjiVG (Ulrich Apel) | CC BY-SA 3.0 | `svg/*.svg` | Mỗi file SVG giữ nguyên comment bản quyền ở đầu file. Không xoá |
| kanji_colorize.py | AGPL-3.0+ (mã), SVG đầu ra giữ CC BY-SA 3.0 | Quy trình tô màu SVG | Chỉ liên quan tới cách file SVG được tạo, không nằm trong code app |
| Deck Anki cộng đồng "Kanji Look and Learn full 512 kanjis" | Không rõ tác giả/giấy phép | Chỉ dùng làm nguồn danh sách 512 chữ và thứ tự | Nội dung deck khớp KANJIDIC2 nên dữ liệu được lấy lại từ nguồn gốc |
| JLPT | — | `jlpt_old` | KANJIDIC2 dùng hệ 4 mức **cũ**, không phải N5–N1 hiện hành |

## Về Share-Alike

Các nguồn trên là CC BY-SA. Bảng dữ liệu dẫn xuất (kanji_512.csv/json và bảng `review_entries` được nạp từ đó) nên được coi là chịu CC BY-SA và phải ghi công như trên. Mức độ lan sang mã nguồn ứng dụng nên do chủ dự án tự đánh giá; đây không phải tư vấn pháp lý.

## Phần do dự án tự bổ sung

Cột `han_viet_main` được chọn lại từ danh sách của KANJIDIC2 (xem DATA_CHANGES.md), kèm vài chữ sửa tay. Phần này là công việc của dự án, cần người học tiếng Việt kiểm chứng.

## Dữ liệu VNJP (`resources_512_vnjp/`) — chỉ dùng cá nhân, local-only

- `vnjp_kanji.csv`, `vnjp_examples.csv`, `vnjp_kanji_examples.json` chứa **nghĩa tiếng Việt và ví dụ do
  tác giả tự tổng hợp trong lúc học** theo app **VNJP** (© VNJPCLUB) và giáo trình **Kanji Look and
  Learn** (© The Japan Times). Dữ liệu này dùng **cá nhân, local-only**, chưa có quyết định pháp lý về
  việc phân phối/phát hành công khai (xem mục "Về Share-Alike" ở trên và plan `docs/plans/review-feature.plan.md` §8).
- **Ảnh chụp màn hình gốc** trong `resources_512_vnjp/bai_*/16_panel/` và `16_detail_panel/` (bằng chứng
  nguồn, dùng để đối chiếu khi tổng hợp CSV/JSON) **không được phân phối dưới bất kỳ hình thức nào** —
  không commit vào git, không đưa vào app, không chia sẻ ra ngoài máy đang lưu trữ gói dữ liệu này.
  Riêng `16_panel/` là hình minh hoạ ghi nhớ của sách, tuyệt đối không dùng lại trong app dù ở giai đoạn nào.
