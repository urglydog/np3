import Link from 'next/link';
import { Bell } from 'lucide-react';
import { signOut } from '@/app/(auth)/login/actions';
import { copy } from '@/lib/copy';
import { PushToggle } from '@/components/push-toggle';

export default function SettingsPage() {
  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold text-ink">Cài đặt</h1>

      {/* Thông báo — T-001 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-ink-muted" />
          <h2 className="text-sm font-medium text-ink">Thông báo đẩy</h2>
        </div>
        <p className="text-xs text-ink-muted">
          Nhắc học hàng ngày và nhắc mua sách đúng hạn. Không cần mở trình duyệt, thông báo hiện thẳng trên màn hình.
        </p>
        <PushToggle />
      </section>

      <hr className="border-line" />

      {/* Tiến độ */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink">Tiến độ học tập</h2>
        <Link href="/settings/update-progress" className="text-sm text-accent underline">
          {copy.updateProgressLink}
        </Link>
      </section>

      <hr className="border-line" />

      {/* Đăng xuất */}
      <section>
        <form action={signOut}>
          <button
            type="submit"
            id="settings-logout-btn"
            className="rounded-md border border-line px-4 py-2 text-sm text-ink"
          >
            {copy.logoutButton}
          </button>
        </form>
      </section>
    </main>
  );
}
