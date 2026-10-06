-- T-008: RPC khôi phục sao lưu (import_user_plan).
-- Chạy trong 1 transaction: xóa plan cũ → insert mới → insert states.
-- SECURITY INVOKER: chạy với quyền của người gọi (RLS tự áp), không thể dùng để ghi đè plan người khác.

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
  -- 1. Kiểm tra version của file sao lưu
  if (p_json ->> 'version')::int != 1 then
    raise exception 'Phiên bản file sao lưu không hỗ trợ: %', p_json ->> 'version';
  end if;

  -- 2. Lấy template_id từ file và kiểm tra template đó còn tồn tại
  v_template_id := (p_json -> 'plan' ->> 'template_id')::uuid;
  if not exists (select 1 from templates where id = v_template_id and is_published) then
    raise exception 'Template % không tồn tại hoặc chưa xuất bản.', v_template_id;
  end if;

  -- 3. Xóa plan cũ của user hiện tại (CASCADE tự xóa plan_task_state, plan_resource_state)
  delete from plans where user_id = auth.uid();

  -- 4. Insert plan mới (dùng id từ file để giữ nguyên liên kết)
  v_plan_id := (p_json -> 'plan' ->> 'id')::uuid;
  insert into plans (id, user_id, template_id, start_date, hours_per_day, days_per_week, include_optional, timezone, created_at)
  values (
    v_plan_id,
    auth.uid(),
    v_template_id,
    (p_json -> 'plan' ->> 'start_date')::date,
    (p_json -> 'plan' ->> 'hours_per_day')::numeric,
    (p_json -> 'plan' ->> 'days_per_week')::smallint,
    (p_json -> 'plan' ->> 'include_optional')::boolean,
    p_json -> 'plan' ->> 'timezone',
    coalesce((p_json -> 'plan' ->> 'created_at')::timestamptz, now())
  );

  -- 5. Insert task states (chỉ task thuộc template đó)
  for v_task in select * from jsonb_array_elements(p_json -> 'task_states')
  loop
    -- Bỏ qua task_id không thuộc template (tránh lỗi FK nếu file sao lưu từ template khác)
    if exists (
      select 1 from template_tasks
      where id = (v_task ->> 'task_id')::uuid and template_id = v_template_id
    ) then
      insert into plan_task_state
        (plan_id, task_id, status, writing_reps, kana_accuracy, speaking_minutes, pinned_start, done_on)
      values (
        v_plan_id,
        (v_task ->> 'task_id')::uuid,
        coalesce(v_task ->> 'status', 'todo'),
        coalesce((v_task ->> 'writing_reps')::int, 0),
        case when v_task ->> 'kana_accuracy' is null then null
             else (v_task ->> 'kana_accuracy')::numeric end,
        coalesce((v_task ->> 'speaking_minutes')::int, 0),
        case when v_task ->> 'pinned_start' is null then null
             else (v_task ->> 'pinned_start')::date end,
        case when v_task ->> 'done_on' is null then null
             else (v_task ->> 'done_on')::date end
      )
      on conflict (plan_id, task_id) do update
        set status           = excluded.status,
            writing_reps     = excluded.writing_reps,
            kana_accuracy    = excluded.kana_accuracy,
            speaking_minutes = excluded.speaking_minutes,
            pinned_start     = excluded.pinned_start,
            done_on          = excluded.done_on,
            updated_at       = now();
    end if;
  end loop;

  -- 6. Insert resource states (chỉ resource thuộc template đó)
  for v_res in select * from jsonb_array_elements(p_json -> 'resource_states')
  loop
    if exists (
      select 1 from template_resources
      where id = (v_res ->> 'resource_id')::uuid and template_id = v_template_id
    ) then
      insert into plan_resource_state
        (plan_id, resource_id, status, opted_in, ordered_on, eta)
      values (
        v_plan_id,
        (v_res ->> 'resource_id')::uuid,
        coalesce(v_res ->> 'status', 'none'),
        coalesce((v_res ->> 'opted_in')::boolean, true),
        case when v_res ->> 'ordered_on' is null then null
             else (v_res ->> 'ordered_on')::date end,
        case when v_res ->> 'eta' is null then null
             else (v_res ->> 'eta')::date end
      )
      on conflict (plan_id, resource_id) do update
        set status     = excluded.status,
            opted_in   = excluded.opted_in,
            ordered_on = excluded.ordered_on,
            eta        = excluded.eta;
    end if;
  end loop;
end;
$$;

-- RLS: SECURITY INVOKER đủ bảo vệ (chạy với quyền auth.uid()); không cần policy riêng.
-- Nhưng cần revoke public để người chưa đăng nhập không gọi được.
revoke execute on function import_user_plan(jsonb) from public;
grant execute on function import_user_plan(jsonb) to authenticated;
