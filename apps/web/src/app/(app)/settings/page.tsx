import Link from 'next/link';
import { signOut } from '@/app/(auth)/login/actions';
import { copy } from '@/lib/copy';
import { BackupImportForm } from '@/components/backup-import-form';

export default function SettingsPage() {
  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">Cài đặt</h1>
      <p className="text-sm text-ink-muted">Chưa triển khai (xem T-009 trong UpComming_Plan)</p>
      <Link href="/settings/update-progress" className="text-sm text-accent underline">
        {copy.updateProgressLink}
      </Link>

      <section className="flex flex-col gap-3 rounded-md border border-line p-3">
        <h2 className="text-sm font-semibold text-ink">{copy.backupTitle}</h2>
        <a href="/api/backup" className="self-start rounded-md border border-line px-4 py-2 text-sm text-ink">
          {copy.backupDownloadButton}
        </a>
        <h3 className="text-sm font-medium text-ink">{copy.backupRestoreTitle}</h3>
        <BackupImportForm />
      </section>

      <form action={signOut}>
        <button type="submit" className="rounded-md border border-line px-4 py-2 text-sm text-ink">
          {copy.logoutButton}
        </button>
      </form>
    </main>
  );
}
