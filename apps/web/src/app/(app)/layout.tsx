import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: plan } = await supabase.from('plans').select('id').limit(1).maybeSingle();
  if (!plan) redirect('/create-plan');

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      {/* Sticky top header */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-md items-center justify-between px-4 py-3">
          <span className="text-base font-extrabold tracking-tight text-brand">Roadmap N3</span>
          <nav className="flex items-center gap-1">
            {([
              { href: '/today', icon: '☀️', label: 'Hôm nay' },
              { href: '/upcoming', icon: '📅', label: 'Sắp tới' },
              { href: '/roadmap', icon: '🗺️', label: 'Lộ trình' },
              { href: '/buy', icon: '🛒', label: 'Mua' },
              { href: '/settings', icon: '⚙️', label: 'Cài đặt' },
            ] as const).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center rounded-xl px-2 py-1.5 text-[10px] font-medium text-ink-muted transition-all hover:bg-line hover:text-ink"
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="mt-0.5 hidden sm:block">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Scrollable content — max height = viewport minus header, enables OS scrollbar on this element */}
      <div className="flex-1 overflow-y-auto" id="page-scroll-root">
        {children}
      </div>

      {/* Back to top FAB */}
      <a
        href="#"
        aria-label="Về đầu trang"
        className="fixed bottom-6 right-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-raised shadow-lg transition-all hover:bg-brand hover:text-white hover:border-brand opacity-70 hover:opacity-100"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </a>
    </div>
  );
}
