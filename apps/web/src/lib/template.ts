import { createClient } from '@/lib/supabase/server';

export interface TemplateTaskOutline {
  id: string;
  code: string;
  name: string;
  sort: number;
  phaseCode: string;
  estHours: number;
  optional: boolean;
}

export interface TemplatePhaseOutline {
  code: string;
  title: string;
  sort: number;
}

export interface TemplateOutline {
  templateId: string;
  slug: string;
  phases: TemplatePhaseOutline[];
  tasks: TemplateTaskOutline[];
}

/** Đọc cây Phase/Task của template đã xuất bản (dùng cho dropdown "đã học đến đâu"). */
export async function loadPublishedTemplateOutline(): Promise<TemplateOutline | null> {
  const supabase = await createClient();
  const { data: template } = await supabase
    .from('templates')
    .select('id, slug')
    .eq('is_published', true)
    .limit(1)
    .maybeSingle();
  if (!template) return null;

  const { data: phases } = await supabase
    .from('template_phases')
    .select('code, title, sort')
    .eq('template_id', template.id)
    .order('sort');

  const { data: tasks } = await supabase
    .from('template_tasks')
    .select('id, code, name, sort, est_hours, optional, template_phases(code)')
    .eq('template_id', template.id)
    .order('sort');

  return {
    templateId: template.id,
    slug: template.slug,
    phases: phases ?? [],
    tasks: (tasks ?? []).map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      sort: t.sort,
      estHours: Number(t.est_hours),
      optional: t.optional,
      phaseCode: (t.template_phases as unknown as { code: string } | null)?.code ?? '',
    })),
  };
}
