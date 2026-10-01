'use client';

import { createBrowserClient } from '@supabase/ssr';

// Dùng trong Client Component. Chỉ dùng khóa anon công khai, không bao giờ dùng service_role ở đây.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
