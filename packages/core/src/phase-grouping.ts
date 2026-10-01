/** Nhóm một danh sách task (đã có phaseCode + sort) theo Phase, phục vụ màn Lộ trình. Hàm thuần. */
export interface PhaseInput {
  code: string;
  title: string;
  sort: number;
}

export interface PhaseGroup<T> {
  code: string;
  title: string;
  sort: number;
  tasks: T[];
}

export function groupTasksByPhase<T extends { phaseCode: string; sort: number }>(
  phases: PhaseInput[],
  tasks: T[]
): PhaseGroup<T>[] {
  const tasksByPhase = new Map<string, T[]>();
  for (const t of tasks) {
    const list = tasksByPhase.get(t.phaseCode) ?? [];
    list.push(t);
    tasksByPhase.set(t.phaseCode, list);
  }
  return [...phases]
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({
      code: p.code,
      title: p.title,
      sort: p.sort,
      tasks: (tasksByPhase.get(p.code) ?? []).slice().sort((a, b) => a.sort - b.sort),
    }))
    .filter((g) => g.tasks.length > 0);
}
