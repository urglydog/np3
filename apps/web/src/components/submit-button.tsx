'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

/**
 * Nút submit dùng chung cho form Server Action — tự disable + hiện spinner
 * khi đang xử lý (useFormStatus chỉ đọc được state của <form> cha gần nhất).
 */
export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ''} ${pending ? 'opacity-70' : ''}`}
    >
      {pending ? <Loader2 className="mr-1.5 inline-block h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
