'use client';

import { useEffect, useRef, useState } from 'react';
import { Eraser, Eye, EyeOff } from 'lucide-react';
import { scoreHandwriting, type StrokePath, type StrokePoint } from '@roadmap/core';
import { copy } from '@/lib/copy';

const CANVAS_SIZE = 320; // trần 320px, co theo viewport ở 360px (min(vw-32, 320))

/**
 * Canvas luyện viết tự do (không phải quiz) — ghi lại StrokePath[] lúc vẽ bằng pointerdown/
 * pointermove/pointerup (KHÔNG mousedown, để chạy đúng trên iOS Safari/Android Chrome theo
 * CLAUDE.md mục 5). Dùng scoreHandwriting từ @roadmap/core CHỈ để hiện gợi ý % khớp — KHÔNG ghi
 * vào review_attempt_log, KHÔNG phải chấm điểm chính thức.
 */
export function ReviewDrawPractice({ referenceStrokes }: { referenceStrokes: StrokePath[] | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<StrokePath[]>([]);
  const currentStrokeRef = useRef<StrokePath>([]);
  const [drawing, setDrawing] = useState(false);
  const [showReference, setShowReference] = useState(true);
  const hasReference = Boolean(referenceStrokes && referenceStrokes.length > 0);

  function redraw() {
    const canvas = canvasRef.current;
    if (typeof window === 'undefined' || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Lưới chữ thập canh giữa
    ctx.strokeStyle = 'var(--color-line)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Nét mẫu mờ phía sau (nếu có dữ liệu stroke_points và đang bật hiện)
    if (showReference && referenceStrokes) {
      ctx.strokeStyle = 'var(--color-ink-faint)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.4;
      for (const stroke of referenceStrokes) {
        if (stroke.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x * canvas.width, stroke[0].y * canvas.height);
        for (const p of stroke.slice(1)) ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Nét người dùng đã vẽ
    ctx.strokeStyle = 'var(--color-brand)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (const p of stroke.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, showReference]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current;
    const rect = canvas!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (typeof window === 'undefined') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    currentStrokeRef.current = [pointFromEvent(e)];
    setDrawing(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    currentStrokeRef.current = [...currentStrokeRef.current, pointFromEvent(e)];
    // Vẽ trực tiếp nét đang kéo để mượt, không chờ re-render toàn bộ qua state.
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || currentStrokeRef.current.length < 2) return;
    const pts = currentStrokeRef.current;
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    ctx.strokeStyle = 'var(--color-brand)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function handlePointerUp() {
    if (!drawing) return;
    setDrawing(false);
    if (currentStrokeRef.current.length >= 2) {
      setStrokes((prev) => [...prev, currentStrokeRef.current]);
    }
    currentStrokeRef.current = [];
  }

  function handleClear() {
    setStrokes([]);
    currentStrokeRef.current = [];
  }

  // Chuẩn hoá toạ độ canvas (pixel) về 0..1 trước khi so khớp với referenceStrokes (đã chuẩn hoá sẵn).
  function normalizedStrokes(): StrokePath[] {
    return strokes.map((s) => s.map((p) => ({ x: p.x / CANVAS_SIZE, y: p.y / CANVAS_SIZE })));
  }

  const hint =
    hasReference && strokes.length > 0 ? scoreHandwriting(normalizedStrokes(), referenceStrokes as StrokePath[]) : null;

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ touchAction: 'none', width: `min(${CANVAS_SIZE}px, calc(100vw - 32px))`, aspectRatio: '1 / 1' }}
        className="rounded-xl border border-line bg-surface-raised"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="flex gap-2">
        <button type="button" onClick={handleClear} className="btn-premium flex items-center gap-1 text-sm">
          <Eraser className="h-4 w-4" />
          {copy.reviewDetailClearButton}
        </button>
        {hasReference ? (
          <button
            type="button"
            onClick={() => setShowReference((s) => !s)}
            className="btn-premium flex items-center gap-1 text-sm"
          >
            {showReference ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {copy.reviewDetailToggleReference}
          </button>
        ) : null}
      </div>
      {!hasReference ? (
        <p className="text-xs text-ink-faint">{copy.reviewDetailHandwritingNoReference}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{copy.reviewDetailHandwritingHint(Math.round(hint.score * 100))}</p>
      ) : null}
    </div>
  );
}
