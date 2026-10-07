import { cache } from 'react';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Dùng trong Server Component/Route Handler. Lấy user từ session cookie, không tin user_id từ body.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options ?? {}));
          } catch {
            // set() được gọi từ Server Component: bỏ qua, middleware sẽ làm mới session.
          }
        },
      },
    }
  );
}

// getUser() xác thực lại với Supabase Auth server (round-trip mạng) mỗi lần gọi.
// cache() của React gộp mọi lần gọi trong cùng 1 request thành 1 round-trip duy nhất.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
