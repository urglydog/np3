// Kiểm tra tasksToMarkDone / nextTaskAfter: logic "đã học đến đâu" (chỉ phục vụ xem trước ở UI).
import { readFileSync } from 'node:fs';
import { nextTaskAfter, tasksToMarkDone, type TaskProgressRow } from '../src/progress';

let fails = 0,
  checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.error(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

interface TplTask {
  code: string;
  sort: number;
}
const tpl: { tasks: TplTask[] } = JSON.parse(readFileSync(new URL('./fixtures/n3-template.json', import.meta.url), 'utf8'));
const allTodo: TaskProgressRow[] = tpl.tasks
  .map((t) => ({ id: t.code, sort: t.sort, status: 'todo' as const }))
  .sort((a, b) => a.sort - b.sort);

// (a) toàn bộ todo: lấy đúng 5 task đầu theo sort
{
  const upTo = allTodo[4].sort;
  const expected = allTodo.slice(0, 5).map((t) => t.id);
  eq('(a) 5 task đầu khi upToSort = sort task thứ 5', tasksToMarkDone(allTodo, upTo), expected);
}

// (b) có done/skipped xen giữa: bị loại dù sort <= ngưỡng
{
  const mixed = allTodo.map((t, i) => (i === 1 ? { ...t, status: 'skipped' as const } : i === 3 ? { ...t, status: 'done' as const } : t));
  const upTo = allTodo[4].sort;
  const expected = [allTodo[0].id, allTodo[2].id, allTodo[4].id];
  eq('(b) bỏ qua task đã done/skipped', tasksToMarkDone(mixed, upTo), expected);
}

// (c) ngưỡng dưới task nhỏ nhất -> rỗng
eq('(c) ngưỡng quá thấp -> rỗng', tasksToMarkDone(allTodo, allTodo[0].sort - 1), []);

// (d) ngưỡng ở task cuối -> lấy hết phần chưa xong
eq('(d) ngưỡng = sort lớn nhất -> lấy hết', tasksToMarkDone(allTodo, allTodo[allTodo.length - 1].sort).length, allTodo.length);

// (e) input xáo trộn vẫn ra đúng tập hợp và đúng thứ tự sort
{
  const shuffled = [...allTodo].reverse();
  const upTo = allTodo[9].sort;
  const expected = allTodo.slice(0, 10).map((t) => t.id);
  eq('(e) xáo trộn đầu vào vẫn đúng tập + đúng thứ tự', tasksToMarkDone(shuffled, upTo), expected);
}

// nextTaskAfter: bỏ qua task done/skipped, hết task thì trả null
{
  const upTo = allTodo[4].sort;
  eq('next sau ngưỡng là task thứ 6', nextTaskAfter(allTodo, upTo)?.id, allTodo[5].id);
}
{
  const withSkippedNext = allTodo.map((t, i) => (i === 5 ? { ...t, status: 'skipped' as const } : t));
  const upTo = allTodo[4].sort;
  eq('next bỏ qua task skipped ngay sau ngưỡng', nextTaskAfter(withSkippedNext, upTo)?.id, allTodo[6].id);
}
eq('next khi hết task -> null', nextTaskAfter(allTodo, allTodo[allTodo.length - 1].sort), null);

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
