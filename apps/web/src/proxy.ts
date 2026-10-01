import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Next.js 16 đổi tên file convention middleware.ts -> proxy.ts (xem node_modules/next/dist/docs/
// .../proxy.md). Hàm export phải tên `proxy`, không còn là `middleware`.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|api/health).*)',
  ],
};
