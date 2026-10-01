-- T-008 Sao lưu: nhập lại bản sao lưu, GHI ĐÈ toàn bộ plan hiện có của user (nếu có) trong 1 transaction.
-- Payload đã qua zod ở phía client để có thông báo lỗi rõ ràng; hàm này vẫn tự kiểm tra lại đầy đủ
-- (không tin client), vì đây là biên ghi dữ liệu thật — sai ở đâu thì từ chối NGUYÊN KHỐI ở đó,
-- không ghi dở (mọi lệnh trong 1 lần gọi hàm đã nằm trong cùng 1 transaction của Postgres).

create or replace function public.import_plan_backup(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_template_slug text;
  v_plan_id uuid;
  v_start_date date;
  v_hours_per_day numeric;
  v_days_per_week int;
  v_include_optional boolean;
  v_timezone text;
  v_task jsonb;
  v_resource jsonb;
  v_bad_task_count int;
  v_bad_resource_count int;
begin
  if v_user_id is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Bản sao lưu không hợp lệ: thiếu dữ liệu';
  end if;

  if p_payload->>'format' is distinct from 'roadmap-backup' then
    raise exception 'Bản sao lưu không đúng định dạng (format)';
  end if;
  if (p_payload->>'version') is distinct from '1' then
    raise exception 'Phiên bản bản sao lưu không được hỗ trợ: %', p_payload->>'version';
  end if;

  v_template_slug := p_payload->'template'->>'slug';
  if v_template_slug is null then
    raise exception 'Bản sao lưu thiếu template.slug';
  end if;

  select id into v_template_id from public.templates where slug = v_template_slug and is_published = true;
  if v_template_id is null then
    raise exception 'Template trong bản sao lưu không tồn tại hoặc chưa xuất bản: %', v_template_slug;
  end if;

  v_start_date := nullif(p_payload->'plan'->>'start_date', '')::date;
  v_hours_per_day := nullif(p_payload->'plan'->>'hours_per_day', '')::numeric;
  v_days_per_week := nullif(p_payload->'plan'->>'days_per_week', '')::int;
  v_include_optional := nullif(p_payload->'plan'->>'include_optional', '')::boolean;
  v_timezone := coalesce(nullif(p_payload->'plan'->>'timezone', ''), 'Asia/Ho_Chi_Minh');

  if v_start_date is null then raise exception 'Bản sao lưu thiếu plan.start_date hợp lệ'; end if;
  if v_hours_per_day is null or v_hours_per_day <= 0 or v_hours_per_day > 16 then
    raise exception 'Giờ học mỗi ngày trong bản sao lưu không hợp lệ';
  end if;
  if v_days_per_week is null or v_days_per_week < 1 or v_days_per_week > 7 then
    raise exception 'Số ngày học mỗi tuần trong bản sao lưu không hợp lệ';
  end if;
  if v_include_optional is null then raise exception 'Bản sao lưu thiếu plan.include_optional hợp lệ'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Múi giờ trong bản sao lưu không hợp lệ: %', v_timezone;
  end if;

  -- Kiểm tra TOÀN BỘ mã task/resource thuộc đúng template TRƯỚC khi ghi gì (để từ chối nguyên khối).
  select count(*) into v_bad_task_count
  from jsonb_array_elements(coalesce(p_payload->'tasks', '[]'::jsonb)) t
  where not exists (
    select 1 from public.template_tasks tt where tt.template_id = v_template_id and tt.code = t->>'code'
  );
  if v_bad_task_count > 0 then
    raise exception 'Có % mã task không thuộc template của bản sao lưu', v_bad_task_count;
  end if;

  select count(*) into v_bad_resource_count
  from jsonb_array_elements(coalesce(p_payload->'resources', '[]'::jsonb)) r
  where not exists (
    select 1 from public.template_resources tr where tr.template_id = v_template_id and tr.code = r->>'code'
  );
  if v_bad_resource_count > 0 then
    raise exception 'Có % mã tài nguyên không thuộc template của bản sao lưu', v_bad_resource_count;
  end if;

  -- Thay thế toàn bộ plan hiện có của user (cascade xoá plan_task_state/plan_resource_state theo FK).
  delete from public.plans where user_id = v_user_id;

  insert into public.plans (user_id, template_id, start_date, hours_per_day, days_per_week, include_optional, timezone)
  values (v_user_id, v_template_id, v_start_date, v_hours_per_day, v_days_per_week, v_include_optional, v_timezone)
  returning id into v_plan_id;

  insert into public.plan_task_state (plan_id, task_id, status)
  select v_plan_id, tt.id, 'todo' from public.template_tasks tt where tt.template_id = v_template_id;

  for v_task in select * from jsonb_array_elements(coalesce(p_payload->'tasks', '[]'::jsonb))
  loop
    update public.plan_task_state pts
    set status = v_task->>'status',
        writing_reps = coalesce((v_task->>'writing_reps')::int, 0),
        kana_accuracy = nullif(v_task->>'kana_accuracy', '')::numeric,
        speaking_minutes = coalesce((v_task->>'speaking_minutes')::int, 0),
        pinned_start = nullif(v_task->>'pinned_start', '')::date,
        done_on = nullif(v_task->>'done_on', '')::date
    from public.template_tasks tt
    where pts.plan_id = v_plan_id and pts.task_id = tt.id and tt.template_id = v_template_id and tt.code = v_task->>'code';
  end loop;

  insert into public.plan_resource_state (plan_id, resource_id, status, opted_in)
  select v_plan_id, tr.id, 'none', (tr.tier = 'core') from public.template_resources tr where tr.template_id = v_template_id;

  for v_resource in select * from jsonb_array_elements(coalesce(p_payload->'resources', '[]'::jsonb))
  loop
    update public.plan_resource_state prs
    set status = v_resource->>'status',
        opted_in = coalesce((v_resource->>'opted_in')::boolean, prs.opted_in),
        ordered_on = nullif(v_resource->>'ordered_on', '')::date,
        eta = nullif(v_resource->>'eta', '')::date
    from public.template_resources tr
    where prs.plan_id = v_plan_id and prs.resource_id = tr.id and tr.template_id = v_template_id and tr.code = v_resource->>'code';
  end loop;

  return v_plan_id;
end;
$$;

revoke all on function public.import_plan_backup(jsonb) from public;
revoke all on function public.import_plan_backup(jsonb) from anon;
grant execute on function public.import_plan_backup(jsonb) to authenticated;
