'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppError, toUserMessage } from '@/lib/errors';

const createPlanSchema = z.object({
  includeOptional: z.enum(['425', '566']).transform((v) => v === '566'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu không hợp lệ'),
  hoursPerDay: z.coerce.number().gt(0).lte(16),
  daysPerWeek: z.coerce.number().int().min(1).max(7),
  timezone: z.string().min(1),
  doneUpToTaskCode: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type CreatePlanState = { error: string | null };

export async function createPlan(_prevState: CreatePlanState, formData: FormData): Promise<CreatePlanState> {
  try {
    const parsed = createPlanSchema.safeParse({
      includeOptional: formData.get('package'),
      startDate: formData.get('startDate'),
      hoursPerDay: formData.get('hoursPerDay'),
      daysPerWeek: formData.get('daysPerWeek'),
      timezone: formData.get('timezone'),
      doneUpToTaskCode: formData.get('doneUpToTaskCode'),
    });
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ', 'invalid_input', 400);
    }
    const { includeOptional, startDate, hoursPerDay, daysPerWeek, timezone, doneUpToTaskCode } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('slug')
      .eq('is_published', true)
      .limit(1)
      .single();
    if (templateError || !template) {
      throw new AppError('Chưa có template nào được xuất bản', 'no_template', 500);
    }

    const { error: rpcError } = await supabase.rpc('create_plan', {
      p_template_slug: template.slug,
      p_start_date: startDate,
      p_hours_per_day: hoursPerDay,
      p_days_per_week: daysPerWeek,
      p_include_optional: includeOptional,
      p_timezone: timezone,
      p_done_up_to_code: doneUpToTaskCode,
    });
    if (rpcError) throw new AppError(rpcError.message, 'create_plan_failed', 400);
  } catch (err) {
    return { error: toUserMessage(err) };
  }
  redirect('/today');
}
