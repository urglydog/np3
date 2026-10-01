// Kiểm thử tích hợp thật: cần Supabase local đang chạy (`npm run db:start`).
// Tạo 1 user test thật qua Auth, tạo plan qua RPC, rồi xác nhận dữ liệu /today và /roadmap
// khớp nhau (cùng task hiện tại, cùng ngày dự kiến hoàn thành) — xuyên suốt RLS thật, không mock.
// KHÔNG `db reset`: chỉ xoá đúng user test vừa tạo (cascade xoá plan/plan_task_state/... theo FK).
//
// Chạy: SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/test-integration.mts
// Lấy 3 giá trị trên bằng: npx supabase status
//
// Lưu ý: cần thêm SUPABASE_ANON_KEY (khác yêu cầu ban đầu chỉ URL + service_role) vì đăng ký
// user mới (`auth.signUp`) bắt buộc phải có apikey hợp lệ trên request — GoTrue từ chối thẳng
// nếu thiếu, bất kể dùng service_role hay không. Đây là khóa CÔNG KHAI theo thiết kế của Supabase
// (được phép lộ ra trình duyệt), không phải bí mật như service_role, nhưng vẫn đọc từ env theo
// đúng tinh thần "không hardcode" bạn yêu cầu.
import { createClient } from '@supabase/supabase-js';
import { computeSchedule, toTaskInputs, todayInTimeZone, currentTaskId, groupTasksByPhase } from '@roadmap/core';
import { buildRoadmapRows, type RoadmapRow } from '../apps/web/src/lib/roadmap.ts';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `Thiếu biến môi trường ${name}.\n` +
        `Chạy "npx supabase status" (sau khi "npm run db:start") để lấy URL/khoá, rồi chạy lại:\n` +
        `  SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/test-integration.mts`
    );
    process.exit(1);
  }
  return v;
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const host = new URL(SUPABASE_URL).hostname;
if (host !== '127.0.0.1' && host !== 'localhost') {
  console.error(`SUPABASE_URL phải trỏ tới 127.0.0.1 hoặc localhost (local-only). Đang thấy: ${SUPABASE_URL}`);
  process.exit(1);
}

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const email = `integration-test-${Date.now()}@example.com`;
let userId: string | null = null;

try {
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password: 'password123' });
  if (signUpError || !signUpData.user) throw new Error(`Đăng ký thất bại: ${signUpError?.message}`);
  userId = signUpData.user.id;

  const { data: template } = await supabase.from('templates').select('id, slug').eq('is_published', true).limit(1).maybeSingle();
  if (!template) throw new Error('Chưa có template đã xuất bản để test');

  const { error: rpcError } = await supabase.rpc('create_plan', {
    p_template_slug: template.slug,
    p_start_date: '2026-10-01',
    p_hours_per_day: 2,
    p_days_per_week: 6,
    p_include_optional: false,
    p_timezone: 'Asia/Ho_Chi_Minh',
  });
  if (rpcError) throw new Error(`create_plan thất bại: ${rpcError.message}`);

  const { data: plan } = await supabase
    .from('plans')
    .select('id, template_id, start_date, hours_per_day, days_per_week, timezone')
    .limit(1)
    .maybeSingle();
  if (!plan) throw new Error('Không đọc lại được plan vừa tạo');

  // Gọi lại y hệt 2 lần, độc lập, như /today và /roadmap mỗi trang tự fetch riêng khi người dùng
  // mở 2 trang đó — để phép so sánh dưới đây không chỉ là so sánh một biến với chính nó.
  async function loadScheduleLikeAPage() {
    const { data: templateTasks } = await supabase
      .from('template_tasks')
      .select('id, code, name, sort, est_hours, optional, template_phases(code)')
      .eq('template_id', plan!.template_id)
      .order('sort');
    const { data: planTaskStates } = await supabase.from('plan_task_state').select('task_id, status, pinned_start').eq('plan_id', plan!.id);
    if (!templateTasks || !planTaskStates) throw new Error('Đọc dữ liệu template/plan_task_state thất bại');

    const inputs = toTaskInputs(
      templateTasks.map((t) => ({ id: t.id, estHours: Number(t.est_hours), optional: t.optional, sort: t.sort })),
      planTaskStates.map((s) => ({ taskId: s.task_id, status: s.status, pinnedStart: s.pinned_start }))
    );
    const today = todayInTimeZone(plan!.timezone);
    const schedule = computeSchedule(
      inputs,
      { startDate: plan!.start_date, hoursPerDay: Number(plan!.hours_per_day), daysPerWeek: plan!.days_per_week },
      today
    );
    const outlineTasks = templateTasks.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      sort: t.sort,
      estHours: Number(t.est_hours),
      optional: t.optional,
      phaseCode: (t.template_phases as unknown as { code: string } | null)?.code ?? '',
    }));
    return { schedule, outlineTasks };
  }

  const { data: templatePhases } = await supabase
    .from('template_phases')
    .select('code, title, sort')
    .eq('template_id', plan.template_id)
    .order('sort');
  if (!templatePhases) throw new Error('Đọc template_phases thất bại');

  // ---- "today-style": đúng cách apps/web/src/lib/plan.ts tính (lặp lại vì lib đó dùng next/headers,
  // không gọi trực tiếp từ script ngoài Next được) ----
  const todayLoad = await loadScheduleLikeAPage();
  const todayCurrentId = currentTaskId(todayLoad.schedule.tasks);

  // ---- "roadmap-style": fetch lại lần 2 độc lập, rồi dùng ĐÚNG buildRoadmapRows + groupTasksByPhase
  // thật của apps/web (không viết lại logic nhóm/ghép) ----
  const roadmapLoad = await loadScheduleLikeAPage();
  const roadmapCurrentId = currentTaskId(roadmapLoad.schedule.tasks);
  const rows: RoadmapRow[] = buildRoadmapRows(roadmapLoad.outlineTasks, roadmapLoad.schedule.tasks);
  const groups = groupTasksByPhase(templatePhases, rows);

  eq('cùng task hiện tại giữa today-style và roadmap-style', roadmapCurrentId, todayCurrentId);
  eq('today-style và roadmap-style cùng ngày dự kiến hoàn thành', roadmapLoad.schedule.finish, todayLoad.schedule.finish);
  eq('roadmap gộp đủ 113 task', groups.reduce((n, g) => n + g.tasks.length, 0), 113);
  if (todayCurrentId) {
    const inSomeGroup = groups.some((g) => g.tasks.some((t) => t.id === todayCurrentId));
    eq('task hiện tại nằm trong đúng 1 nhóm Phase của roadmap', inSomeGroup, true);
  }

  console.log(`${checks - fails}/${checks} kiểm tra đạt`);
  if (fails > 0) process.exitCode = 1;
} finally {
  if (userId) {
    console.log(`Đang xoá user test: ${email} (${userId})`);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error(`CẢNH BÁO: xoá user test thất bại, tự xoá tay user ${email} (${userId}): ${deleteError.message}`);
      process.exitCode = 1;
    }
  }
}
