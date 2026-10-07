'use client';

import { useEffect } from 'react';

/**
 * Khi điều hướng bằng anchor (#task-x, #resource-x) vào một phần tử nằm trong <details> đang đóng
 * (nhóm Phase ở /roadmap, mục "đã có/không cần" ở /buy), trình duyệt không tự mở <details> ở mọi
 * nơi — kết quả là bấm link từ /upcoming rồi không thấy gì. Component này tự mở & cuộn tới đích.
 */
export function AnchorDetailsOpener() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;

    let el: HTMLElement | null = target;
    while (el) {
      if (el instanceof HTMLDetailsElement) el.open = true;
      el = el.parentElement;
    }

    target.scrollIntoView({ block: 'center' });
  }, []);

  return null;
}
