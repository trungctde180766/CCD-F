# CCDV-F Study — Ứng dụng Tự học & Luyện thi Claude Certified Developer – Foundations

Ứng dụng web tự học, luyện tập, thi thử và ôn tập ngắt quãng (Spaced Repetition) dành cho bộ **110 câu hỏi thực tế Claude Certified Developer – Foundations (CCDV-F)**.

---

## 1. Báo cáo Dữ liệu & Kiểm định Ngân hàng Câu hỏi

- **Tổng số câu hỏi đã nhập:** **110 câu** (`ccdv-f-q001` đến `ccdv-f-q110`, giữ nguyên thứ tự gốc và prefix `ccdv-f-`).
- **Phân loại câu hỏi:**
  - **102 câu chọn một đáp án (`single_choice`)**: dùng `radio`, có đúng 1 đáp án đúng.
  - **8 câu chọn nhiều đáp án (`multiple_choice`)**: dùng `checkbox`, gắn nhãn rõ **"Chọn nhiều đáp án"**, chấm bằng phép so sánh tập hợp ID không phụ thuộc thứ tự (chỉ đúng khi chọn đủ và không chọn thừa):
    - `ccdv-f-q078`: **A, C**
    - `ccdv-f-q081`: **A, B**
    - `ccdv-f-q087`: **A, B, C**
    - `ccdv-f-q092`: **A, B, D**
    - `ccdv-f-q100`: **A, B, C**
    - `ccdv-f-q103`: **A, B, E**
    - `ccdv-f-q104`: **A, B, E**
    - `ccdv-f-q106`: **A, B, C**
- **Ngôn ngữ hiển thị:** Giao diện điều khiển 100% tiếng Việt; toàn bộ nội dung câu hỏi, phương án lựa chọn, giải thích tổng (`explanation`), giải thích từng lựa chọn (`optionExplanations`) và mục `Learn more` được giữ nguyên văn tiếng Anh từ nguồn.
- **Bảo toàn dữ liệu gốc:**
  - Giữ `topicId` gốc (`claude-developer-foundations`) và `difficulty: "unspecified"` (hiển thị **"Chưa phân loại"**).
  - Các nhãn phân mảng kỹ thuật được sinh bằng quy tắc từ khóa được lưu tách biệt dưới `derivedTags` và hiển thị rõ là **"Nhãn hỗ trợ học tập"**.
  - Các mục `Learn more` không có URL trong nguồn được hiển thị dạng văn bản an toàn, không tự suy đoán hay bịa URL.
  - Render đầy đủ các block `paragraph`, `heading`, `list` bằng React elements an toàn, không dùng `dangerouslySetInnerHTML`, không có lỗi `[object Object]` hay tham chiếu `$13`.

---

## 2. Yêu cầu Hệ thống & Lệnh Cài đặt / Chạy / Build / Kiểm tra

### Yêu cầu
- **Node.js**: `>= 20.x` (khuyến nghị Node 22 LTS)
- **npm**: `>= 10.x`

### Các câu lệnh chính (`package.json` scripts)

```bash
# 1. Cài đặt dependencies
npm install

# 2. Chạy máy chủ phát triển (Development Server)
npm run dev

# 3. Kiểm tra tính toàn vẹn của ngân hàng 110 câu hỏi
npm run validate

# 4. Kiểm tra kiểu TypeScript (Typecheck)
npm run typecheck

# 5. Chạy toàn bộ bộ kiểm thử tự động (Vitest + React Testing Library)
npm run test:run

# 6. Build bản Production tĩnh (ra thư mục dist/)
npm run build

# 7. Chạy kiểm tra tổng hợp (Typecheck + Unit/Integration Tests + Production Build)
npm run check

# 8. Xem thử bản build production tại máy cục bộ
npm run preview
```

---

## 3. Kiến trúc Thư mục & Cấu trúc Dữ liệu

