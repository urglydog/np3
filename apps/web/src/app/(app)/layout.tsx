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
            {[
              {
                href: '/today',
                label: 'Hôm nay',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )
              },
              {
                href: '/upcoming',
                label: 'Sắp tới',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )
              },
              {
                href: '/roadmap',
                label: 'Lộ trình',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                )
              },
              {
                href: '/buy',
                label: 'Mua',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                )
              },
              {
                href: '/settings',
                label: 'Cài đặt',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[10px] font-medium text-ink-muted transition-all hover:bg-line/50 hover:text-ink active:scale-95"
              >
                {item.icon}
                <span className="hidden sm:block leading-none mt-0.5">{item.label}</span>
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
