import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: plan } = await supabase.from('plans').select('id').limit(1).maybeSingle();
  if (!plan) redirect('/create-plan');

  return (
    <div className="min-h-screen flex flex-col bg-surface text-ink">
      {/* Sticky top header — chỉ hiển thị thương hiệu, điều hướng chính nằm ở BottomNav (tránh trùng 2 bộ nav) */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-md items-center px-4 py-3">
          <Link href="/today" className="text-base font-extrabold tracking-tight text-brand">
            Roadmap N3
          </Link>
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
        className="fixed bottom-20 right-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-raised shadow-lg transition-all hover:bg-brand hover:text-white hover:border-brand opacity-70 hover:opacity-100"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </a>
    </div>
  );
}
