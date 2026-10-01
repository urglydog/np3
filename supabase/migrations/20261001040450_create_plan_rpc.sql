-- RPC tạo plan trong một transaction (plans + plan_task_state + plan_resource_state).
-- SECURITY INVOKER: RLS vẫn áp dụng như người gọi bình thường; không có đường vòng qua RLS.
-- v1: mỗi user chỉ có một plan (ràng buộc ở cả mức hàm lẫn unique index để an toàn khi gọi đồng thời).

create unique index if not exists plans_user_unique_idx on public.plans(user_id);

create or replace function public.create_plan(
  p_template_slug text,
  p_start_date date,
  p_hours_per_day numeric,
  p_days_per_week integer,
  p_include_optional boolean,
  p_timezone text default 'Asia/Ho_Chi_Minh'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_plan_id uuid;
begin
  if v_user_id is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;

  if p_hours_per_day is null or p_hours_per_day <= 0 or p_hours_per_day > 16 then
    raise exception 'Giờ học mỗi ngày phải trong khoảng (0, 16]';
  end if;

  if p_days_per_week is null or p_days_per_week < 1 or p_days_per_week > 7 then
    raise exception 'Số ngày học mỗi tuần phải từ 1 đến 7';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Múi giờ không hợp lệ: %', p_timezone;
  end if;

  select id into v_template_id
  from public.templates
  where slug = p_template_slug and is_published = true;

  if v_template_id is null then
    raise exception 'Không tìm thấy template đã xuất bản: %', p_template_slug;
  end if;

  if exists (select 1 from public.plans where user_id = v_user_id) then
    raise exception 'Bạn đã có một lộ trình, chưa hỗ trợ nhiều lộ trình ở phiên bản này';
  end if;

  insert into public.plans (user_id, template_id, start_date, hours_per_day, days_per_week, include_optional, timezone)
  values (v_user_id, v_template_id, p_start_date, p_hours_per_day, p_days_per_week, p_include_optional, p_timezone)
  returning id into v_plan_id;

  insert into public.plan_task_state (plan_id, task_id, status)
  select
    v_plan_id,
    tt.id,
    case when tt.optional and not p_include_optional then 'skipped' else 'todo' end
  from public.template_tasks tt
  where tt.template_id = v_template_id;

  insert into public.plan_resource_state (plan_id, resource_id, status, opted_in)
  select
    v_plan_id,
    tr.id,
    'none',
    case when tr.tier = 'optional' then false else true end
  from public.template_resources tr
  where tr.template_id = v_template_id;

  return v_plan_id;
end;
$$;

revoke all on function public.create_plan(text, date, numeric, integer, boolean, text) from public;
revoke all on function public.create_plan(text, date, numeric, integer, boolean, text) from anon;
grant execute on function public.create_plan(text, date, numeric, integer, boolean, text) to authenticated;
