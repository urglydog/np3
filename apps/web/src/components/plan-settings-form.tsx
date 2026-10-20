'use client';

import { useState } from 'react';
import { updateSettingsAction } from '@/app/(app)/settings/actions';
import { Loader2, CheckCircle } from 'lucide-react';

interface PlanSettingsFormProps {
  initialReminderTime: string;
  initialQuietStart: string;
  initialQuietEnd: string;
  initialRestDays: number[];
}

const DAYS_OF_WEEK = [
  { id: 0, label: 'CN' },
  { id: 1, label: 'T2' },
  { id: 2, label: 'T3' },
  { id: 3, label: 'T4' },
  { id: 4, label: 'T5' },
  { id: 5, label: 'T6' },
  { id: 6, label: 'T7' },
];

export function PlanSettingsForm({
  initialReminderTime,
  initialQuietStart,
  initialQuietEnd,
  initialRestDays,
}: PlanSettingsFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Lược bỏ phần mili giây để hiển thị vừa vặn trong input type="time"
  const fmtTime = (t: string) => t.substring(0, 5);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    const result = await updateSettingsAction(formData);

    if (result.ok) {
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Giờ nhắc & Yên tĩnh */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-muted">Giờ nhắc hằng ngày</span>
          <input
            name="reminderTime"
            type="time"
            defaultValue={fmtTime(initialReminderTime)}
            className="rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand focus:outline-none"
            required
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-muted">Bắt đầu giờ yên tĩnh</span>
          <input
            name="quietStart"
            type="time"
            defaultValue={fmtTime(initialQuietStart)}
            className="rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-muted">Kết thúc giờ yên tĩnh</span>
          <input
            name="quietEnd"
            type="time"
            defaultValue={fmtTime(initialQuietEnd)}
            className="rounded-md border border-line bg-surface p-2 text-sm text-ink focus:border-brand focus:outline-none"
            required
          />
        </label>
      </div>
      <p className="text-xs text-ink-faint -mt-2">
        Hệ thống sẽ không gửi push notification trong khung giờ yên tĩnh.
      </p>

      {/* Ngày nghỉ cố định */}
      <div className="flex flex-col gap-1">
        <span className="text-sm text-ink-muted">Ngày nghỉ cố định trong tuần</span>
        <div className="flex flex-wrap gap-3">
          {DAYS_OF_WEEK.map((day) => (
            <label key={day.id} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                name={`restDay_${day.id}`}
                defaultChecked={initialRestDays.includes(day.id)}
                className="rounded border-line text-brand focus:ring-brand"
              />
              {day.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {status === 'loading' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            'Lưu cài đặt'
          )}
        </button>

        {status === 'ok' && (
          <span className="flex items-center gap-1 text-sm text-green-500">
            <CheckCircle size={14} /> Đã lưu
          </span>
        )}
        {status === 'error' && <span className="text-sm text-red-500">{errorMsg}</span>}
      </div>
    </form>
  );
}
