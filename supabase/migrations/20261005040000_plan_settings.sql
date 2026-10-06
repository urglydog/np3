-- T-009: Cài đặt nâng cao (giờ nhắc, giờ yên tĩnh, ngày nghỉ)
-- Không làm ảnh hưởng đến cấu trúc lịch hiện tại (days_per_week vẫn giữ nguyên để tính toán tổng quát).

alter table plans
add column reminder_time time not null default '20:00',
add column quiet_hours_start time not null default '22:00',
add column quiet_hours_end time not null default '07:00',
add column rest_days smallint[] not null default '{}';

-- Cập nhật RPC khôi phục sao lưu để import các cấu hình mới
create or replace function import_user_plan(p_json jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  v_plan_id     uuid;
  v_template_id uuid;
  v_task        jsonb;
  v_res         jsonb;
begin
  if (p_json ->> 'version')::int != 1 then
    raise exception 'Phiên bản file sao lưu không hỗ trợ: %', p_json ->> 'version';
  end if;

  v_template_id := (p_json -> 'plan' ->> 'template_id')::uuid;
  if not exists (select 1 from templates where id = v_template_id and is_published) then
    raise exception 'Template % không tồn tại hoặc chưa xuất bản.', v_template_id;
  end if;

  delete from plans where user_id = auth.uid();

  v_plan_id := (p_json -> 'plan' ->> 'id')::uuid;
  insert into plans (id, user_id, template_id, start_date, hours_per_day, days_per_week, include_optional, timezone, created_at, reminder_time, quiet_hours_start, quiet_hours_end, rest_days)
  values (
    v_plan_id,
    auth.uid(),
    v_template_id,
    (p_json -> 'plan' ->> 'start_date')::date,
    (p_json -> 'plan' ->> 'hours_per_day')::numeric,
    (p_json -> 'plan' ->> 'days_per_week')::smallint,
    (p_json -> 'plan' ->> 'include_optional')::boolean,
    p_json -> 'plan' ->> 'timezone',
    coalesce((p_json -> 'plan' ->> 'created_at')::timestamptz, now()),
    coalesce((p_json -> 'plan' ->> 'reminder_time')::time, '20:00'),
    coalesce((p_json -> 'plan' ->> 'quiet_hours_start')::time, '22:00'),
    coalesce((p_json -> 'plan' ->> 'quiet_hours_end')::time, '07:00'),
    coalesce(
      (select array_agg(value::text::smallint) from jsonb_array_elements(p_json -> 'plan' -> 'rest_days')),
      '{}'::smallint[]
    )
  );

  for v_task in select * from jsonb_array_elements(p_json -> 'task_states') loop
    if exists (select 1 from template_tasks where id = (v_task ->> 'task_id')::uuid and template_id = v_template_id) then
      insert into plan_task_state (plan_id, task_id, status, writing_reps, kana_accuracy, speaking_minutes, pinned_start, done_on)
      values (
        v_plan_id,
        (v_task ->> 'task_id')::uuid,
        coalesce(v_task ->> 'status', 'todo'),
        coalesce((v_task ->> 'writing_reps')::int, 0),
        case when v_task ->> 'kana_accuracy' is null then null else (v_task ->> 'kana_accuracy')::numeric end,
        coalesce((v_task ->> 'speaking_minutes')::int, 0),
        case when v_task ->> 'pinned_start' is null then null else (v_task ->> 'pinned_start')::date end,
        case when v_task ->> 'done_on' is null then null else (v_task ->> 'done_on')::date end
      )
      on conflict (plan_id, task_id) do update
        set status = excluded.status, writing_reps = excluded.writing_reps, kana_accuracy = excluded.kana_accuracy,
            speaking_minutes = excluded.speaking_minutes, pinned_start = excluded.pinned_start, done_on = excluded.done_on, updated_at = now();
    end if;
  end loop;

  for v_res in select * from jsonb_array_elements(p_json -> 'resource_states') loop
    if exists (select 1 from template_resources where id = (v_res ->> 'resource_id')::uuid and template_id = v_template_id) then
      insert into plan_resource_state (plan_id, resource_id, status, opted_in, ordered_on, eta)
      values (
        v_plan_id,
        (v_res ->> 'resource_id')::uuid,
        coalesce(v_res ->> 'status', 'none'),
        coalesce((v_res ->> 'opted_in')::boolean, true),
        case when v_res ->> 'ordered_on' is null then null else (v_res ->> 'ordered_on')::date end,
        case when v_res ->> 'eta' is null then null else (v_res ->> 'eta')::date end
      )
      on conflict (plan_id, resource_id) do update
        set status = excluded.status, opted_in = excluded.opted_in, ordered_on = excluded.ordered_on, eta = excluded.eta;
    end if;
  end loop;
end;
$$;
