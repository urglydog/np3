'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { copy } from '@/lib/copy';
import type { NotificationItem } from '@/lib/notifications';

const LAST_SEEN_KEY = 'roadmap:notifications:lastSeenAt';

function formatSentAt(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function readHasUnread(items: NotificationItem[]): boolean {
  if (items.length === 0 || typeof window === 'undefined') return false;
  try {
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    return !lastSeen || new Date(items[0].sentAt) > new Date(lastSeen);
  } catch {
    // localStorage không khả dụng (vd chế độ riêng tư) → không hiện chấm đỏ.
    return false;
  }
}

export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(() => readHasUnread(items));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && items.length > 0) {
      try {
        localStorage.setItem(LAST_SEEN_KEY, items[0].sentAt);
      } catch {
        // bỏ qua
      }
      setHasUnread(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={copy.notificationBellLabel}
        title={copy.notificationBellLabel}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-all hover:bg-line hover:text-ink"
      >
        <Bell size={20} />
        {hasUnread && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-surface" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">{copy.notificationPanelTitle}</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">{copy.notificationEmptyState}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.deepLink}
                      onClick={() => setOpen(false)}
                      className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-surface"
                    >
                      <span className="text-sm font-medium text-ink">{item.title}</span>
                      <span className="text-xs text-ink-muted">{item.body}</span>
                      <span className="mt-1 text-[11px] text-ink-faint">{formatSentAt(item.sentAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
