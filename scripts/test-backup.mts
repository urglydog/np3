// Kiểm thử tích hợp: T-008 Backup (xuất/nhập JSON).
// Cần Supabase local đang chạy. KHÔNG db reset.
import { createTestUser, createBasePlan, deleteTestUser, makeChecker } from './integration-helpers.mts';
import { exportPlan, importPlan } from '../apps/web/src/lib/backup.ts';
import { toggleTaskSkip } from '../apps/web/src/lib/schedule-mutations.ts';
import { setResourceStatus } from '../apps/web/src/lib/resource-mutations.ts';

const { eq, report } = makeChecker();
const user = await createTestUser('backup-test');

try {
  // 1. Tạo plan và thay đổi trạng thái
  await createBasePlan(user.client);
  
  const { data: plan } = await user.client.from('plans').select('id, template_id').single();
  const { data: tasks } = await user.client.from('template_tasks').select('id').eq('template_id', plan!.template_id).limit(1);
  const taskId = tasks![0].id;
  
  const { data: resources } = await user.client.from('template_resources').select('id').eq('template_id', plan!.template_id).limit(1);
  const resourceId = resources![0].id;

  // Đánh dấu bỏ qua 1 task
  await toggleTaskSkip(user.client, taskId);
  // Đánh dấu đã mua 1 resource
  await setResourceStatus(user.client, resourceId, 'owned', null);

  // 2. Export plan
  const backupData = await exportPlan(user.client);
  
  eq('Version của backup', backupData.version, 1);
  eq('Chứa plan info', backupData.plan.id, plan!.id);
  
  const skippedTask = backupData.task_states.find(t => t.task_id === taskId);
  eq('Task được export có trạng thái skipped', skippedTask?.status, 'skipped');

  const ownedRes = backupData.resource_states.find(r => r.resource_id === resourceId);
  eq('Resource được export có trạng thái owned', ownedRes?.status, 'owned');

  // 3. Thay đổi trạng thái hiện tại (để kiểm tra xem có khôi phục lại được không)
  await toggleTaskSkip(user.client, taskId); // Bỏ "bỏ qua"
  await setResourceStatus(user.client, resourceId, 'none', null); // Hủy mua
  
  // 4. Import backup
  await importPlan(user.client, JSON.stringify(backupData));
  
  // 5. Đọc lại từ DB để xác nhận đã khôi phục đúng
  const { data: taskStateAfter } = await user.client
    .from('plan_task_state')
    .select('status')
    .eq('plan_id', plan!.id)
    .eq('task_id', taskId)
    .single();
    
  eq('Task đã được khôi phục thành skipped', taskStateAfter?.status, 'skipped');

  const { data: resStateAfter } = await user.client
    .from('plan_resource_state')
    .select('status')
    .eq('plan_id', plan!.id)
    .eq('resource_id', resourceId)
    .single();
    
  eq('Resource đã được khôi phục thành owned', resStateAfter?.status, 'owned');

  report();
} finally {
  await deleteTestUser(user);
}
