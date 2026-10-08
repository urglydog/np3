// Tiếng "kịch" tổng hợp bằng Web Audio API thay vì file audio — không cần tải asset ngoài,
// không có vấn đề bản quyền. Chỉ phát sau tương tác người dùng (đúng luật autoplay trình duyệt).
let ctx: AudioContext | null = null;

export function playClickSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    ctx ??= new AudioCtx();
    if (ctx.state === 'suspended') void ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    // Thiết bị/trình duyệt không hỗ trợ Web Audio — bỏ qua, không phải lỗi nghiêm trọng.
  }
}
