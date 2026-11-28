# Claude Certified Foundations Study — Tự học & Luyện thi Developer (CCDV-F) & Associate (CCAO-F)

Ứng dụng web tự học, luyện tập, thi thử (kèm tính năng chọn từng câu tạo gói đề riêng) và ôn tập ngắt quãng (Spaced Repetition) hỗ trợ chuyển đổi linh hoạt giữa **2 bộ đề chứng chỉ**:

1. **Claude Certified Developer – Foundations (`ccdv-f`, Revision 2)** — **110 câu thực tế** (102 `single_choice`, 8 `multiple_choice`), giữ nguyên tại `src/data/questions.json`, kèm bản dịch song ngữ & mẹo học vẹt tại `src/data/questions.vi.json`.
2. **Claude Certified Associate – Foundations (`ccao-f`, Revision 3)** — **169 câu thực tế** (127 `single_choice`, 42 `multiple_choice`), lưu tách biệt tại `src/data/associate/questions.json`, giao diện tiếng Việt và giữ nguyên văn tiếng Anh đề bài, lựa chọn, giải thích và ghi chú nguồn (`callout`).

---

## 1. Báo cáo Dữ liệu & Kiểm định 2 Ngân hàng Câu hỏi

### A. Bộ đề Claude Certified Associate – Foundations (`ccao-f`, Revision 3)
- **Đường dẫn dữ liệu:** `src/data/associate/questions.json` (tách riêng hoàn toàn khỏi bộ Developer).
- **Tổng số câu hỏi:** **169 câu** (`ccao-f-q001` đến `ccao-f-q169`, giữ nguyên thứ tự gốc).
  - **127 câu chọn một đáp án (`single_choice`)**: dùng `radio`, đúng 1 đáp án. Các câu về thứ tự thao tác (như `ccao-f-q105` đáp án `D: 3, 5, 1, 4, 2`) được giữ nguyên dạng `single_choice`.
  - **42 câu chọn nhiều đáp án (`multiple_choice`)**: dùng `checkbox`, gắn nhãn rõ **"Chọn nhiều đáp án"**, chấm theo phép so sánh tập hợp ID không phụ thuộc thứ tự (đủ và không thừa).
- **Bảo toàn đầy đủ nội dung & ghi chú nguồn:**
  - Render đầy đủ các loại block `paragraph` (giữ xuống dòng), `heading` (`Learn more`...), `list` và `callout` (`warning` / `info`) bằng React text an toàn (không dùng `dangerouslySetInnerHTML`, không có `[object Object]` hay `$13`).
  - Giữ nguyên các cảnh báo **Answer keys disagree** ở `ccao-f-q014`, `ccao-f-q096`, `ccao-f-q114` và ghi chú **Step numbering corrected** ở `ccao-f-q105`.
  - Hiển thị đầy đủ `optionExplanations` ở các câu nguồn có cung cấp (ví dụ `ccao-f-q169`), không tự bịa lời giải cho các câu không có.
  - Giữ `topicId` gốc (`claude-associate-foundations`) và `difficulty: "unspecified"` (**Chưa phân loại**); các nhãn học tập `derivedTags` dành riêng cho nghiệp vụ Associate (Prompting, Projects, Skills & Connectors, Code Execution, Memory, Output Verification, Data Handling, Responsible Use) — không gắn nhãn lập trình của bộ Developer.
  - Nguồn tham khảo: T-Study (`https://tstudy.vercel.app/study/ccao-f`, ngày thu thập `2026-11-28`, Revision 3) — tài liệu luyện tập tham khảo, chưa được thẩm định độc lập và không phải sản phẩm chính thức của Anthropic hay ngân hàng đề thi thật.

### B. Bộ đề Claude Certified Developer – Foundations (`ccdv-f`, Revision 2)
- **Đường dẫn dữ liệu:** `src/data/questions.json` (không bị ghi đè) + `src/data/questions.vi.json`.
- **Tổng số câu hỏi:** **110 câu** (`ccdv-f-q001` đến `ccdv-f-q110`): **102 `single_choice`** và **8 `multiple_choice`** (`q078`, `q081`, `q087`, `q092`, `q100`, `q103`, `q104`, `q106`).

---

## 2. Yêu cầu Hệ thống & Lệnh Cài đặt / Chạy / Build / Kiểm tra

- **Node.js**: `>= 20.x` (khuyến nghị Node 22 LTS)
- **npm**: `>= 10.x`

```bash
# 1. Cài đặt dependencies
npm install

# 2. Chạy máy chủ phát triển (Development Server)
npm run dev

# 3. Kiểm tra kiểu TypeScript
npm run typecheck

# 4. Chạy toàn bộ bộ test nghiệm thu (Vitest + React Testing Library)
npm run test:run

# 5. Build bản Production (ra thư mục dist/)
npm run build

# 6. Chạy kiểm tra tổng hợp (Typecheck + Tests + Build)
npm run check

# 7. Xem thử bản build production tại máy cục bộ
npm run preview
```

