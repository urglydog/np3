import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors';
import type { BackupPayload } from './backup';

/**
 * Giống schedule-mutations.ts/resource-mutations.ts: chỉ nhận SupabaseClient có sẵn, KHÔNG import
 * next/headers, để Server Action (client server của Next) và scripts/test-backup-roundtrip.mts
 * (client thường với JWT user test) gọi chung đúng một chỗ.
 */

export async function loadValidCodesForTemplate(
  supabase: SupabaseClient,
  slug: string
): Promise<{ taskCodes: Set<string>; resourceCodes: Set<string> } | null> {
  const { data: template } = await supabase.from('templates').select('id').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!template) return null;

  const { data: tasks } = await supabase.from('template_tasks').select('code').eq('template_id', template.id);
  const { data: resources } = await supabase.from('template_resources').select('code').eq('template_id', template.id);

  return {
    taskCodes: new Set((tasks ?? []).map((t) => t.code)),
    resourceCodes: new Set((resources ?? []).map((r) => r.code)),
  };
}

export async function importBackupViaRpc(supabase: SupabaseClient, payload: BackupPayload): Promise<string> {
  const { data, error } = await supabase.rpc('import_plan_backup', { p_payload: payload });
  if (error) throw new AppError(error.message, 'import_failed', 400);
  return data as string;
}
