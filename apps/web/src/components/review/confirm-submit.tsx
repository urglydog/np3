'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

/** Nút submit hỏi xác nhận trước (thao tác xoá). Hủy hộp thoại thì không gửi form. */
export function ConfirmSubmit({ children, message, className, title }: { children: React.ReactNode; message: string; className?: string; title?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (typeof window !== 'undefined' && !window.confirm(message)) e.preventDefault();
      }}
      className={`${className ?? ''} ${pending ? 'opacity-70' : ''}`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
