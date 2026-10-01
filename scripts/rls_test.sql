-- Kiểm thử RLS + RPC create_plan trên Supabase local (Postgres thật, schema auth + role
-- authenticated/service_role có sẵn, auth.uid() đọc từ request.jwt.claim.sub).
-- Mỗi khối DO ném lỗi nếu một chính sách sai. Cuối cùng in "RLS OK".
-- Chạy sau khi `npm run db:start` (hoặc `npx supabase start`) đã nạp migration + seed:
--   docker exec -i supabase_db_np3 psql -U postgres -d postgres < scripts/rls_test.sql
-- Script này ghi/đổi dữ liệu (tạo plan, đặt is_published=false), nên sau khi chạy cần
-- `npm run db:reset` để đưa DB về đúng dữ liệu seed trước khi dùng tiếp cho việc khác.
-- Lưu ý: psql KHÔNG thay thế biến `:'var'` bên trong khối $$ ... $$ (DO/function), nên mọi
-- tra cứu cần dùng trong plpgsql đều viết bằng subquery SQL thay vì biến psql.
\set ON_ERROR_STOP on
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b');

create or replace function pg_temp.as_user(u text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

-- ========== A tạo plan bằng RPC create_plan (bản gốc, không kèm optional) ==========
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_plan((select slug from templates limit 1), '2026-10-01', 2, 6, false, 'Asia/Ho_Chi_Minh');

do $$ begin
  if (select count(*) from plans) <> 1 then raise exception 'A phải thấy đúng 1 plan (của mình)'; end if;
  if (select count(*) from plan_task_state) <> 113 then raise exception 'A phải có đủ 113 plan_task_state, có %', (select count(*) from plan_task_state); end if;
  if (select count(*) from plan_resource_state) <> 10 then raise exception 'A phải có đủ 10 plan_resource_state'; end if;
  if (select count(*) from plan_task_state where status = 'skipped') = 0 then
    raise exception 'include_optional=false nên phải có task optional bị skipped';
  end if;
  if (select count(*) from plan_resource_state where opted_in = false) = 0 then
    raise exception 'Tài nguyên optional phải mặc định opted_in=false';
  end if;
end $$;

-- Gọi lần hai cho A: phải bị từ chối (v1 mỗi user chỉ một plan)
do $$ begin
  begin
    perform public.create_plan((select slug from templates limit 1), '2026-10-02', 3, 5, true, 'Asia/Ho_Chi_Minh');
    raise exception 'RÒ RỈ: A tạo được plan thứ hai';
  exception when others then
    if sqlerrm not like '%đã có một lộ trình%' then raise; end if;
  end;
end $$;

insert into push_subscriptions(user_id,endpoint,p256dh,auth_key) values ('00000000-0000-0000-0000-00000000000a','https://push.example/a','k','a');

-- ========== B không thấy, không sửa, không chèn được vào plan của A ==========
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ declare n int; v_a_plan uuid; begin
  if (select count(*) from plans) <> 0 then raise exception 'RÒ RỈ: B thấy plan của A'; end if;
  if (select count(*) from plan_task_state) <> 0 then raise exception 'RÒ RỈ: B thấy trạng thái của A'; end if;
  if (select count(*) from push_subscriptions) <> 0 then raise exception 'RÒ RỈ: B thấy push của A'; end if;
  update plan_task_state set status='done'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RÒ RỈ: B sửa được trạng thái của A'; end if;
  -- B không thấy plans của A qua RLS nên select này trả null; ép kiểu trực tiếp để test chèn vẫn hợp lệ cú pháp
  select id into v_a_plan from plans limit 1; -- luôn null dưới RLS của B, nhưng câu insert vẫn phải bị chặn
  begin
    insert into plan_task_state(plan_id,task_id,status)
      select coalesce(v_a_plan, '11111111-1111-1111-1111-111111111111'::uuid), id, 'done' from template_tasks limit 1;
    raise exception 'RÒ RỈ: B chèn được vào bảng plan_task_state dù không sở hữu plan';
  exception when insufficient_privilege then null; end;
end $$;

-- B gọi create_plan: không có cách nào mạo danh A vì hàm chỉ dùng auth.uid(), không nhận user_id.
-- Plan tạo ra phải thuộc về B, và plan của A phải còn nguyên 1.
select public.create_plan((select slug from templates limit 1), '2026-10-01', 1, 7, true, 'Asia/Ho_Chi_Minh');
do $$ begin
  if (select user_id from plans where user_id = '00000000-0000-0000-0000-00000000000b') <> '00000000-0000-0000-0000-00000000000b' then
    raise exception 'RÒ RỈ: plan của B lại gán cho người khác';
  end if;
  if (select count(*) from plan_task_state where status = 'skipped') <> 0 then
    raise exception 'B gọi include_optional=true nên không được có task skipped';
  end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from plans where user_id = '00000000-0000-0000-0000-00000000000a') <> 1 then
    raise exception 'RÒ RỈ: số plan của A bị đổi sau khi B gọi create_plan';
  end if;
end $$;

-- ========== anon không được gọi create_plan (đã REVOKE) ==========
set role anon;
do $$ begin
  begin
    perform public.create_plan('x', '2026-10-01', 2, 6, false, 'Asia/Ho_Chi_Minh');
    raise exception 'RÒ RỈ: anon gọi được create_plan';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ========== Người dùng không được ghi danh mục, không được tự chèn reminders/ai_usage ==========
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ declare v_b_plan uuid; begin
  select id into v_b_plan from plans where user_id = '00000000-0000-0000-0000-00000000000b';
  begin insert into templates(slug,title,version) values ('x','x','1'); raise exception 'RÒ RỈ: người dùng ghi được templates';
  exception when insufficient_privilege then null; end;
  begin insert into reminders(user_id,plan_id,kind,dedupe_key,fire_at,title,body)
        values ('00000000-0000-0000-0000-00000000000b', v_b_plan,'study_daily','k',now(),'t','b');
        raise exception 'RÒ RỈ: người dùng tự chèn reminders';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ========== Template chưa xuất bản thì người dùng không đọc được ==========
update templates set is_published=false;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from template_tasks) <> 0 then raise exception 'RÒ RỈ: đọc được template chưa xuất bản'; end if;
end $$;
reset role;
\echo RLS OK
