'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, ListTodo, Map, ShoppingBag, Settings } from 'lucide-react';

const items = [
  { href: '/today', label: 'Hôm nay', title: 'Màn Hôm nay', icon: CalendarCheck },
  { href: '/upcoming', label: 'Sắp tới', title: 'Màn Sắp tới', icon: ListTodo },
  { href: '/roadmap', label: 'Lộ trình', title: 'Màn Lộ trình', icon: Map },
  { href: '/buy', label: 'Cần mua', title: 'Màn Cần mua', icon: ShoppingBag },
  { href: '/settings', label: 'Cài đặt', title: 'Màn Cài đặt', icon: Settings },
] as const;

export function BottomNav({ badgeCounts = {} }: { badgeCounts?: Partial<Record<(typeof items)[number]['href'], number>> }) {
  const pathname = usePathname();
  if (pathname === '/login' || pathname?.startsWith('/login/')) return null;
  return (
    <nav
      className="sticky bottom-0 flex justify-around border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
      aria-label="Điều hướng chính"
    >
      {items.map(({ href, label, title, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        const count = badgeCounts[href] ?? 0;
        return (
          <Link
            key={href}
            href={href}
            title={title}
            className={`relative flex flex-col items-center gap-1 px-2 text-xs ${
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
