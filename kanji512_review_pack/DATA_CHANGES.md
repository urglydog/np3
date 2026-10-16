# Những gì đã thay đổi so với file Anki gốc

Nguồn: `Kanji_Look_and_Learn_full_512_kanjis.apkg` (512 note, 512 thẻ, 1 note type, 512 SVG).

## Kết quả kiểm tra deck gốc

- 512 chữ khác nhau, không trùng, đủ SVG, không file media thừa.
- Thứ tự thẻ khớp cấu trúc 32 bài × 16 chữ (bài 1 = số đếm, bài 2 = thứ trong tuần, bài 3 = phương hướng…). Deck **không** có tag bài, nên `lesson` được suy ra từ vị trí.
- So với KANJIDIC2 (bản jamdict-data 1.5, 2021): âm on, âm kun, nghĩa và Hán Việt **khớp 511/512 chữ** (sau khi chuẩn hoá Unicode NFC và giải mã HTML entity). Chữ còn lại là `々`, không có trong KANJIDIC2.

## Lỗi/hạn chế trong deck gốc đã xử lý

| Vấn đề | Cách xử lý |
|---|---|
| Hán Việt, nghĩa tiếng Anh và ghi chú bộ thủ nằm chung một chuỗi `meaning` phân cách bằng dấu phẩy | Tách thành `han_viet_main`, `han_viet_other`, `meaning_en`, `note` bằng dữ liệu có cấu trúc của KANJIDIC2 (không đoán bằng chữ hoa) |
| Dấu phẩy trong số/ngoặc làm vỡ cách tách (vd `10,000`) | Dùng danh sách nghĩa có cấu trúc, ghép lại bằng `; ` |
| Từ viết hoa tiếng Anh (`Inst.`, `England`, `Esq.`, `-times`) dễ bị nhầm với Hán Việt | Không còn nhầm vì tách theo cấu trúc |
| 4 dòng có HTML entity (`&#x27;`) ở 分, 的, 交, 無 | Giải mã thành ký tự thật |
| Danh sách Hán Việt của KANJIDIC2 xếp theo chữ cái, lẫn biến thể Nôm (vd 読: Đậu, Độc; 会: Cối, Hội, Hụi) | Với 149 chữ có nhiều ứng viên, chọn `han_viet_main` theo cách dùng phổ biến trong từ Hán Việt; các âm còn lại để ở `han_viet_other` |
| Tên file SVG theo ký tự (và 曜 có hậu tố `_1607392320`) | Đổi thành `<hex mã Unicode>.svg` |
| `々` trống toàn bộ | Điền nghĩa (`iteration mark`), `is_kanji=false`, số nét 3, gắn cờ cần user kiểm tra sách |

## Sai sót của KANJIDIC2 (nguồn) đã sửa tay

| Chữ | KANJIDIC2 ghi | Đã sửa thành | Lý do |
|---|---|---|---|
| 晩 | Hào, Mạn, Man | Vãn | Hán Việt chuẩn của 晩/晚 là *vãn* (vd 晩御飯) |
| 着 | Khán | Trước | 着 là dạng của 著, đọc *trước* |
| 払 | Chàng | Phất | 払 là dạng của 拂, đọc *phất* |
| 戦 | Khuyết | Chiến | 戦 là dạng của 戰, đọc *chiến* |
| 伝 | Vân | Truyền | 伝 là dạng của 傳, đọc *truyền* |
| 両 | Lạng | Lưỡng | 両 là dạng của 兩, đọc *lưỡng* (*lạng* là đơn vị cân, nghĩa khác) |
| 予 | Dư, Dữ | Dự | 予約 = *dự ước*; *dư* là nghĩa "tôi" hiếm dùng |
| 政 | Chánh | Chính | Chuẩn hiện đại; *chánh* là biến thể |
| 込 | Liêu | (trống) | Chữ quốc tự Nhật, không có Hán Việt |

Các sửa tay trên dựa trên kiến thức về Hán Việt, **chưa đối chiếu từ điển Hán Việt nào** (nguồn Unihan/Wiktionary không truy cập được từ môi trường làm việc). Cần người học tiếng Việt xác nhận.

## 22 chữ gắn cờ `needs_review`

| Chữ | Hán Việt chính | Ghi chú |
|---|---|---|
| 行 | Hành | Hành (行動) hay Hạnh (行) hay Hàng (銀行) |
| 校 | Hiệu | Hiệu (学校) hay Giáo |
| 朝 | Triều | Triều (朝/王朝) hay Triêu (朝食) |
| 晩 | Vãn | Sửa tay: KANJIDIC2 ghi Hào/Mạn/Man, Hán Việt chuẩn là Vãn |
| 予 | Dự | Dự (予約) — KANJIDIC2 chỉ có Dư/Dữ |
| 楽 | Lạc | Lạc (楽しい) hay Nhạc (音楽) |
| 画 | Hoạch | Hoạch (計画) hay Họa (画家)? KANJIDIC2 chỉ có Hoạch |
| 着 | Trước | Sửa tay: KANJIDIC2 sai hoặc thiếu |
| 使 | Sử | Sử (使う) hay Sứ (大使) |
| 度 | Độ | Độ hay Đạc |
| 正 | Chính | Chính hay Chánh (biến thể) |
| 比 | Tỉ | Tỉ (比較) — KANJIDIC2 có Bỉ/Bí/Bì/Tỉ |
| 払 | Phất | Sửa tay: KANJIDIC2 sai hoặc thiếu |
| 戦 | Chiến | Sửa tay: KANJIDIC2 sai hoặc thiếu |
| 政 | Chính | Sửa tay: KANJIDIC2 sai hoặc thiếu |
| 込 | — | Chữ quốc tự (kokuji), không có Hán Việt |
| 記 | Ký | Ký hay Kí (cách viết) |
| 両 | Lưỡng | Sửa tay: KANJIDIC2 sai hoặc thiếu |
| 将 | Tướng | Tương/Tướng đều đúng (将来=tương lai, 将軍=tướng quân) |
| 々 | — | Không có trong KANJIDIC2 và không phải kanji. Kiểm tra sách xem chữ thứ 15 của bài 28 là gì. |
| 降 | Giáng | Giáng (降る) hay Hàng (降参) |
| 伝 | Truyền | Sửa tay: KANJIDIC2 sai hoặc thiếu |

## Việc chưa làm được

- **Chưa đối chiếu danh sách bài với sách thật.** Trang Japan Times chỉ cho mẫu một phần; Quizlet không truy cập được từ môi trường làm việc. Cần user kiểm tra vài bài (đặc biệt bài 28).
- **Chưa xác minh `々` có đúng là chữ thứ 512 của sách.**
- **Chưa có nghĩa tiếng Việt** (chỉ có Hán Việt và nghĩa tiếng Anh).
- Chưa đối chiếu với bản KANJIDIC2 mới nhất của EDRDG (dùng bản 2021 trong jamdict-data).
