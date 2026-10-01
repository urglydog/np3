// Kiểm thử tích hợp: Bỏ qua / Bỏ "bỏ qua" (toggleTaskSkip). Cần Supabase local đang chạy. KHÔNG db reset.
import { createTestUser, createBasePlan, deleteTestUser, makeChecker } from './integration-helpers.mts';
import { toggleTaskSkip } from '../apps/web/src/lib/schedule-mutations.ts';

const { eq, report } = makeChecker();
const userA = await createTestUser('skip-a');
const userB = await createTestUser('skip-b');

try {
  await createBasePlan(userA.client);
  await createBasePlan(userB.client);

  const { data: aFirstTask } = await userA.client
    .from('plan_task_state')
    .select('task_id, status')
    .eq('status', 'todo')
    .limit(1)
    .maybeSingle();
  if (!aFirstTask) throw new Error('A không có task todo nào để test');
  const taskId = aFirstTask.task_id;

  // A bỏ qua task của mình
  const result1 = await toggleTaskSkip(userA.client, taskId);
  eq('A: trạng thái sau khi Bỏ qua', result1.status, 'skipped');
  const { data: afterA1 } = await userA.client.from('plan_task_state').select('status').eq('task_id', taskId).single();
  eq('A: DB lưu đúng skipped', afterA1?.status, 'skipped');

  // Gọi lại (Bỏ "bỏ qua"): phải quay về todo
  const result2 = await toggleTaskSkip(userA.client, taskId);
  eq('A: trạng thái sau khi Bỏ "bỏ qua"', result2.status, 'todo');

  // B gọi cùng mã task (trùng vì cùng template): chỉ ảnh hưởng plan của B, không đụng A
  const beforeB = await userB.client.from('plan_task_state').select('status').eq('task_id', taskId).single();
  await toggleTaskSkip(userB.client, taskId);
  const afterB = await userB.client.from('plan_task_state').select('status').eq('task_id', taskId).single();
  const afterA2 = await userA.client.from('plan_task_state').select('status').eq('task_id', taskId).single();
  eq('B: trạng thái của B thực sự đổi', afterB.data?.status !== beforeB.data?.status, true);
  eq('A: không bị ảnh hưởng khi B thao tác cùng mã task', afterA2.data?.status, 'todo');

  // Task done: không áp dụng
  const { data: doneTask } = await userA.client.from('plan_task_state').select('task_id').limit(1).maybeSingle();
  if (doneTask) {
    await userA.client.from('plan_task_state').update({ status: 'done' }).eq('task_id', doneTask.task_id);
    let threw = false;
    try {
      await toggleTaskSkip(userA.client, doneTask.task_id);
    } catch {
      threw = true;
    }
    eq('A: Bỏ qua task done phải bị từ chối', threw, true);
  }

  report();
} finally {
  await deleteTestUser(userA);
  await deleteTestUser(userB);
}
