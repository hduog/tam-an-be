# MathViz — Landing page trực quan hóa toán học (Three.js)

Landing page tĩnh, độc lập với hệ thống NestJS (`auth-service` / `users-service`)
trong repo này — không cần build, không phụ thuộc `package.json` gốc.

## Nội dung

- **Banner đầu**: mô hình 3D của **định lý Pythagoras** (a² + b² = c²) — tam giác
  vuông 3-4-5 với 3 hình vuông dựng trên mỗi cạnh, tự xoay và phản ứng theo
  chuột (parallax).
- **Trực quan hóa**: 4 khái niệm kinh điển dựng bằng Three.js — vòng tròn lượng
  giác, đạo hàm/gradient descent (quả bóng lăn trên mặt cong), fractal tứ diện
  Sierpinski, và hình chữ nhật vàng từ dãy Fibonacci.
- **Ứng dụng thực tế**: nối các khái niệm trên với kiến trúc, vật lý, mật mã học
  (RSA), machine learning, âm nhạc (Fourier), thiên văn học (Kepler).

## Chạy thử

Không cần cài đặt gì — mở thẳng file:

```bash
open landing-page/index.html      # macOS
xdg-open landing-page/index.html  # Linux
```

Hoặc phục vụ qua một static server đơn giản (khuyến nghị để tránh giới hạn
`file://` trên một số trình duyệt):

```bash
npx serve landing-page
# hoặc
python3 -m http.server --directory landing-page 8080
```

## Công nghệ

- HTML/CSS/JS thuần, không build step.
- [Three.js r128](https://threejs.org/) tải qua CDN (jsDelivr) trong `index.html`.
- Toàn bộ scene 3D nằm trong `app.js`; mỗi scene nhỏ chỉ render khi nằm trong
  viewport (`IntersectionObserver`) để tiết kiệm hiệu năng, và tự tắt hiệu ứng
  xoay liên tục khi trình duyệt bật `prefers-reduced-motion`.
- Có fallback (`.no-webgl`) hiển thị thông báo thay vì màn hình trắng nếu
  trình duyệt không hỗ trợ WebGL.
