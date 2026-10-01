import Link from 'next/link';
import { signOut } from '@/app/(auth)/login/actions';
import { copy } from '@/lib/copy';

export default function SettingsPage() {
  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">Cài đặt</h1>
      <p className="text-sm text-ink-muted">Chưa triển khai (xem T-009 trong UpComming_Plan)</p>
      <Link href="/settings/update-progress" className="text-sm text-accent underline">
        {copy.updateProgressLink}
      </Link>
      <form action={signOut}>
        <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm text-ink">
          {copy.logoutButton}
        </button>
      </form>
    </main>
  );
}
