// Sinh supabase/seed.sql từ data/n3-template.json. Liên kết bằng `code`, UUID sinh mới mỗi lần chạy.
// Chạy: npm run db:seed:gen
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

interface TplPhase { code: string; title: string; goal?: string; sort: number }
interface TplTask {
  code: string; phase: string; milestone?: string; name: string; deliverable?: string;
  tool_note?: string; est_hours: number; writing_target: number; sort: number;
  origin: string; optional: boolean; resources: string[];
}
interface TplResource {
  code: string; phase_note?: string; kind: string; title: string; purpose?: string;
  price_vnd: number; tier: 'core' | 'optional'; note?: string | null; lead_time_days: number;
  is_affiliate: boolean; buy_url?: string | null;
}
interface Template {
  slug: string; version: string; locale: string; title: string; hours_disclaimer?: string;
  phases: TplPhase[]; tasks: TplTask[]; resources: TplResource[];
}

const tpl: Template = JSON.parse(readFileSync(join(root, 'data/n3-template.json'), 'utf8'));

const sqlStr = (v: string | null | undefined): string => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);
const sqlBool = (v: boolean): string => (v ? 'true' : 'false');
const sqlNum = (v: number): string => String(v);

const templateId = randomUUID();
const phaseIds = new Map<string, string>(tpl.phases.map((p) => [p.code, randomUUID()]));
const taskIds = new Map<string, string>(tpl.tasks.map((t) => [t.code, randomUUID()]));
const resourceIds = new Map<string, string>(tpl.resources.map((r) => [r.code, randomUUID()]));

const lines: string[] = [];
lines.push('-- Sinh tự động bởi scripts/gen-seed.ts từ data/n3-template.json. Không sửa tay.');
lines.push('begin;');

lines.push(`insert into templates (id, slug, title, version, locale, hours_disclaimer, is_published) values`);
lines.push(
  `  ('${templateId}', ${sqlStr(tpl.slug)}, ${sqlStr(tpl.title)}, ${sqlStr(tpl.version)}, ${sqlStr(tpl.locale)}, ${sqlStr(tpl.hours_disclaimer)}, true);`
);

lines.push('insert into template_phases (id, template_id, code, title, goal, sort) values');
lines.push(
  tpl.phases
    .map(
      (p) =>
        `  ('${phaseIds.get(p.code)}', '${templateId}', ${sqlStr(p.code)}, ${sqlStr(p.title)}, ${sqlStr(p.goal)}, ${sqlNum(p.sort)})`
    )
    .join(',\n') + ';'
);

lines.push('insert into template_resources (id, template_id, code, kind, title, purpose, price_vnd, price_checked_at, tier, free_alternative, lead_time_days, buy_url, is_affiliate, note) values');
lines.push(
  tpl.resources
    .map(
      (r) =>
        `  ('${resourceIds.get(r.code)}', '${templateId}', ${sqlStr(r.code)}, ${sqlStr(r.kind)}, ${sqlStr(r.title)}, ${sqlStr(r.purpose)}, ${sqlNum(r.price_vnd)}, null, ${sqlStr(r.tier)}, null, ${sqlNum(r.lead_time_days)}, ${sqlStr(r.buy_url)}, ${sqlBool(r.is_affiliate)}, ${sqlStr(r.note)})`
    )
    .join(',\n') + ';'
);

lines.push('insert into template_tasks (id, template_id, phase_id, code, milestone, name, deliverable, tool_note, est_hours, writing_target, sort, origin, optional) values');
lines.push(
  tpl.tasks
    .map((t) => {
      const phaseId = phaseIds.get(t.phase);
      if (!phaseId) throw new Error(`Task ${t.code} tham chiếu phase lạ: ${t.phase}`);
      return `  ('${taskIds.get(t.code)}', '${templateId}', '${phaseId}', ${sqlStr(t.code)}, ${sqlStr(t.milestone)}, ${sqlStr(t.name)}, ${sqlStr(t.deliverable)}, ${sqlStr(t.tool_note)}, ${sqlNum(t.est_hours)}, ${sqlNum(t.writing_target)}, ${sqlNum(t.sort)}, ${sqlStr(t.origin)}, ${sqlBool(t.optional)})`;
    })
    .join(',\n') + ';'
);

const taskResourceRows: string[] = [];
for (const t of tpl.tasks) {
  for (const code of t.resources) {
    const resourceId = resourceIds.get(code);
    if (!resourceId) throw new Error(`Task ${t.code} tham chiếu resource lạ: ${code}`);
    taskResourceRows.push(`  ('${taskIds.get(t.code)}', '${resourceId}')`);
  }
}
lines.push('insert into template_task_resources (task_id, resource_id) values');
lines.push(taskResourceRows.join(',\n') + ';');

lines.push('commit;');

writeFileSync(join(root, 'supabase/seed.sql'), lines.join('\n\n') + '\n');

console.log(
  `Đã sinh supabase/seed.sql: 1 template, ${tpl.phases.length} phase, ${tpl.tasks.length} task, ${tpl.resources.length} tài nguyên, ${taskResourceRows.length} liên kết task-tài nguyên.`
);
