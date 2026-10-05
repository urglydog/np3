'use server';

import { createClient } from '@/lib/supabase/server';
import { exportPlan, importPlan } from '@/lib/backup';
import { toUserMessage } from '@/lib/errors';

export type BackupActionResult = { ok: true; json?: string } | { ok: false; error: string };

/** Server Action: xuất dữ liệu → trả về JSON string để client tải về. */
export async function exportPlanAction(): Promise<BackupActionResult> {
  try {
    const supabase = await createClient();
    const data = await exportPlan(supabase);
    return { ok: true, json: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}

/** Server Action: nhận JSON string từ client, kiểm tra rồi gọi RPC. */
export async function importPlanAction(jsonString: string): Promise<BackupActionResult> {
  try {
    const supabase = await createClient();
    await importPlan(supabase, jsonString);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}
