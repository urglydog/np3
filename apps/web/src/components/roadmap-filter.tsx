'use client';

import { useState, useId } from 'react';
import type { RoadmapRow } from '@/lib/roadmap';
import { TaskRow } from './task-row';
import { TaskActions } from '@/components/task-actions';

type Phase = { code: string; title: string; tasks: RoadmapRow[] };

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'todo', label: 'Chưa làm' },
  { value: 'done', label: 'Đã xong' },
  { value: 'skipped', label: 'Bỏ qua' },
] as const;

export function RoadmapFilter({
  groups,
  currentId,
}: {
  groups: Phase[];
  currentId: string | null;
}) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const q = query.trim().toLowerCase();

  // Flat filtered list when query or filter active
  const isFiltering = q.length > 0 || statusFilter !== '';

  const filteredGroups = groups.map((g) => ({
    ...g,
    tasks: g.tasks.filter((t) => {
      const matchesStatus = statusFilter === '' || t.status === statusFilter;
      const matchesQuery = q === '' || t.name.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    }),
  })).filter((g) => g.tasks.length > 0);

  const totalFiltered = filteredGroups.reduce((s, g) => s + g.tasks.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm task..."
            className="input-premium w-full pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-premium min-w-[120px]"
          aria-label="Lọc theo trạng thái"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        {isFiltering && (
          <button
            type="button"
            onClick={() => { setQuery(''); setStatusFilter(''); }}
            className="btn-premium text-xs py-1.5 px-3 text-danger border-danger/30 hover:bg-danger/5"
          >
            ✕ Xoá bộ lọc
          </button>
        )}
      </div>

      {isFiltering && (
        <p className="text-sm text-ink-muted">
          Tìm thấy <span className="font-semibold text-ink">{totalFiltered}</span> task
        </p>
      )}

      {/* Task list */}
      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface-raised p-12 text-center">
          <span className="text-4xl">🔍</span>
          <p className="text-ink-muted">Không tìm thấy task nào phù hợp</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredGroups.map((g) => {
            const containsCurrent = currentId ? g.tasks.some((t) => t.id === currentId) : false;
            // When filtering, show expanded always; otherwise use <details>
            return isFiltering ? (
              <div key={g.code} className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-ink-muted uppercase tracking-wider px-1">{g.title}</h3>
                <ul className="flex flex-col gap-4">
                  {g.tasks.map((row) => (
                    <TaskRow key={row.id} row={row} isCurrent={row.id === currentId} actions={<TaskActions row={row} />} />
                  ))}
                </ul>
              </div>
            ) : (
              <details key={g.code} open={containsCurrent} className="group rounded-2xl border border-line bg-surface shadow-sm overflow-hidden transition-all open:ring-1 open:ring-brand/20">
                <summary className="flex cursor-pointer items-center justify-between bg-surface-raised px-5 py-4 text-lg font-bold text-ink hover:bg-line/50 transition-colors select-none list-none">
                  {g.title}
                  <span className="text-ink-faint transition-transform duration-200 group-open:rotate-180">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </summary>
                <ul className="flex flex-col gap-4 p-5 bg-surface/50 border-t border-line">
                  {g.tasks.map((row) => (
                    <TaskRow key={row.id} row={row} isCurrent={row.id === currentId} actions={<TaskActions row={row} />} />
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
