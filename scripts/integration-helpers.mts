// Helper dùng chung cho mọi script kiểm thử tích hợp (cần Supabase local đang chạy, KHÔNG db reset).
// Đọc SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY từ biến môi trường do người gọi
// truyền trên dòng lệnh — không hardcode, không đọc .env*. Chỉ chạy khi URL là 127.0.0.1/localhost.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `Thiếu biến môi trường ${name}.\n` +
        `Chạy "npx supabase status" (sau khi "npm run db:start") để lấy URL/khoá, rồi chạy lại với:\n` +
        `  SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx <script>`
    );
    process.exit(1);
  }
  return v;
}

export function assertLocalUrl(url: string): void {
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    console.error(`SUPABASE_URL phải trỏ tới 127.0.0.1 hoặc localhost (local-only). Đang thấy: ${url}`);
    process.exit(1);
  }
}

export const SUPABASE_URL = requireEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');
export const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
assertLocalUrl(SUPABASE_URL);

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Đăng ký 1 user test thật qua Auth (anon key, giống hệt web app). */
export async function createTestUser(label: string): Promise<TestUser> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const email = `integration-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: 'password123' });
  if (error || !data.user) throw new Error(`Đăng ký user test thất bại: ${error?.message}`);
  return { id: data.user.id, email, client };
}

/** Tạo plan gốc (425h) cho user test qua RPC create_plan thật. */
export async function createBasePlan(client: SupabaseClient): Promise<void> {
  const { data: template } = await client.from('templates').select('slug').eq('is_published', true).limit(1).maybeSingle();
  if (!template) throw new Error('Chưa có template đã xuất bản để test');
  const { error } = await client.rpc('create_plan', {
    p_template_slug: template.slug,
    p_start_date: '2026-10-01',
    p_hours_per_day: 2,
    p_days_per_week: 6,
    p_include_optional: false,
    p_timezone: 'Asia/Ho_Chi_Minh',
  });
  if (error) throw new Error(`create_plan thất bại: ${error.message}`);
}

/** Luôn gọi trong finally: xoá user test (cascade xoá plan/plan_task_state/...), in tên trước khi xoá. */
export async function deleteTestUser(user: TestUser): Promise<void> {
  console.log(`Đang xoá user test: ${user.email} (${user.id})`);
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`CẢNH BÁO: xoá user test thất bại, tự xoá tay user ${user.email} (${user.id}): ${error.message}`);
    process.exitCode = 1;
  }
}

export function makeChecker() {
  let fails = 0;
  let checks = 0;
  const eq = (label: string, got: unknown, want: unknown) => {
    checks++;
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      fails++;
      console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
  };
  const report = () => {
    console.log(`${checks - fails}/${checks} kiểm tra đạt`);
    if (fails > 0) process.exitCode = 1;
  };
  return { eq, report };
}
