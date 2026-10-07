'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Status } from '@roadmap/core';
import { createClient } from '@/lib/supabase/server';
import {
  parseToggleSkipForm,
  parseToggleDoneForm,
  parseDelayForm,
  parsePinForm,
  parseUnpinForm,
  parseBreakForm,
} from '@/lib/schedule-forms';
import {
  toggleTaskSkip,
  toggleDoneInDb,
  delayTaskInDb,
  pinTaskInDb,
  unpinTaskInDb,
  insertBreakInDb,
  type MutationResult,
} from '@/lib/schedule-mutations';
import { AppError, toUserMessage } from '@/lib/errors';

function resultUrl(taskId: string, result: MutationResult, noTaskAffected = false): string {
  const params = new URLSearchParams({
    taskId,
    conflict: result.conflict ? '1' : '0',
    clamped: result.pinClamped ? '1' : '0',
    noop: noTaskAffected ? '1' : '0',
    ok: '1',
  });
  return `/roadmap?${params.toString()}#task-${taskId}`;
}

function errorUrl(message: string, taskId?: string): string {
  const params = new URLSearchParams({ error: message });
  return `/roadmap?${params.toString()}${taskId ? `#task-${taskId}` : ''}`;
}

async function getUserOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return supabase;
}

async function readTaskStatus(supabase: Awaited<ReturnType<typeof createClient>>, taskId: string): Promise<Status> {
  const { data } = await supabase.from('plan_task_state').select('status').eq('task_id', taskId).maybeSingle();
  if (!data) throw new AppError('Không tìm thấy task trong lộ trình của bạn', 'task_not_found', 404);
  return data.status as Status;
}

export async function toggleSkipAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let taskId = '';
  let url: string;
  try {
    const rawTaskId = formData.get('taskId');
    taskId = typeof rawTaskId === 'string' ? rawTaskId : '';
    const currentStatus = await readTaskStatus(supabase, taskId);
    const parsed = parseToggleSkipForm(formData, currentStatus);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    const result = await toggleTaskSkip(supabase, parsed.value.taskId);
    url = resultUrl(taskId, result);
  } catch (err) {
    url = errorUrl(toUserMessage(err), taskId);
  }
  revalidatePath('/roadmap');
  redirect(url);
}

export async function toggleDoneAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let taskId = '';
  let url: string;
  try {
    const rawTaskId = formData.get('taskId');
    taskId = typeof rawTaskId === 'string' ? rawTaskId : '';
    const currentStatus = await readTaskStatus(supabase, taskId);
    const parsed = parseToggleDoneForm(formData, currentStatus);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    const result = await toggleDoneInDb(supabase, parsed.value.taskId);
    url = resultUrl(taskId, result);
  } catch (err) {
    url = errorUrl(toUserMessage(err), taskId);
  }
  revalidatePath('/roadmap');
  redirect(url);
}

export async function delayAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let taskId = '';
  let url: string;
  try {
    const rawTaskId = formData.get('taskId');
    taskId = typeof rawTaskId === 'string' ? rawTaskId : '';
    const currentStatus = await readTaskStatus(supabase, taskId);
    const parsed = parseDelayForm(formData, currentStatus);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    const result = await delayTaskInDb(supabase, parsed.value.taskId, parsed.value.days);
    url = resultUrl(taskId, result);
  } catch (err) {
    url = errorUrl(toUserMessage(err), taskId);
  }
  revalidatePath('/roadmap');
  redirect(url);
}

export async function pinAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let taskId = '';
  let url: string;
  try {
    const rawTaskId = formData.get('taskId');
    taskId = typeof rawTaskId === 'string' ? rawTaskId : '';
    const currentStatus = await readTaskStatus(supabase, taskId);
    const parsed = parsePinForm(formData, currentStatus);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    const result = await pinTaskInDb(supabase, parsed.value.taskId, parsed.value.date);
    url = resultUrl(taskId, result);
  } catch (err) {
    url = errorUrl(toUserMessage(err), taskId);
  }
  revalidatePath('/roadmap');
  redirect(url);
}

export async function unpinAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let taskId = '';
  let url: string;
  try {
    const rawTaskId = formData.get('taskId');
    taskId = typeof rawTaskId === 'string' ? rawTaskId : '';
    const currentStatus = await readTaskStatus(supabase, taskId);
    const parsed = parseUnpinForm(formData, currentStatus);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    const result = await unpinTaskInDb(supabase, parsed.value.taskId);
    url = resultUrl(taskId, result);
  } catch (err) {
    url = errorUrl(toUserMessage(err), taskId);
  }
  revalidatePath('/roadmap');
  redirect(url);
}

export async function breakAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let url: string;
  try {
    const parsed = parseBreakForm(formData);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    const result = await insertBreakInDb(supabase, parsed.value.fromDate, parsed.value.days);
    url = resultUrl(result.taskId || 'none', result, result.noTaskAffected);
  } catch (err) {
    url = errorUrl(toUserMessage(err));
  }
  revalidatePath('/roadmap');
  redirect(url);
}
