'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseBackupFile, validateCodesBelongToTemplate, summarizeBackup, type BackupPreview } from '@/lib/backup';
import { loadValidCodesForTemplate, importBackupViaRpc } from '@/lib/backup-mutations';
import { toUserMessage } from '@/lib/errors';

export type ImportState =
  | { step: 'idle' }
  | { step: 'preview'; summary: BackupPreview; rawJson: string }
  | { step: 'error'; errors: string[] };

export async function previewImportAction(_prevState: ImportState, formData: FormData): Promise<ImportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { step: 'error', errors: ['Chưa chọn file'] };
  }

  const text = await file.text();
  const parsed = parseBackupFile(text);
  if (!parsed.ok) return { step: 'error', errors: parsed.errors };

  const catalog = await loadValidCodesForTemplate(supabase, parsed.value.template.slug);
  if (!catalog) {
    return { step: 'error', errors: [`Template trong bản sao lưu không tồn tại hoặc chưa xuất bản: ${parsed.value.template.slug}`] };
  }

  const codeErrors = validateCodesBelongToTemplate(parsed.value, catalog.taskCodes, catalog.resourceCodes);
  if (codeErrors.length > 0) return { step: 'error', errors: codeErrors };

  return { step: 'preview', summary: summarizeBackup(parsed.value), rawJson: text };
}

export async function confirmImportAction(_prevState: ImportState, formData: FormData): Promise<ImportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rawJson = formData.get('rawJson');
  if (typeof rawJson !== 'string') return { step: 'error', errors: ['Thiếu dữ liệu bản sao lưu'] };

  const parsed = parseBackupFile(rawJson);
  if (!parsed.ok) return { step: 'error', errors: parsed.errors };

  try {
    await importBackupViaRpc(supabase, parsed.value);
  } catch (err) {
    return { step: 'error', errors: [toUserMessage(err)] };
  }

  redirect('/today');
}
