-- T-004b "đã học đến đâu": thêm tùy chọn đánh dấu tiến độ lúc tạo plan, và RPC cập nhật tiến độ sau đó.
-- Xóa chữ ký create_plan cũ (6 tham số) để không tồn tại 2 bản trùng tên, tạo lại với tham số thứ 7.

drop function if exists public.create_plan(text, date, numeric, integer, boolean, text);

create or replace function public.create_plan(
  p_template_slug text,
  p_start_date date,
  p_hours_per_day numeric,
  p_days_per_week integer,
  p_include_optional boolean,
  p_timezone text default 'Asia/Ho_Chi_Minh',
  p_done_up_to_code text default null
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
  v_done_up_to_sort int;
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

  if p_done_up_to_code is not null then
    select sort into v_done_up_to_sort
    from public.template_tasks
    where template_id = v_template_id and code = p_done_up_to_code;

    if v_done_up_to_sort is null then
      raise exception 'Mã task không thuộc lộ trình này: %', p_done_up_to_code;
    end if;
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

  if v_done_up_to_sort is not null then
    update public.plan_task_state
    set status = 'done'
    where plan_id = v_plan_id
      and status = 'todo'
      and task_id in (
        select id from public.template_tasks
        where template_id = v_template_id and sort <= v_done_up_to_sort
      );
  end if;

  return v_plan_id;
end;
$$;

revoke all on function public.create_plan(text, date, numeric, integer, boolean, text, text) from public;
revoke all on function public.create_plan(text, date, numeric, integer, boolean, text, text) from anon;
grant execute on function public.create_plan(text, date, numeric, integer, boolean, text, text) to authenticated;

-- ========== Cập nhật tiến độ sau khi đã có plan ==========
-- Không nhận plan_id: tự suy plan của auth.uid() (v1 mỗi user chỉ có 1 plan), nên không có
-- cách nào truyền plan của người khác vào được — loại bỏ cả lớp lỗi đó bằng thiết kế thay vì kiểm tra.
create or replace function public.update_plan_progress(p_done_up_to_code text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_template_id uuid;
  v_target_sort int;
  v_updated int;
begin
  if v_user_id is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;

  select id, template_id into v_plan_id, v_template_id
  from public.plans
  where user_id = v_user_id;

  if v_plan_id is null then
    raise exception 'Bạn chưa có lộ trình';
  end if;

  select sort into v_target_sort
  from public.template_tasks
  where template_id = v_template_id and code = p_done_up_to_code;

  if v_target_sort is null then
    raise exception 'Mã task không thuộc lộ trình này: %', p_done_up_to_code;
  end if;

  update public.plan_task_state
  set status = 'done'
  where plan_id = v_plan_id
    and status in ('todo', 'in_progress')
    and task_id in (
      select id from public.template_tasks
      where template_id = v_template_id and sort <= v_target_sort
    );
  get diagnostics v_updated = row_count;

  return v_updated;
end;
$$;

revoke all on function public.update_plan_progress(text) from public;
revoke all on function public.update_plan_progress(text) from anon;
grant execute on function public.update_plan_progress(text) to authenticated;
