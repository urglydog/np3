'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppError, toUserMessage } from '@/lib/errors';

const credentialsSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

export type AuthActionState = { error: string | null };

function parseCredentials(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ', 'invalid_input', 400);
  }
  return parsed.data;
}

export async function signIn(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const { email, password } = parseCredentials(formData);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new AppError(error.message, 'auth_error', 401);
  } catch (err) {
    return { error: toUserMessage(err) };
  }
  redirect('/today');
}

export async function signUp(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const { email, password } = parseCredentials(formData);
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new AppError(error.message, 'auth_error', 401);
  } catch (err) {
    return { error: toUserMessage(err) };
  }
  redirect('/today');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await supabase.auth.signOut();
  redirect('/login');
}
