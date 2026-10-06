'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp, type AuthActionState } from './actions';
import { copy } from '@/lib/copy';

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const action = mode === 'signin' ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">{copy.loginTitle}</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          {copy.loginEmailLabel}
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          {copy.loginPasswordLabel}
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="rounded-md border border-line bg-surface px-3 py-2 text-ink"
          />
        </label>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary disabled:opacity-60"
        >
          {mode === 'signin' ? copy.loginSubmit : copy.signupSubmit}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
        className="text-sm text-ink-muted underline"
      >
        {mode === 'signin' ? copy.loginSwitchToSignup : copy.loginSwitchToLogin}
      </button>
    </main>
  );
}
