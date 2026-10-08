'use client';

import { useRouter } from 'next/navigation';

/**
 * router.back() đi qua lịch sử trình duyệt (giống vuốt back trên iOS) nên có thể phục hồi
 * từ bfcache/router cache — mượt hơn hẳn <Link href="/roadmap"> ép điều hướng mới, vốn phải
 * tải lại dữ liệu từ server vì route đích là force-dynamic.
 */
export function BackLink({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} className="text-sm text-ink-muted hover:text-ink w-fit">
      {label}
    </button>
  );
}
