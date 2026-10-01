'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ResourceStatus } from '@roadmap/core';
import { createClient } from '@/lib/supabase/server';
import { parseSetStatusForm, parseUpdateEtaForm, parseOptedInForm } from '@/lib/resource-forms';
import { setResourceStatus, updateResourceEta, setResourceOptedIn } from '@/lib/resource-mutations';
import { AppError, toUserMessage } from '@/lib/errors';

function successUrl(resourceId: string): string {
  return `/buy?ok=1&resourceId=${encodeURIComponent(resourceId)}#resource-${resourceId}`;
}

function errorUrl(message: string, resourceId?: string): string {
  const params = new URLSearchParams({ error: message });
  return `/buy?${params.toString()}${resourceId ? `#resource-${resourceId}` : ''}`;
}

async function getUserOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return supabase;
}

async function readResourceStatus(supabase: Awaited<ReturnType<typeof createClient>>, resourceId: string): Promise<ResourceStatus> {
  const { data } = await supabase.from('plan_resource_state').select('status').eq('resource_id', resourceId).maybeSingle();
  if (!data) throw new AppError('Không tìm thấy tài nguyên trong lộ trình của bạn', 'resource_not_found', 404);
  return data.status as ResourceStatus;
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let resourceId = '';
  let url: string;
  try {
    const raw = formData.get('resourceId');
    resourceId = typeof raw === 'string' ? raw : '';
    const currentStatus = await readResourceStatus(supabase, resourceId);
    const parsed = parseSetStatusForm(formData, currentStatus);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    await setResourceStatus(supabase, parsed.value.resourceId, parsed.value.targetStatus, parsed.value.eta);
    url = successUrl(resourceId);
  } catch (err) {
    url = errorUrl(toUserMessage(err), resourceId);
  }
  revalidatePath('/buy');
  revalidatePath('/upcoming');
  redirect(url);
}

export async function updateEtaAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let resourceId = '';
  let url: string;
  try {
    const raw = formData.get('resourceId');
    resourceId = typeof raw === 'string' ? raw : '';
    const currentStatus = await readResourceStatus(supabase, resourceId);
    const parsed = parseUpdateEtaForm(formData, currentStatus);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    await updateResourceEta(supabase, parsed.value.resourceId, parsed.value.eta);
    url = successUrl(resourceId);
  } catch (err) {
    url = errorUrl(toUserMessage(err), resourceId);
  }
  revalidatePath('/buy');
  revalidatePath('/upcoming');
  redirect(url);
}

export async function setOptedInAction(formData: FormData): Promise<void> {
  const supabase = await getUserOrRedirect();
  let resourceId = '';
  let url: string;
  try {
    const parsed = parseOptedInForm(formData);
    if (!parsed.ok) throw new AppError(parsed.error, 'invalid_input', 400);
    resourceId = parsed.value.resourceId;
    await setResourceOptedIn(supabase, parsed.value.resourceId, parsed.value.optedIn);
    url = successUrl(resourceId);
  } catch (err) {
    url = errorUrl(toUserMessage(err), resourceId);
  }
  revalidatePath('/buy');
  revalidatePath('/upcoming');
  redirect(url);
}