---

## 3. Cấu trúc Thư mục & Dữ liệu

```text
├── src/
│   ├── data/
│   │   ├── questions.json              # Ngân hàng Developer CCDV-F (110 câu, Rev 2)
│   │   ├── questions.vi.json           # Bản dịch tiếng Việt & mẹo học vẹt cho CCDV-F
│   │   ├── associate/
│   │   │   └── questions.json          # Ngân hàng Associate CCAO-F (169 câu, Rev 3)
│   │   └── questionBank.ts             # Registry đa khóa học, kiểm định schema & derivedTags riêng
│   ├── lib/
│   │   ├── scoring.ts                  # Chấm điểm tập hợp đáp án độc lập UI
│   │   ├── srs.ts                      # Lịch nhắc ôn SRS theo Asia/Ho_Chi_Minh (1, 3, 7, 14, 30 ngày)
│   │   ├── session.ts                  # Phiên Luyện tập & Thi thử (absolute deadline)
│   │   ├── stats.ts                    # Thống kê theo ID duy nhất & bộ lọc
│   │   └── storage.ts                  # Lưu trữ tách biệt theo courseId + revision + user, backup JSON
│   ├── components/
│   │   ├── BlockRenderer.tsx           # Render an toàn paragraph, heading, list, callout
│   │   ├── QuestionCard.tsx            # Thẻ câu hỏi ẩn đáp án tuyệt đối trước khi chấm/nộp
│   │   ├── CustomExamPackBuilder.tsx   # Chọn từng câu tạo & lưu gói đề thi thử riêng
│   │   ├── QuestionGridDrawer.tsx      # Lưới câu hỏi desktop & drawer mobile
│   │   └── Layout.tsx                  # Bộ chuyển 2 khóa học CCDV-F / CCAO-F, điều hướng, sáng/tối
│   ├── pages/
│   │   ├── OverviewPage.tsx            # 1. Tổng quan & chọn bộ đề chứng chỉ
│   │   ├── StudyPage.tsx               # 2. Học từng câu (tự lưu vị trí & nút Reset)
│   │   ├── PracticePage.tsx            # 3. Luyện tập (1..110 hoặc 1..169 câu)
│   │   ├── ExamPage.tsx                # 4. Thi thử nhanh & Tự chọn câu tạo gói đề
│   │   ├── ReviewPage.tsx              # 5. Ôn câu sai & Lịch nhắc ôn SRS
│   │   ├── LibraryBackupPage.tsx       # 6. Thư viện toàn văn & Sao lưu/Khôi phục JSON
│   │   └── AdminDashboardPage.tsx      # Bảng quản trị (dành cho tài khoản Admin)
│   └── __tests__/                      # Bộ test tự động (CCDV-F + CCAO-F + UI E2E)
```

---

## 4. Cách Thay đổi / Cập nhật Ngân hàng Câu hỏi

1. Giữ nguyên schema gốc gồm: `schemaVersion`, `id`, `revision`, `title`, `topics`, `contexts`, `questions`, `sources`, `conversion`, `extraction`.
2. Cập nhật file tương ứng:
   - Bộ Developer: `src/data/questions.json`
   - Bộ Associate: `src/data/associate/questions.json`
3. Chạy `npm run check` để xác minh tự động số lượng câu, mã câu, `single_choice`/`multiple_choice`, tính hợp lệ của `correctOptionIds`, và không có tham chiếu lỗi `$13` / `[object Object]`.

---

## 5. Cách Sao lưu & Giới hạn Lưu trữ Cục bộ (`localStorage`)

- **Tách biệt tiến độ theo từng khóa học:**
  - Developer (`ccdv-f`, Rev 2): lưu tách biệt dưới khóa riêng (`ccdv_f_study_progress_v1...`).
  - Associate (`ccao-f`, Rev 3): lưu dưới khóa có chứa `courseId` và `revision` (`claude_cert_progress_v1_ccao-f_r3...`).
  - Khi đồng bộ lên tài khoản MongoDB Cloud (nếu có cấu hình `.env`), mỗi bộ đề cũng được lưu riêng dưới `progressByCourse[courseId]` để không bao giờ ghi đè nhau.
- **Xuất / Nhập JSON:** Vào tab **Thư viện & Sao lưu** để xuất file JSON có `backupFormatVersion`, `exportedAt`, `courseId`, `courseRevision`. Khi nhập lại, hệ thống kiểm tra tính hợp lệ, từ chối file lỗi hoặc sai khóa học mà vẫn giữ nguyên tiến độ hiện tại, đồng thời cho phép chọn **Gộp** hoặc **Thay thế**.
- **Giới hạn `localStorage`:** Dữ liệu cục bộ gắn riêng với từng trình duyệt/thiết bị (giới hạn khoảng ~5 MB/origin), có thể bị xóa nếu dùng chế độ Ẩn danh hoặc xóa bộ nhớ duyệt web. Nên định kỳ xuất file sao lưu JSON để lưu trữ an toàn.
