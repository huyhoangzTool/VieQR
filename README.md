# VieQR

Website tạo QR nhiều hình dạng + màu sắc, giao diện Light/Dark, upload file và thống kê toàn website.

## Có sẵn

- QR matrix tạo trực tiếp trên trình duyệt.
- Shape: Square, Rounded, Circle, Diamond, Heart, Star, Hex, Plus.
- Chọn màu bằng bảng màu hoặc nhập Hex.
- Popup "Mã màu Hex & Cách lấy".
- Upload file → Netlify Function → Netlify Blobs → trả về URL để đưa vào QR.
- Tải QR PNG / SVG.
- Light / Dark mode.
- Thống kê: visitor duy nhất theo browser profile, số QR tạo, số lần đổi mode.
- Responsive cho điện thoại.

## Deploy Netlify

1. Upload toàn bộ thư mục lên GitHub.
2. Import repository vào Netlify.
3. Build command để trống.
4. Publish directory: `.`
5. Netlify sẽ tự nhận `netlify.toml`.
6. Deploy.

### Lưu ý upload

Endpoint upload trong bản này giới hạn 5 MB để tránh lạm dụng Function. Nếu cần file lớn hơn, nên chuyển riêng phần upload sang một object-storage/CDN có signed upload.

### Icons

Giao diện nạp Morphicons từ CDN và dùng SVG stroke cho các action icon. Morphicons là thư viện morphing icon stroke-based; thư viện hỗ trợ SVG path và các icon set như Lucide/Tabler/Heroicons/Iconoir.
