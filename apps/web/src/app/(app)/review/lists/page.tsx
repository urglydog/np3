import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Đã hợp nhất vào /review/practice (chọn theo bài + theo danh sách trong 1 trang) — giữ route cũ để không vỡ link/bookmark. */
export default function ReviewListsRedirect() {
  redirect('/review/practice');
}
