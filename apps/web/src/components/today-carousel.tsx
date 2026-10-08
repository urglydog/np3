'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { playClickSound } from '@/lib/click-sound';
import { copy } from '@/lib/copy';
import { SubmitButton } from '@/components/submit-button';
import { markTaskDone } from '@/app/(app)/today/actions';

export interface CarouselTask {
  id: string;
  name: string;
  milestone: string | null;
  due: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'skipped';
  isCurrent: boolean;
}

export function TodayCarousel({ tasks, startIndex }: { tasks: CarouselTask[]; startIndex: number }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'center', loop: false, startIndex });
  const [selected, setSelected] = useState(startIndex);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    playClickSound();
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="w-full">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {tasks.map((t, i) => {
            const isSelected = i === selected;
            return (
              <div key={t.id} className="min-w-0 shrink-0 grow-0 basis-[78%] px-2 sm:basis-[60%]">
                <div
                  className={`glass flex h-full flex-col gap-3 rounded-2xl p-5 shadow-xl transition-all duration-300 ${
                    isSelected ? 'scale-100 opacity-100' : 'scale-90 opacity-50'
                  }`}
                >
                  {t.milestone ? <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t.milestone}</p> : null}
                  <h2 className="text-lg font-bold text-ink">{t.name}</h2>
                  {t.due ? <p className="text-sm text-ink-muted">Hạn chót: <span className="font-medium text-ink">{t.due}</span></p> : null}

                  {t.isCurrent ? (
                    <form action={markTaskDone} className="flex flex-col gap-3 mt-1">
                      <input type="hidden" name="taskId" value={t.id} />
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1 text-xs text-ink font-medium">
                          Số lần viết
                          <input type="number" name="writingReps" min="0" placeholder="50" className="input-premium" />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-ink font-medium">
                          Phút nói
                          <input type="number" name="speakingMinutes" min="0" placeholder="15" className="input-premium" />
                        </label>
                      </div>
                      <SubmitButton className="btn-primary w-full">{copy.todayDoneButton}</SubmitButton>
                    </form>
                  ) : (
                    <Link href={`/task/${t.id}`} className="btn-premium mt-1 w-full text-sm">
                      {copy.todayCarouselViewDetail}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
