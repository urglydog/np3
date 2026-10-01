import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Một chiều duy nhất: chưa có plan -> sang /create-plan. /create-plan nằm NGOÀI nhóm (app) này
// nên không chạy lại luật này, tránh vòng lặp redirect.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: plan } = await supabase.from('plans').select('id').limit(1).maybeSingle();
  if (!plan) redirect('/create-plan');

  return <>{children}</>;
}
