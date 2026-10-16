'use client';

import { useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { HandwritingCanvas, type HandwritingCanvasHandle } from './handwriting-canvas';
import { copy } from '@/lib/copy';

/** Bảng tập viết ở trang chi tiết: chữ mờ bật/tắt + nút xoá. Không chấm, không lưu. */
export function WritingPad({ kanji }: { kanji: string }) {
  const canvas = useRef<HandwritingCanvasHandle>(null);
  const [guide, setGuide] = useState(true);
  return (
    <div className="flex flex-col gap-2">
      <HandwritingCanvas ref={canvas} guide={guide ? kanji : null} label={copy.reviewDetailWritingPad} />
      <div className="flex items-center justify-center gap-4 text-sm">
        <label className="flex items-center gap-2 text-ink-muted">
          <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} className="h-4 w-4 accent-brand" />
          {copy.reviewDetailWritingGuide}
        </label>
        <button type="button" onClick={() => canvas.current?.clear()} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-ink">
          <Eraser className="h-4 w-4" aria-hidden="true" />
          {copy.reviewQuizClear}
        </button>
      </div>
    </div>
  );
}
