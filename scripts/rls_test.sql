-- Kiểm thử RLS + RPC create_plan/update_plan_progress trên Supabase local (Postgres thật, schema auth
-- + role authenticated/service_role có sẵn, auth.uid() đọc từ request.jwt.claim.sub).
-- Mỗi khối DO ném lỗi nếu một chính sách sai. Cuối cùng in "RLS OK".
-- Chạy sau khi `npm run db:start` (hoặc `npx supabase start`) đã nạp migration + seed:
--   docker exec -i supabase_db_np3 psql -U postgres -d postgres < scripts/rls_test.sql
-- Script này ghi/đổi dữ liệu (tạo plan, đặt is_published=false), nên sau khi chạy cần
-- `npm run db:reset` để đưa DB về đúng dữ liệu seed trước khi dùng tiếp cho việc khác.
-- Lưu ý: psql KHÔNG thay thế biến `:'var'` bên trong khối $$ ... $$ (DO/function), nên mọi
-- tra cứu cần dùng trong plpgsql đều viết bằng subquery SQL thay vì biến psql.
\set ON_ERROR_STOP on
insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'); -- C: không tạo plan, dùng để test "chưa có lộ trình"

create or replace function pg_temp.as_user(u text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;

-- ========== Chữ ký hàm: đúng mỗi hàm 1 bản, không còn chữ ký cũ trùng tên ==========
do $$ declare n int; begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'create_plan';
  if n <> 1 then raise exception 'Phải có đúng 1 hàm public.create_plan, hiện có %', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'update_plan_progress';
  if n <> 1 then raise exception 'Phải có đúng 1 hàm public.update_plan_progress, hiện có %', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'import_plan_backup';
  if n <> 1 then raise exception 'Phải có đúng 1 hàm public.import_plan_backup, hiện có %', n; end if;
end $$;

-- ========== A tạo plan bằng RPC create_plan, kèm "đã học xong đến hết task thứ 5" ==========
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_plan(
  (select slug from templates where is_published = true limit 1),
  '2026-10-01', 2, 6, false, 'Asia/Ho_Chi_Minh',
  (select tt.code from template_tasks tt where tt.template_id = (select id from templates where is_published = true limit 1) order by tt.sort limit 1 offset 4)
);

do $$ declare v_template_id uuid; v_expected_done int; begin
  select template_id into v_template_id from plans where user_id = '00000000-0000-0000-0000-00000000000a';

  if (select count(*) from plan_task_state) <> 113 then raise exception 'A phải có đủ 113 plan_task_state'; end if;
  if (select count(*) from plan_resource_state) <> 10 then raise exception 'A phải có đủ 10 plan_resource_state'; end if;

  select count(*) into v_expected_done from template_tasks
    where template_id = v_template_id and optional = false
      and sort <= (select sort from template_tasks where template_id = v_template_id order by sort limit 1 offset 4);

  if (select count(*) from plan_task_state where status = 'done') <> v_expected_done then
    raise exception 'create_plan: số task done lúc tạo phải = %, có %', v_expected_done, (select count(*) from plan_task_state where status = 'done');
  end if;
  if exists (select 1 from plan_task_state where status = 'done' and done_on is not null) then
    raise exception 'create_plan: task done lúc tạo KHÔNG được có done_on (không bịa lịch sử)';
  end if;
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
    perform public.create_plan((select slug from templates where is_published = true limit 1), '2026-10-02', 3, 5, true, 'Asia/Ho_Chi_Minh');
    raise exception 'RÒ RỈ: A tạo được plan thứ hai';
  exception when others then
    if sqlerrm not like '%đã có một lộ trình%' then raise; end if;
  end;
end $$;

-- ========== update_plan_progress: mở rộng tiến độ của A tới task thứ 10, gọi 2 lần ==========
do $$ declare
  v_template_id uuid; v_target_sort int; v_expected_total_done int;
  v_ret1 int; v_ret2 int; v_before_done int;
begin
  select template_id into v_template_id from plans where user_id = '00000000-0000-0000-0000-00000000000a';
  select sort into v_target_sort from template_tasks where template_id = v_template_id order by sort limit 1 offset 9; -- task thứ 10

  select count(*) into v_before_done from plan_task_state pts
    join plans p on p.id = pts.plan_id
    where p.user_id = '00000000-0000-0000-0000-00000000000a' and pts.status = 'done';

  select count(*) into v_expected_total_done from template_tasks
    where template_id = v_template_id and optional = false and sort <= v_target_sort;

  select public.update_plan_progress((select code from template_tasks where template_id = v_template_id and sort = v_target_sort)) into v_ret1;
  if v_ret1 <> (v_expected_total_done - v_before_done) then
    raise exception 'update_plan_progress lần 1: trả về % nhưng phải đổi %', v_ret1, (v_expected_total_done - v_before_done);
  end if;
  if (select count(*) from plan_task_state pts join plans p on p.id = pts.plan_id
      where p.user_id = '00000000-0000-0000-0000-00000000000a' and pts.status = 'done') <> v_expected_total_done then
    raise exception 'Tổng số done sau update_plan_progress không khớp';
  end if;

  -- gọi lần 2 với cùng mã: không còn hàng todo/in_progress nào thỏa điều kiện -> đổi 0 hàng
  select public.update_plan_progress((select code from template_tasks where template_id = v_template_id and sort = v_target_sort)) into v_ret2;
  if v_ret2 <> 0 then raise exception 'Gọi update_plan_progress lần 2 cùng mã phải trả về 0, có %', v_ret2; end if;
end $$;

-- Mã task không tồn tại -> bị từ chối
do $$ begin
  begin
    perform public.update_plan_progress('MÃ-KHÔNG-TỒN-TẠI');
    raise exception 'RÒ RỈ: update_plan_progress chấp nhận mã task không tồn tại';
  exception when others then
    if sqlerrm not like '%không thuộc lộ trình này%' then raise; end if;
  end;
end $$;

-- ========== Mã task thuộc TEMPLATE KHÁC bị từ chối (chèn template thứ hai để chứng minh thật) ==========
reset role; -- cần quyền ghi danh mục (RLS chỉ cho service/superuser ghi templates)
insert into templates (slug, title, version, is_published) values ('tpl-khac-tam-thoi', 'Template khác (tạm, để test)', '0.0.1', true);
insert into template_phases (template_id, code, title, sort)
  values ((select id from templates where slug = 'tpl-khac-tam-thoi'), 'ph-x', 'Phase X', 1);
insert into template_tasks (template_id, phase_id, code, name, est_hours, sort)
  values (
    (select id from templates where slug = 'tpl-khac-tam-thoi'),
    (select id from template_phases where template_id = (select id from templates where slug = 'tpl-khac-tam-thoi')),
    'TPL-X-01', 'Task của template khác', 1, 1
  );

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    perform public.update_plan_progress('TPL-X-01');
    raise exception 'RÒ RỈ: update_plan_progress chấp nhận mã task thuộc template khác';
  exception when others then
    if sqlerrm not like '%không thuộc lộ trình này%' then raise; end if;
  end;
end $$;
reset role;
delete from template_tasks where code = 'TPL-X-01';
delete from template_phases where code = 'ph-x' and template_id = (select id from templates where slug = 'tpl-khac-tam-thoi');
delete from templates where slug = 'tpl-khac-tam-thoi';

-- ========== C chưa có plan: update_plan_progress phải từ chối đúng thông báo ==========
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin
    perform public.update_plan_progress((select code from template_tasks limit 1));
    raise exception 'RÒ RỈ: update_plan_progress chạy được cho user chưa có plan';
  exception when others then
    if sqlerrm not like '%chưa có lộ trình%' then raise; end if;
  end;
end $$;
reset role;

insert into push_subscriptions(user_id,endpoint,p256dh,auth_key) values ('00000000-0000-0000-0000-00000000000a','https://push.example/a','k','a');

-- ========== B không thấy, không sửa, không chèn được vào plan của A ==========
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ declare n int; v_a_plan uuid; begin
  if (select count(*) from plans) <> 0 then raise exception 'RÒ RỈ: B thấy plan của A'; end if;
  if (select count(*) from plan_task_state) <> 0 then raise exception 'RÒ RỈ: B thấy trạng thái của A'; end if;
  if (select count(*) from push_subscriptions) <> 0 then raise exception 'RÒ RỈ: B thấy push của A'; end if;
  update plan_task_state set status='done'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RÒ RỈ: B sửa được trạng thái của A'; end if;
  select id into v_a_plan from plans limit 1; -- luôn null dưới RLS của B
  begin
    insert into plan_task_state(plan_id,task_id,status)
      select coalesce(v_a_plan, '11111111-1111-1111-1111-111111111111'::uuid), id, 'done' from template_tasks limit 1;
    raise exception 'RÒ RỈ: B chèn được vào bảng plan_task_state dù không sở hữu plan';
  exception when insufficient_privilege then null; end;
end $$;

-- B gọi create_plan: không có cách nào mạo danh A vì hàm chỉ dùng auth.uid(), không nhận user_id.
select public.create_plan((select slug from templates where is_published = true limit 1), '2026-10-01', 1, 7, true, 'Asia/Ho_Chi_Minh');

-- B gọi update_plan_progress: hàm không nhận plan_id nên chỉ có thể tự tác động plan của chính B.
-- Đo trước/sau bằng bảng tạm (vì chỉ role có quyền xem hết, tức superuser, mới đếm đúng dữ liệu của A).
reset role;
do $$ declare v_before int; begin
  create temporary table if not exists tmp_counts(k text primary key, v int);
  select count(*) into v_before from plan_task_state pts join plans p on p.id = pts.plan_id
    where p.user_id = '00000000-0000-0000-0000-00000000000a' and pts.status = 'done';
  insert into tmp_counts(k,v) values ('a_done_before_b_call', v_before)
    on conflict (k) do update set v = excluded.v;
end $$;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  perform public.update_plan_progress((select tt.code from template_tasks tt join plans p on p.template_id = tt.template_id
    where p.user_id = '00000000-0000-0000-0000-00000000000b' order by tt.sort limit 1 offset 2));
end $$;
reset role;

do $$ declare v_before int; v_after int; begin
  select v into v_before from tmp_counts where k = 'a_done_before_b_call';
  select count(*) into v_after from plan_task_state pts join plans p on p.id = pts.plan_id
    where p.user_id = '00000000-0000-0000-0000-00000000000a' and pts.status = 'done';
  if v_after <> v_before then raise exception 'RÒ RỈ: update_plan_progress của B làm đổi dữ liệu của A'; end if;
end $$;

-- ========== import_plan_backup: A ghi đè plan của chính mình, không đụng B ==========
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ declare
  v_template_id uuid; v_task1_code text; v_task2_code text; v_res_code text; v_payload jsonb;
  v_plan_id_1 uuid; v_plan_id_2 uuid; v_task1_id uuid;
begin
  select id into v_template_id from templates where is_published = true limit 1;
  select code into v_task1_code from template_tasks where template_id = v_template_id order by sort limit 1;
  select code into v_task2_code from template_tasks where template_id = v_template_id order by sort limit 1 offset 1;
  select code into v_res_code from template_resources where template_id = v_template_id limit 1;

  v_payload := jsonb_build_object(
    'format', 'roadmap-backup', 'version', 1,
    'template', jsonb_build_object('slug', (select slug from templates where id = v_template_id), 'version', '4.2'),
    'plan', jsonb_build_object('start_date','2026-10-01','hours_per_day',2,'days_per_week',6,'include_optional',false,'timezone','Asia/Ho_Chi_Minh'),
    'tasks', jsonb_build_array(
      jsonb_build_object('code', v_task1_code, 'status','done','writing_reps',100,'kana_accuracy',0.9,'speaking_minutes',10,'pinned_start',null,'done_on','2026-10-02'),
      jsonb_build_object('code', v_task2_code, 'status','skipped','writing_reps',0,'kana_accuracy',null,'speaking_minutes',0,'pinned_start',null,'done_on',null)
    ),
    'resources', jsonb_build_array(jsonb_build_object('code', v_res_code, 'status','owned','opted_in',true,'ordered_on',null,'eta',null))
  );

  select public.import_plan_backup(v_payload) into v_plan_id_1;

  select tt.id into v_task1_id from template_tasks tt where tt.template_id = v_template_id and tt.code = v_task1_code;
  if (select status from plan_task_state where plan_id = v_plan_id_1 and task_id = v_task1_id) <> 'done' then
    raise exception 'import_plan_backup: task 1 phải thành done';
  end if;
  if (select writing_reps from plan_task_state where plan_id = v_plan_id_1 and task_id = v_task1_id) <> 100 then
    raise exception 'import_plan_backup: writing_reps phải lưu đúng 100';
  end if;

  -- Gọi lại lần 2 với CÙNG payload: phải ra cùng kết quả (idempotent), dù plan_id vật lý đổi
  select public.import_plan_backup(v_payload) into v_plan_id_2;
  if (select status from plan_task_state where plan_id = v_plan_id_2 and task_id = v_task1_id) <> 'done' then
    raise exception 'import_plan_backup lần 2: kết quả phải giống lần 1';
  end if;
  if (select count(*) from plans where user_id = '00000000-0000-0000-0000-00000000000a') <> 1 then
    raise exception 'import_plan_backup: vẫn phải chỉ có đúng 1 plan sau khi import nhiều lần';
  end if;

  -- Payload sai (template không tồn tại) -> bị từ chối NGUYÊN KHỐI, không đụng plan đang có
  declare v_count_before int; v_count_after int; v_bad jsonb; begin
    select count(*) into v_count_before from plan_task_state pts join plans p on p.id = pts.plan_id where p.user_id = '00000000-0000-0000-0000-00000000000a';
    v_bad := jsonb_build_object('format','roadmap-backup','version',1,'template',jsonb_build_object('slug','khong-ton-tai'),'plan',jsonb_build_object('start_date','2026-10-01','hours_per_day',2,'days_per_week',6,'include_optional',false),'tasks','[]'::jsonb,'resources','[]'::jsonb);
    begin
      perform public.import_plan_backup(v_bad);
      raise exception 'RÒ RỈ: import_plan_backup chấp nhận template không tồn tại';
    exception when others then
      if sqlerrm not like '%không tồn tại hoặc chưa xuất bản%' then raise; end if;
    end;
    select count(*) into v_count_after from plan_task_state pts join plans p on p.id = pts.plan_id where p.user_id = '00000000-0000-0000-0000-00000000000a';
    if v_count_after <> v_count_before then
      raise exception 'RÒ RỈ: import_plan_backup thất bại nhưng vẫn ghi dở dữ liệu (còn %, trước %)', v_count_after, v_count_before;
    end if;
  end;
end $$;

-- B import: chỉ ảnh hưởng plan của B, không đụng A (đo trước/sau bằng bảng tạm dưới quyền superuser)
reset role;
do $$ declare v_before int; begin
  select count(*) into v_before from plan_task_state pts join plans p on p.id = pts.plan_id
    where p.user_id = '00000000-0000-0000-0000-00000000000a' and pts.status = 'done';
  insert into tmp_counts(k,v) values ('a_done_before_b_import', v_before) on conflict (k) do update set v = excluded.v;
end $$;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ declare v_template_id uuid; v_payload jsonb; begin
  select id into v_template_id from templates where is_published = true limit 1;
  v_payload := jsonb_build_object(
    'format','roadmap-backup','version',1,
    'template', jsonb_build_object('slug', (select slug from templates where id = v_template_id)),
    'plan', jsonb_build_object('start_date','2026-10-01','hours_per_day',1,'days_per_week',7,'include_optional',true,'timezone','Asia/Ho_Chi_Minh'),
    'tasks','[]'::jsonb, 'resources','[]'::jsonb
  );
  perform public.import_plan_backup(v_payload);
end $$;
reset role;

do $$ declare v_before int; v_after int; begin
  select v into v_before from tmp_counts where k = 'a_done_before_b_import';
  select count(*) into v_after from plan_task_state pts join plans p on p.id = pts.plan_id
    where p.user_id = '00000000-0000-0000-0000-00000000000a' and pts.status = 'done';
  if v_after <> v_before then raise exception 'RÒ RỈ: import_plan_backup của B làm đổi dữ liệu của A'; end if;
end $$;

-- ========== anon không được gọi create_plan / update_plan_progress / import_plan_backup (đã REVOKE) ==========
set role anon;
do $$ begin
  begin
    perform public.create_plan('x', '2026-10-01', 2, 6, false, 'Asia/Ho_Chi_Minh');
    raise exception 'RÒ RỈ: anon gọi được create_plan';
  exception when insufficient_privilege then null; end;
  begin
    perform public.update_plan_progress('x');
    raise exception 'RÒ RỈ: anon gọi được update_plan_progress';
  exception when insufficient_privilege then null; end;
  begin
    perform public.import_plan_backup('{}'::jsonb);
    raise exception 'RÒ RỈ: anon gọi được import_plan_backup';
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
