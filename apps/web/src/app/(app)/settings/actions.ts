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

export type UpdateSettingsResult = { ok: true } | { ok: false; error: string };

/** Server Action: Cập nhật cài đặt. */
export async function updateSettingsAction(formData: FormData): Promise<UpdateSettingsResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Chưa đăng nhập.' };

    const reminderTime = formData.get('reminderTime') as string;
    const quietStart = formData.get('quietStart') as string;
    const quietEnd = formData.get('quietEnd') as string;
    
    // Thu thập các ngày nghỉ đã check
    const restDays = [];
    for (let i = 0; i < 7; i++) {
      if (formData.get(`restDay_${i}`)) {
        restDays.push(i);
      }
    }

    const { error } = await supabase.from('plans').update({
      reminder_time: reminderTime || '20:00',
      quiet_hours_start: quietStart || '22:00',
      quiet_hours_end: quietEnd || '07:00',
      rest_days: restDays
    }).eq('user_id', user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toUserMessage(err) };
  }
}
