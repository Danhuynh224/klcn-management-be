# Thesis Management Backend

Backend API cho hệ thống quản lý quy trình BCTT/KLTN. Dự án hỗ trợ đăng nhập theo vai trò, quản lý đợt đăng ký, lĩnh vực, chỉ tiêu giảng viên, đăng ký đề tài, tài liệu nộp, chấm điểm, hội đồng, biên bản, thông báo và dashboard.

## Tính năng chính

- Xác thực bằng JWT và phân quyền theo vai trò `STUDENT`, `LECTURER`, `HEAD_OF_DEPARTMENT`, `ADMIN`.
- Quản lý quy trình đăng ký BCTT/KLTN, trạng thái xử lý và lịch sử đổi trạng thái.
- Quản lý người dùng, giảng viên, sinh viên, lĩnh vực hướng dẫn, chỉ tiêu theo đợt.
- Upload tài liệu sinh viên/giảng viên lên Cloudinary.
- Quản lý điểm, tính điểm tổng kết, hội đồng bảo vệ và biên bản.
- Đồng bộ dữ liệu qua Google Sheets, có file mẫu ban đầu tại `data/klcn-management.xlsx`.
- Chuẩn hóa response, validation DTO, exception filter và Swagger UI.

## Công nghệ sử dụng

- Node.js
- NestJS 11
- TypeScript
- Google Sheets API (`googleapis`)
- Cloudinary
- JWT, Passport JWT
- Multer
- PDFKit
- XLSX
- Swagger/OpenAPI
- Jest, Supertest
- ESLint, Prettier

## Cấu trúc thư mục

```text
src/
  auth/              Xác thực, JWT strategy, login/me
  users/             API người dùng, giảng viên, sinh viên
  excel/             Repository thao tác Google Sheets
  registrations/     Quy trình đăng ký BCTT/KLTN
  documents/         Upload và truy xuất tài liệu
  scores/            Nhập điểm, cập nhật điểm, finalize điểm
  committees/        Hội đồng và phân công đăng ký vào hội đồng
  minutes/           Biên bản bảo vệ
  notifications/     Thông báo người dùng
  dashboards/        Dashboard theo vai trò
  terms/             Đợt đăng ký
  quotas/            Chỉ tiêu giảng viên
  fields/            Lĩnh vực hướng dẫn
  common/            Guard, decorator, filter, interceptor, enum, util
docs/
  api-reference.md   Tài liệu API dạng markdown
data/
  klcn-management.xlsx File dữ liệu mẫu để bootstrap Google Sheets
```

## Yêu cầu

- Node.js 20 trở lên được khuyến nghị.
- npm.
- Google Cloud service account có quyền truy cập Google Sheets.
- Cloudinary account nếu cần upload tài liệu.

## Cài đặt

```bash
npm install
```

Tạo file `.env` từ file mẫu:

```bash
cp .env.example .env
```

Trên Windows PowerShell có thể dùng:

```powershell
Copy-Item .env.example .env
```

## Cấu hình môi trường

Các biến môi trường chính:

```env
PORT=3000
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
JWT_SECRET=klcn-demo-secret
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CORS_ALLOW_ALL=false
CORS_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
```

Ghi chú:

- `GOOGLE_SHEET_ID` là ID của spreadsheet dùng làm nơi lưu dữ liệu.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` và `GOOGLE_PRIVATE_KEY` lấy từ Google service account.
- Cần chia sẻ spreadsheet cho email service account với quyền chỉnh sửa.
- Khi khởi động, service sẽ kiểm tra và tạo/cập nhật các sheet cần thiết. Một số sheet có thể được import dữ liệu mẫu từ `data/klcn-management.xlsx`.
- Nếu chưa cấu hình Cloudinary, các API upload tài liệu sẽ trả lỗi cấu hình.

## Chạy dự án

Chạy môi trường development:

```bash
npm run start:dev
```

Chạy bình thường:

```bash
npm run start
```

Build production:

```bash
npm run build
```

Chạy bản đã build:

```bash
npm run start:prod
```

Mặc định API chạy tại:

```text
http://localhost:3000
```

Swagger UI:

```text
http://localhost:3000/docs
```

Health check:

```text
GET /
```

## Tài khoản và xác thực

Đăng nhập:

```text
POST /auth/login
```

Body mẫu:

```json
{
  "email": "23124045@student.hcmute.edu.vn",
  "password": "123456"
}
```

Các endpoint bảo vệ yêu cầu header:

```text
Authorization: Bearer <accessToken>
```

Mật khẩu mặc định khi dữ liệu mẫu không có password là `123456`.

## API chính

- `auth`: đăng nhập, lấy thông tin người dùng hiện tại.
- `users`: danh sách người dùng, giảng viên, sinh viên.
- `terms`: quản lý đợt đăng ký.
- `quotas`: quản lý chỉ tiêu giảng viên.
- `fields`: quản lý lĩnh vực và đề tài gợi ý.
- `registrations`: đăng ký BCTT/KLTN, duyệt/từ chối, đổi giảng viên, cập nhật trạng thái.
- `documents`: upload và xem tài liệu theo đăng ký.
- `scores`: nhập điểm, cập nhật điểm, tính điểm tổng kết.
- `committees`: tạo hội đồng, cập nhật hội đồng, phân công đăng ký.
- `minutes`: tạo và cập nhật biên bản.
- `notifications`: xem và đánh dấu thông báo đã đọc.
- `dashboards`: thống kê theo sinh viên, giảng viên, trưởng bộ môn/admin.

Xem chi tiết request/response tại [docs/api-reference.md](docs/api-reference.md) hoặc Swagger UI `/docs`.

## Kiểm tra chất lượng code

Format:

```bash
npm run format
```

Lint:

```bash
npm run lint
```

Chạy unit test:

```bash
npm run test
```

Chạy e2e test:

```bash
npm run test:e2e
```

Coverage:

```bash
npm run test:cov
```

## Ghi chú triển khai

- Build output nằm trong thư mục `dist/`.
- Production nên đặt `JWT_SECRET` đủ mạnh và không dùng secret mặc định.
- Cấu hình `CORS_ORIGINS` theo domain frontend thật.
- Không commit file `.env`, credentials Google hoặc secret Cloudinary.
