// Kiểm tra tasksToMarkDone / nextTaskAfter: logic "đã học đến đâu" (chỉ phục vụ xem trước ở UI).
import { readFileSync } from 'node:fs';
import { nextTaskAfter, tasksToMarkDone, writingMastery, type TaskProgressRow } from '../src/progress';

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
  writing_target: number;
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

// ---- writingMastery ----
{
  const withTarget = tpl.tasks.filter((t) => t.writing_target > 0);
  const withoutTarget = tpl.tasks.filter((t) => t.writing_target === 0);
  if (withTarget.length === 0 || withoutTarget.length === 0) {
    throw new Error('fixture phải có cả task writing_target>0 và =0 để test writingMastery');
  }

  eq('danh sách rỗng -> 0', writingMastery([]), 0);

  // reps = target cho mọi task có target -> trung bình = 1
  eq(
    'reps = target hết -> mastery = 1',
    writingMastery(withTarget.map((t) => ({ writingTarget: t.writing_target, writingReps: t.writing_target }))),
    1
  );

  // reps vượt target -> chặn ở 1, không vượt quá
  eq(
    'reps vượt target bị chặn ở 1 (không tính >1)',
    writingMastery(withTarget.map((t) => ({ writingTarget: t.writing_target, writingReps: t.writing_target * 5 }))),
    1
  );

  // task target=0 bị loại hoàn toàn khỏi phép tính, dù reps có nhập cũng không ảnh hưởng
  {
    const onlyFirstHasReps = [
      { writingTarget: withTarget[0].writing_target, writingReps: withTarget[0].writing_target }, // mastery 1
      ...withoutTarget.map((t) => ({ writingTarget: t.writing_target, writingReps: 9999 })), // bị loại, không kéo trung bình xuống
    ];
    eq('task target=0 bị loại, không ảnh hưởng trung bình', writingMastery(onlyFirstHasReps), 1);
  }

  // nửa đạt nửa chưa -> trung bình đúng giữa
  {
    const half = [
      { writingTarget: 100, writingReps: 100 },
      { writingTarget: 100, writingReps: 0 },
    ];
    eq('nửa đạt nửa chưa -> trung bình 0.5', writingMastery(half), 0.5);
  }
}

console.log(`${checks - fails}/${checks} kiểm tra đạt`);
process.exit(fails ? 1 : 0);
