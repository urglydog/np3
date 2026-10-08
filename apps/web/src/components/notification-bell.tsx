'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { copy } from '@/lib/copy';
import type { NotificationItem } from '@/lib/notifications';

const READ_IDS_KEY = 'roadmap:notifications:readIds';
const MAX_STORED_READ_IDS = 200;

type Tab = 'all' | 'study_daily' | 'buy_book' | 'late_risk';

function formatSentAt(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function readReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(READ_IDS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(READ_IDS_KEY, JSON.stringify([...ids].slice(-MAX_STORED_READ_IDS)));
  } catch {
    // localStorage không khả dụng (vd chế độ riêng tư) — bỏ qua, chỉ ảnh hưởng tiện ích hiển thị.
  }
}

function matchesTab(item: NotificationItem, tab: Tab): boolean {
  if (tab === 'all') return true;
  if (tab === 'late_risk') return item.lateRisk;
  return item.kind === tab;
}

export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [readIds, setReadIds] = useState<Set<string>>(() => readReadIds());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function markRead(id: string) {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeReadIds(next);
      return next;
    });
  }

  const unreadTotal = items.filter((i) => !readIds.has(i.id)).length;
  const tabs: { value: Tab; label: string }[] = [
    { value: 'all', label: copy.notificationTabAll },
    { value: 'study_daily', label: copy.notificationTabStudy },
    { value: 'buy_book', label: copy.notificationTabBuy },
    { value: 'late_risk', label: copy.notificationTabLateRisk },
  ];
  const unreadByTab = (t: Tab) => items.filter((i) => matchesTab(i, t) && !readIds.has(i.id)).length;
  const visibleItems = items.filter((i) => matchesTab(i, tab));

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={copy.notificationBellLabel}
        title={copy.notificationBellLabel}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-all hover:bg-line hover:text-ink"
      >
        <Bell size={20} />
        {unreadTotal > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        ) : null}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">{copy.notificationPanelTitle}</h2>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
            {tabs.map((t) => {
              const count = unreadByTab(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    tab === t.value ? 'bg-brand/10 text-brand' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                  {count > 0 ? (
                    <span className="inline-flex min-w-[14px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {visibleItems.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">{copy.notificationEmptyState}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {visibleItems.map((item) => {
                  const isRead = readIds.has(item.id);
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.deepLink}
                        onClick={() => {
                          markRead(item.id);
                          setOpen(false);
                        }}
                        className={`flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-surface ${isRead ? 'opacity-60' : ''}`}
                      >
                        <span className="flex items-center gap-1.5">
                          {!isRead ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /> : null}
                          <span className="text-sm font-medium text-ink">{item.title}</span>
                        </span>
                        <span className="text-xs text-ink-muted">{item.body}</span>
                        <span className="mt-1 text-[11px] text-ink-faint">{formatSentAt(item.sentAt)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
