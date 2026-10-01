import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { copy } from '@/lib/copy';
import { CreatePlanForm } from './create-plan-form';

// Route riêng (không nằm trong (app)): (app)/layout.tsx đã có luật "chưa có plan -> vào đây".
// Trang này chỉ kiểm tra chiều ngược lại (đã có plan -> sang /today), một chiều duy nhất,
// nên hai luật không bao giờ redirect qua lại lẫn nhau (không có vòng lặp).
export default async function CreatePlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: existingPlan } = await supabase.from('plans').select('id').limit(1).maybeSingle();
  if (existingPlan) redirect('/today');

  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold text-ink">{copy.createPlanTitle}</h1>
      <CreatePlanForm />
    </main>
  );
}
