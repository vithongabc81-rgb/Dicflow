# DictaFlow — Luyện Nghe Chép Chính Tả Tiếng Anh

Ứng dụng web Full-stack (React + Vite + Tailwind + Express + SQLite) luyện nghe chép chính tả qua Video YouTube, Video/Audio tải lên và Giọng đọc AI.

## Chạy trên máy cá nhân (Local)

```bash
# Cài đặt thư viện
npm install
npm --prefix server install
npm --prefix client install

# Build giao diện & chạy server tại http://localhost:4000
npm run build
npm start
```

Hoặc chạy chế độ phát triển (auto-reload):
```bash
npm run dev
```

## Deploy lên Render.com

1. Đẩy thư mục dự án lên GitHub.
2. Đăng nhập [render.com](https://render.com) → chọn **New + → Blueprint** (hoặc **New + → Web Service**).
3. Chọn repository vừa đẩy lên → Render sẽ tự đọc `render.yaml` và `Dockerfile` để build và khởi chạy.
4. Truy cập link `https://<ten-app>.onrender.com` sau khi deploy xong.

> **Lưu ý về gói Free của Render:** Ổ đĩa gói Free sẽ reset khi server nghỉ/redeploy (12 bài học mẫu và tài khoản Demo sẽ tự động tạo lại). Nếu muốn giữ dữ liệu người dùng và file upload vĩnh viễn, hãy bật Persistent Disk (`DATA_DIR=/var/data`) trong `render.yaml`.
