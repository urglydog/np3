import Link from 'next/link';
import { Bell, Database, Settings } from 'lucide-react';
import { signOut } from '@/app/(auth)/login/actions';
import { copy } from '@/lib/copy';
import { PushToggle } from '@/components/push-toggle';
import { BackupPanel } from '@/components/backup-panel';
import { PlanSettingsForm } from '@/components/plan-settings-form';
import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: plan } = await supabase
    .from('plans')
    .select('reminder_time, quiet_hours_start, quiet_hours_end, rest_days')
    .eq('user_id', user!.id)
    .single();

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold text-ink">Cài đặt</h1>

      {/* Cấu hình lịch & nhắc nhở — T-009 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-ink-muted" />
          <h2 className="text-sm font-medium text-ink">Cấu hình chung</h2>
        </div>
        {plan && (
          <PlanSettingsForm
            initialReminderTime={plan.reminder_time}
            initialQuietStart={plan.quiet_hours_start}
            initialQuietEnd={plan.quiet_hours_end}
            initialRestDays={plan.rest_days}
          />
        )}
      </section>

      <hr className="border-line" />

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

      {/* Sao lưu dữ liệu — T-008 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-ink-muted" />
          <h2 className="text-sm font-medium text-ink">Sao lưu dữ liệu</h2>
        </div>
        <BackupPanel />
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
