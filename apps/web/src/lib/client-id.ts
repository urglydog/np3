/**
 * UUID v4 cho client_attempt_id (idempotency khi gửi lại câu trả lời). crypto.randomUUID chỉ có từ
 * Safari 15.4 và chỉ trong ngữ cảnh bảo mật (HTTPS/localhost) — mở bằng IP LAN khi dev sẽ không có, nên dự phòng
 * bằng getRandomValues (có trên mọi trình duyệt hỗ trợ PWA).
 */
export function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