```text
├── .github/workflows/ci-cd.yml   # GitHub Actions CI/CD tự động test, build & deploy Vercel
├── vercel.json                   # Cấu hình SPA routing & build cho Vercel
├── outputs/claude-foundations/   # Tài liệu nguồn gốc (questions.json, DOCX, hướng dẫn)
├── src/
│   ├── data/
│   │   ├── questions.json        # Ngân hàng 110 câu hỏi gốc (Revision 2)
│   │   └── questionBank.ts       # Bộ nạp dữ liệu, kiểm định schema & gắn nhãn học tập
│   ├── lib/
│   │   ├── scoring.ts            # Logic chấm điểm tập hợp đáp án độc lập UI
│   │   ├── srs.ts                # Lịch ôn ngắt quãng theo múi giờ Asia/Ho_Chi_Minh
│   │   ├── session.ts            # Quản lý phiên Luyện tập & Thi thử (absolute deadline)
│   │   ├── stats.ts              # Tính toán thống kê theo ID câu duy nhất & bộ lọc
│   │   └── storage.ts            # Lưu trữ localStorage có version, xuất/nhập backup JSON
│   ├── components/
│   │   ├── BlockRenderer.tsx     # Render an toàn các block paragraph, heading, list
│   │   ├── QuestionCard.tsx      # Thẻ câu hỏi chống lộ đáp án trong DOM trước khi chấm
│   │   ├── QuestionGridDrawer.tsx# Lưới điều hướng câu hỏi (Sidebar desktop & Drawer mobile)
│   │   └── Layout.tsx            # Khung giao diện sáng/tối, điều hướng & thông tin nguồn
│   ├── pages/
│   │   ├── OverviewPage.tsx      # 1. Tổng quan & khôi phục phiên đang dở
│   │   ├── StudyPage.tsx         # 2. Học từng câu (Tìm kiếm, lọc, xem giải, ghi chú)
│   │   ├── PracticePage.tsx      # 3. Luyện tập theo bộ lọc & số lượng tùy chọn
│   │   ├── ExamPage.tsx          # 4. Thi thử có đồng hồ deadline tuyệt đối & tự nộp
│   │   ├── ReviewPage.tsx        # 5. Ôn câu sai & Lịch nhắc ôn SRS
│   │   └── LibraryBackupPage.tsx # 6. Thư viện toàn văn 110 câu & Sao lưu/Khôi phục JSON
│   └── __tests__/                # Bộ test nghiệm thu tự động
```

---

## 4. Cách Thay đổi / Cập nhật Ngân hàng Câu hỏi

1. Chuẩn bị file `questions.json` mới tuân thủ schema gốc (`schemaVersion`, `id`, `revision`, `title`, `topics`, `contexts`, `questions`, `sources`, `conversion`, `extraction`).
2. Thay thế file tại `src/data/questions.json` (và đồng bộ với `outputs/claude-foundations/questions.json` nếu cần).
3. Chạy lệnh kiểm định:
   ```bash
   npm run validate
   ```
   Bộ kiểm định trong `src/data/questionBank.ts` sẽ kiểm tra toàn bộ ID câu hỏi, loại tương tác `single_choice` / `multiple_choice`, sự tồn tại của `correctOptionIds` trong `options`, cũng như đảm bảo `prompt` và `explanation` không rỗng.

---

## 5. Cách Sao lưu & Giới hạn Lưu trữ Cục bộ (`localStorage`) trên Trình duyệt

### Cơ chế lưu trữ
- Toàn bộ tiến độ học tập được lưu cục bộ trong `localStorage` dưới khóa `ccdv_f_study_progress_v1` kèm `schemaVersion: 1`, `courseId: "ccdv-f"`, `courseRevision: 2`.
- **Không yêu cầu đăng nhập** và **không gọi API bên ngoài** để chấm điểm hay lưu trữ.

### Giới hạn của `localStorage` trên các trình duyệt
- **Dung lượng tối đa:** Thông thường khoảng **5 MB** cho mỗi origin trên Chrome, Edge, Firefox và Safari. Bộ dữ liệu tiến độ của 110 câu hỏi (kèm hàng nghìn lượt làm bài và ghi chú) chỉ tốn khoảng `50 KB – 300 KB`, nằm rất xa ngưỡng giới hạn.
- **Chế độ Ẩn danh (Private / Incognito) hoặc Dọn dữ liệu trình duyệt:**
  - Nếu dùng cửa sổ ẩn danh, toàn bộ `localStorage` sẽ bị xóa ngay khi đóng cửa sổ.
  - Trên **Safari (iOS / macOS)** có cơ chế ITP, dữ liệu script-writable có thể bị dọn nếu người dùng không truy cập trang trong thời gian dài, hoặc khi người dùng bấm *"Clear browsing data"*.
