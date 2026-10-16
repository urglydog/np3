import { AlertTriangle, CheckCircle } from 'lucide-react';

/** Thông báo kết quả Server Action đọc từ ?ok= / ?error= (searchParams đã được Next giải mã sẵn). */
export function FlashMessage({ ok, error }: { ok?: string; error?: string }) {
  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger bg-danger/5 p-3 text-sm text-danger">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {error}
      </div>
    );
  }
  if (ok && ok !== '1') {
    return (
      <div role="status" className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/5 p-3 text-sm text-ink">
        <CheckCircle className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        {ok}
      </div>
    );
  }
  return null;
}
