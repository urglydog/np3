'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, ListTodo, Map, ShoppingBag, Settings, BookOpenCheck } from 'lucide-react';
import { copy } from '@/lib/copy';

const items = [
  { href: '/today', label: copy.navTodayLabel, title: copy.navTodayTitle, icon: CalendarCheck },
  { href: '/upcoming', label: copy.navUpcomingLabel, title: copy.navUpcomingTitle, icon: ListTodo },
  { href: '/roadmap', label: copy.navRoadmapLabel, title: copy.navRoadmapTitle, icon: Map },
  { href: '/buy', label: copy.navBuyLabel, title: copy.navBuyTitle, icon: ShoppingBag },
  { href: '/review', label: copy.navReviewLabel, title: copy.navReviewTitle, icon: BookOpenCheck },
  { href: '/settings', label: copy.navSettingsLabel, title: copy.navSettingsTitle, icon: Settings },
] as const;

export function BottomNav({ badgeCounts = {} }: { badgeCounts?: Partial<Record<(typeof items)[number]['href'], number>> }) {
  const pathname = usePathname();
  if (pathname === '/login' || pathname?.startsWith('/login/')) return null;
  return (
    <nav
      className="sticky bottom-0 flex justify-around border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
      aria-label={copy.navMainLabel}
    >
      {items.map(({ href, label, title, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        const count = badgeCounts[href] ?? 0;
        return (
          <Link
            key={href}
            href={href}
            title={title}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 text-[11px] leading-tight ${
              active ? 'text-accent' : 'text-ink-muted'
            }`}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              {count > 0 ? (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
