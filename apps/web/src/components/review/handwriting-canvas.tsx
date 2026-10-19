'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface HandwritingCanvasHandle {
  clear: () => void;
}

const MIN_STROKE_PX = 4; // dưới ngưỡng này coi là chạm nhầm, không tính là một nét

/** Một điểm chuẩn hoá 0..1 theo khung vẽ — dùng cho scoreHandwriting (packages/core), không gửi lên server. */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/**
 * Bảng viết tay thuần Canvas 2D, dùng Pointer Events (chạy đúng chuột, bút, ngón tay trên iOS Safari/Android Chrome).
 * touch-action: none để vuốt khi viết không cuộn trang. Không gửi ảnh đi đâu — chỉ đếm số nét cho người dùng tự so.
 * guide: chữ mẫu mờ phía sau (chế độ tập viết). onStrokesChange (tuỳ chọn): trả về toạ độ từng nét đã chuẩn
 * hoá 0..1 theo khung vẽ, để nơi gọi tự chấm bằng scoreHandwriting — hoàn toàn cục bộ, không gửi đi đâu.
 */
export const HandwritingCanvas = forwardRef<
  HandwritingCanvasHandle,
  { guide?: string | null; onStrokeCountChange?: (n: number) => void; onStrokesChange?: (strokes: NormalizedPoint[][]) => void; label: string }
>(function HandwritingCanvas({ guide, onStrokeCountChange, onStrokesChange, label }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef<{ x: number; y: number; dist: number; points: NormalizedPoint[] } | null>(null);
    const [strokes, setStrokes] = useState(0);
    const strokePaths = useRef<NormalizedPoint[][]>([]);

    const setup = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(4, rect.width / 40);
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--color-ink').trim() || 'currentColor';
    }, []);

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      setStrokes(0);
      strokePaths.current = [];
      onStrokesChange?.([]);
    }, [onStrokesChange]);

    useImperativeHandle(ref, () => ({ clear }), [clear]);
    useEffect(() => onStrokeCountChange?.(strokes), [strokes, onStrokeCountChange]);

    useEffect(() => {
      setup();
      if (typeof window === 'undefined') return;
      // Xoay màn hình/đổi cỡ: canvas phải dựng lại theo kích thước mới (nét cũ mất — chấp nhận được với bảng nháp)
      const onResize = () => {
        setup();
        setStrokes(0);
      };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [setup]);

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    /** Chuẩn hoá về 0..1 theo khung vẽ hiện tại (bất biến theo kích thước màn hình thật). */
    const normalized = (e: React.PointerEvent<HTMLCanvasElement>, p: { x: number; y: number }): NormalizedPoint => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: rect.width > 0 ? p.x / rect.width : 0, y: rect.height > 0 ? p.y / rect.height : 0 };
    };

    return (
      <div className="relative mx-auto aspect-square w-full max-w-[360px] select-none rounded-xl border border-line bg-surface-raised">
        {/* Lưới ô vuông 4 phần như vở tập viết */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-line" aria-hidden="true" />
        {guide ? (
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[200px] leading-none text-ink-faint/60"
            lang="ja"
            aria-hidden="true"
          >
            {guide}
          </span>
        ) : null}
        <canvas
          ref={canvasRef}
          aria-label={label}
          role="img"
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = point(e);
            drawing.current = { ...p, dist: 0, points: [normalized(e, p)] };
            const ctx = e.currentTarget.getContext('2d');
            ctx?.beginPath();
            ctx?.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            const d = drawing.current;
            if (!d) return;
            const p = point(e);
            const ctx = e.currentTarget.getContext('2d');
            ctx?.lineTo(p.x, p.y);
            ctx?.stroke();
            d.dist += Math.hypot(p.x - d.x, p.y - d.y);
            d.x = p.x;
            d.y = p.y;
            d.points.push(normalized(e, p));
          }}
          onPointerUp={() => {
            const d = drawing.current;
            if (d && d.dist >= MIN_STROKE_PX) {
              setStrokes((n) => n + 1);
              strokePaths.current = [...strokePaths.current, d.points];
              onStrokesChange?.(strokePaths.current);
            }
            drawing.current = null;
          }}
          onPointerCancel={() => {
            drawing.current = null;
          }}
        />
      </div>
    );
  }
);
