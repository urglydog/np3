-- Kiểm thử RLS trên Supabase local (Postgres thật, schema auth + role authenticated/service_role có sẵn,
-- auth.uid() đọc từ request.jwt.claim.sub). Mỗi khối DO ném lỗi nếu một chính sách sai. Cuối cùng in "RLS OK".
-- Chạy sau khi `npm run db:start` (hoặc `npx supabase start`) đã nạp migration + seed:
--   docker exec -i supabase_db_np3 psql -U postgres -d postgres < scripts/rls_test.sql
-- Script này ghi/đổi dữ liệu (tạo plan, đặt is_published=false), nên sau khi chạy cần
-- `npm run db:reset` để đưa DB về đúng dữ liệu seed trước khi dùng tiếp cho việc khác.
\set ON_ERROR_STOP on
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b');

create or replace function pg_temp.as_user(u text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

-- User A tạo plan + trạng thái + đăng ký push
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into plans(id,user_id,template_id,start_date,hours_per_day,days_per_week)
  select '11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a',id,'2026-10-01',2,6 from templates limit 1;
insert into plan_task_state(plan_id,task_id,status) select '11111111-1111-1111-1111-111111111111', id,'done' from template_tasks limit 3;
insert into push_subscriptions(user_id,endpoint,p256dh,auth_key) values ('00000000-0000-0000-0000-00000000000a','https://push.example/a','k','a');

do $$ begin
  if (select count(*) from plans) <> 1 then raise exception 'A phải thấy plan của mình'; end if;
  if (select count(*) from plan_task_state) <> 3 then raise exception 'A phải thấy 3 trạng thái của mình'; end if;
  if (select count(*) from template_tasks) = 0 then raise exception 'A phải đọc được template đã xuất bản'; end if;
end $$;

-- User B không thấy, không sửa được, không chèn được vào plan của A
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ declare n int; begin
  if (select count(*) from plans) <> 0 then raise exception 'RÒ RỈ: B thấy plan của A'; end if;
  if (select count(*) from plan_task_state) <> 0 then raise exception 'RÒ RỈ: B thấy trạng thái của A'; end if;
  if (select count(*) from push_subscriptions) <> 0 then raise exception 'RÒ RỈ: B thấy push của A'; end if;
  update plan_task_state set status='skipped'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RÒ RỈ: B sửa được trạng thái của A'; end if;
  begin
    insert into plan_task_state(plan_id,task_id,status) select '11111111-1111-1111-1111-111111111111', id,'done' from template_tasks limit 1;
    raise exception 'RÒ RỈ: B chèn được vào plan của A';
  exception when insufficient_privilege then null; end;
  begin
    insert into plans(user_id,template_id,start_date,hours_per_day,days_per_week)
      select '00000000-0000-0000-0000-00000000000a',id,'2026-10-01',2,6 from templates limit 1;
    raise exception 'RÒ RỈ: B tạo plan mạo danh A';
  exception when insufficient_privilege then null; end;
end $$;

-- Người dùng không được ghi danh mục, không được tự chèn reminders/ai_usage
do $$ begin
  begin insert into templates(slug,title,version) values ('x','x','1'); raise exception 'RÒ RỈ: người dùng ghi được templates';
  exception when insufficient_privilege then null; end;
  begin insert into reminders(user_id,plan_id,kind,dedupe_key,fire_at,title,body)
        values ('00000000-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111','study_daily','k',now(),'t','b');
        raise exception 'RÒ RỈ: người dùng tự chèn reminders';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Template chưa xuất bản thì người dùng không đọc được
update templates set is_published=false;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from template_tasks) <> 0 then raise exception 'RÒ RỈ: đọc được template chưa xuất bản'; end if;
end $$;
reset role;
\echo RLS OK