- **Khuyến nghị sao lưu:**
  - Định kỳ vào tab **Thư viện & Sao lưu** → bấm **Xuất bản sao lưu JSON** để tải file `ccdv-f-progress-backup-YYYY-MM-DD.json` về máy tính/điện thoại.
  - Khi đổi thiết bị hoặc trình duyệt, chọn file JSON để kiểm tra hợp lệ, xem trước số bản ghi và chọn **Gộp (Merge)** hoặc **Thay thế (Replace)**.

---

## 6. Hệ thống Tài khoản Nhiều Người Học, MongoDB Atlas & Admin Dashboard

- **Cơ sở dữ liệu Cloud:** Kết nối trực tiếp tới **MongoDB Atlas (`cluster0.9wawqci.mongodb.net` / database `ccdv_f_study`)** thông qua Serverless API tại [api/index.ts](file:///c:/Users/THANH%20TRUNG/Desktop/claude/api/index.ts).
- **Không gian học tập riêng cho từng người:**
  - Người học có thể bấm **Đăng nhập / Đăng ký** ở góc trên bên phải để tạo tài khoản riêng.
  - Mỗi tài khoản có bộ tiến độ, lịch sử trả lời, lịch ôn SRS, câu đánh dấu, ghi chú cá nhân và lịch sử đề thi thử tách biệt hoàn toàn (lưu đồng thời theo khóa riêng `ccdv_f_study_progress_v1_user_<username>` dưới trình duyệt và đồng bộ tự động lên MongoDB Cloud).
- **Tài khoản Quản trị viên (Admin Dashboard):**
  - **Username:** `trung`
  - **Password:** `concatre`
  - Khi đăng nhập bằng tài khoản `trung`, thanh điều hướng sẽ xuất hiện tab riêng **Admin Dashboard** ([AdminDashboardPage.tsx](file:///c:/Users/THANH%20TRUNG/Desktop/claude/src/pages/AdminDashboardPage.tsx)) cho phép:
    1. Xem danh sách toàn bộ học viên, độ phủ 110 câu, tỷ lệ đúng lần đầu/gần nhất, điểm thi thử cao nhất và trạng thái phiên đang làm dở.
    2. Xem nhật ký **"Ai Thi Cái Gì"** toàn hệ thống và bấm vào từng bài thi để soi chi tiết từng câu học viên đã chọn phương án nào.
    3. Xem thống kê các câu hỏi khó / tỷ lệ sai cao nhất trên toàn hệ thống.
    4. Tạo thêm tài khoản học viên mới, đặt lại mật khẩu hoặc xóa tài khoản.

---

## 7. Triển khai CI/CD với GitHub Actions & Vercel

Dự án đã được cấu hình sẵn:
- `vercel.json`: cấu hình build chuẩn cho Vite SPA.
- `.github/workflows/ci-cd.yml`: tự động chạy `npm run validate`, `npm run typecheck`, `npm run test:run` và `npm run build` trên mỗi lần push hoặc Pull Request tới nhánh `main`/`master`.

### Hai cách kết nối tự động lên Vercel:
1. **Kết nối trực tiếp qua Vercel Git Integration (Khuyên dùng - không cần cấu hình token thủ công):**
   - Đăng nhập [Vercel Dashboard](https://vercel.com/new) → chọn **Import Git Repository** → chọn repo `trungctde180766/CCD-F`.
   - Vercel tự nhận diện Vite từ `vercel.json` và tự động deploy mỗi khi GitHub nhận commit mới.
2. **Deploy qua GitHub Actions Workflow CLI:**
   - Thêm 3 Repository Secrets trên GitHub (`Settings` → `Secrets and variables` → `Actions`):
     - `VERCEL_TOKEN`: tạo tại [Vercel Account Tokens](https://vercel.com/account/tokens)
     - `VERCEL_ORG_ID` và `VERCEL_PROJECT_ID`: lấy từ file `.vercel/project.json` sau khi chạy `vercel link`.

---

## 8. Miễn trừ Trách nhiệm

- Đây là ứng dụng và tài liệu luyện tập tham khảo phục vụ mục đích tự học cá nhân và nhóm học tập, **không phải** sản phẩm chính thức của Anthropic hay ngân hàng đề thi thật.
