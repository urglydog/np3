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
  -- Đếm theo template thật, không ghi cứng (T-011 đã thêm RES-11 làm số tài nguyên đổi 10 → 11)
  if (select count(*) from plan_resource_state) <> (select count(*) from template_resources where template_id = v_template_id) then
    raise exception 'A phải có đủ plan_resource_state = số tài nguyên của template (%), có %',
      (select count(*) from template_resources where template_id = v_template_id), (select count(*) from plan_resource_state);
  end if;

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

-- ========== anon không được gọi create_plan / update_plan_progress (đã REVOKE) ==========
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

-- ==================== MODULE ÔN LUYỆN (review_*) ====================
-- Dữ liệu giả riêng (không đụng 192 kanji đã seed): K_OK 鬱 đã xác nhận, K_WAIT 龘 chờ xác nhận, 1 ví dụ đã xác nhận.
-- Đặt ở bài 32 vị trí 15–16 (đợt 1 không seed bài 32) để không trùng khoá (deck_lesson, deck_order).
do $$ declare n int; begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname in ('review_get_quiz_batch','review_reveal_answer','review_submit_answer');
  if n <> 3 then raise exception 'Phải có đúng 3 hàm RPC review_*, mỗi hàm 1 chữ ký, hiện có %', n; end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname in ('review_grade_answer','review_home_stats');
  if n <> 2 then raise exception 'Phải có đúng 1 review_grade_answer + 1 review_home_stats, hiện có %', n; end if;
end $$;

insert into review_kanji (id, unicode_hex, kanji, deck_lesson, deck_order, vnjp_lesson, han_viet_main, han_viet_accepted, meaning_en, meaning_vi, stroke_count, svg_path, confirmed_at)
values
  ('00000000-0000-0000-0000-0000000000f1', '09b31', '鬱', 32, 15, 32, 'Uất', array['Úc'], 'gloom', 'u uất', 29, '/kanjivg/09b31.svg', now()),
  ('00000000-0000-0000-0000-0000000000f2', '09f98', '龘', 32, 16, 32, 'Đạp', '{}', 'dragon', 'rồng bay', 48, '/kanjivg/09f98.svg', null);
insert into review_example (id, term, reading_kana, meaning_vi, han_viet_parts, confirmed_at)
values ('00000000-0000-0000-0000-0000000000e1', '鬱つ', 'うつつ', 'ví dụ test', '[["Uất","Úc"]]'::jsonb, now());
insert into review_example_kanji (example_id, kanji_id, lesson_context)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1', 32);
insert into review_import_batch (source, kanji_count, example_count, needs_review_kanji_count, needs_review_example_count)
values ('rls-test', 2, 1, 1, 0);

-- ---------- anon: không thấy danh mục, không gọi được RPC ----------
set role anon;
do $$ begin
  if (select count(*) from review_kanji) <> 0 then raise exception 'RÒ RỈ: anon thấy review_kanji'; end if;
  if (select count(*) from review_example) <> 0 then raise exception 'RÒ RỈ: anon thấy review_example'; end if;
  begin
    perform public.review_get_quiz_batch('[]'::jsonb, array['K1'], 10);
    raise exception 'RÒ RỈ: anon gọi được review_get_quiz_batch';
  exception when insufficient_privilege then null; end;
  begin
    perform public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K2', null, true, gen_random_uuid());
    raise exception 'RÒ RỈ: anon gọi được review_submit_answer';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---------- A: đọc danh mục, không ghi được danh mục, list + trigger + RPC ----------
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ declare v_list uuid; v_batch jsonb; v_ret jsonb; v_attempt uuid := gen_random_uuid(); n int; begin
  if (select count(*) from review_kanji where id in ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2')) <> 2 then
    raise exception 'A phải thấy cả 2 kanji (kể cả chờ xác nhận)'; end if;
  if not exists (select 1 from review_example_kanji where example_id = '00000000-0000-0000-0000-0000000000e1') then
    raise exception 'A phải thấy review_example_kanji'; end if;
  if (select count(*) from review_card_catalog where item_id = '00000000-0000-0000-0000-0000000000f2') <> 0 then
    raise exception 'Danh mục thẻ không được chứa kanji chờ xác nhận'; end if;
  if (select count(*) from review_import_batch) <> 0 then raise exception 'RÒ RỈ: người dùng đọc được review_import_batch'; end if;
  begin
    insert into review_kanji (unicode_hex, kanji, deck_lesson, deck_order, svg_path) values ('99999', 'x', 1, 3, '/x.svg');
    raise exception 'RÒ RỈ: người dùng ghi được review_kanji';
  exception when insufficient_privilege then null; end;
  update review_kanji set han_viet_main = 'Sai'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RÒ RỈ: người dùng sửa được review_kanji'; end if;

  insert into review_list (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'List của A') returning id into v_list;
  insert into review_list_item (list_id, item_type, item_id) values (v_list, 'kanji', '00000000-0000-0000-0000-0000000000f1');
  insert into review_list_item (list_id, item_type, item_id) values (v_list, 'example', '00000000-0000-0000-0000-0000000000e1');
  begin
    insert into review_list_item (list_id, item_type, item_id) values (v_list, 'kanji', gen_random_uuid());
    raise exception 'Trigger phải chặn item_id kanji không tồn tại';
  exception when foreign_key_violation then null; end;
  begin -- id của ví dụ nhưng khai item_type kanji
    insert into review_list_item (list_id, item_type, item_id) values (v_list, 'kanji', '00000000-0000-0000-0000-0000000000e1');
    raise exception 'Trigger phải chặn item_id sai bảng';
  exception when foreign_key_violation then null; end;

  -- get_quiz_batch: loại kanji chờ xác nhận, không lộ đáp án
  v_batch := public.review_get_quiz_batch(
    '[{"item_type":"kanji","item_id":"00000000-0000-0000-0000-0000000000f1"},
      {"item_type":"kanji","item_id":"00000000-0000-0000-0000-0000000000f2"},
      {"item_type":"example","item_id":"00000000-0000-0000-0000-0000000000e1"}]'::jsonb,
    array['K1','K2','E1','E2'], 50);
  -- Việc 1: E2 không còn được sinh ra cho ví dụ (review_card_catalog dừng tạo thẻ E2) → chỉ còn 3 câu
  -- (K1,K2 của 鬱 + E1 trắc nghiệm của 鬱つ), không phải 4 như trước.
  if jsonb_array_length(v_batch) <> 3 then raise exception 'quiz batch phải có 3 câu (K1,K2 của 鬱 + E1 của 鬱つ), có %', jsonb_array_length(v_batch); end if;
  if exists (select 1 from jsonb_array_elements(v_batch) q where q->>'item_id' = '00000000-0000-0000-0000-0000000000f2') then
    raise exception 'quiz batch không được chứa kanji đang chờ xác nhận';
  end if;
  if exists (select 1 from jsonb_array_elements(v_batch) q where q->>'question_type' = 'K1' and q->'prompt' ? 'han_viet_main') then
    raise exception 'LỘ ĐÁP ÁN: đề K1 chứa han_viet_main';
  end if;
  if exists (select 1 from jsonb_array_elements(v_batch) q where q->>'question_type' = 'K2' and q->'prompt' ? 'kanji') then
    raise exception 'LỘ ĐÁP ÁN: đề K2 chứa kanji';
  end if;
  if exists (select 1 from jsonb_array_elements(v_batch) q where q->>'question_type' = 'E1' and q->>'item_type' = 'example' and (q->'prompt' ? 'term')) then
    raise exception 'LỘ ĐÁP ÁN: đề E1 ví dụ chứa term trực tiếp (phải qua choices, không lộ đáp án đúng)';
  end if;
  if exists (select 1 from jsonb_array_elements(v_batch) q where q->>'question_type' = 'E1' and q->>'item_type' = 'example' and not (q->'prompt' ? 'choices')) then
    raise exception 'Đề E1 ví dụ phải có mảng choices (trắc nghiệm)';
  end if;
  if jsonb_array_length(public.review_get_quiz_batch(v_batch, array['K1'], 1)) <> 1 then
    raise exception 'p_limit phải cắt số câu';
  end if;

  -- reveal: chỉ K2
  if (public.review_reveal_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K2'))->>'kanji' <> '鬱' then
    raise exception 'review_reveal_answer K2 phải trả kanji';
  end if;
  begin
    perform public.review_reveal_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K1');
    raise exception 'review_reveal_answer phải từ chối K1';
  exception when others then if sqlerrm not like '%Chỉ câu viết kanji%' then raise; end if; end;

  -- submit K2 đúng 3 lần → mastered; gửi lại cùng mã không tính lần hai
  v_ret := public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K2', null, true, v_attempt);
  if (v_ret->>'new_mastery_level') <> 'to_confirm' or (v_ret->>'new_streak')::int <> 1 then raise exception 'Sau 1 lần đúng phải to_confirm/streak 1, có %', v_ret; end if;
  v_ret := public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K2', null, true, v_attempt);
  if (v_ret->>'duplicate')::boolean is not true or (v_ret->>'new_streak')::int <> 1 then raise exception 'Gửi lại cùng mã phải idempotent, có %', v_ret; end if;
  perform public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K2', null, true, gen_random_uuid());
  v_ret := public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K2', null, true, gen_random_uuid());
  if (v_ret->>'new_mastery_level') <> 'mastered' then raise exception 'Đúng 3 lần liên tiếp phải mastered, có %', v_ret; end if;
  v_ret := public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K2', null, false, gen_random_uuid());
  if (v_ret->>'new_mastery_level') <> 'bad' or (v_ret->>'new_streak')::int <> 0 then raise exception 'Sai sau mastered phải về bad/streak 0, có %', v_ret; end if;
  if (select count(*) from review_attempt_log where question_type = 'K2') <> 4 then raise exception 'attempt_log K2 phải có 4 dòng (lần gửi lại không ghi), có %', (select count(*) from review_attempt_log); end if;
  if (select correct_count from review_card_state where question_type = 'K2') <> 3
     or (select wrong_count from review_card_state where question_type = 'K2') <> 1 then
    raise exception 'card_state K2 phải correct=3 wrong=1';
  end if;

  -- validate trước khi đụng DB
  begin
    perform public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'E1', 'Nhất', null, gen_random_uuid());
    raise exception 'Phải từ chối E1 cho item_type kanji';
  exception when others then if sqlerrm not like '%không áp dụng cho%' then raise; end if; end;
  begin
    perform public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f2', 'K2', null, true, gen_random_uuid());
    raise exception 'Phải từ chối nộp bài cho kanji đang chờ xác nhận';
  exception when others then if sqlerrm not like '%chờ xác nhận%' then raise; end if; end;
  -- chấm tự động K1/E1/E2 (mirror packages/core; bảng ca đầy đủ ở scripts/test-review.mts)
  v_ret := public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K1', ' uất ', null, gen_random_uuid());
  if (v_ret->>'is_correct')::boolean is not true then raise exception 'K1 "uất" phải đúng, có %', v_ret; end if;
  if (v_ret->'answer'->>'han_viet_main') <> 'Uất' then raise exception 'K1 phải trả đáp án sau khi chấm, có %', v_ret; end if;
  v_ret := public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K1', 'úc', null, gen_random_uuid());
  if (v_ret->>'is_correct')::boolean is not true then raise exception 'K1 cách viết chấp nhận "úc" phải đúng'; end if;
  v_ret := public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K1', 'uat', null, gen_random_uuid());
  if (v_ret->>'is_correct')::boolean is not false then raise exception 'K1 gõ không dấu "uat" phải sai'; end if;
  -- Việc 1: E1 ví dụ giờ là trắc nghiệm, chấm bằng so khớp CHÍNH XÁC với term (bấm nút, không phải gõ
  -- Hán Việt) — term thật của e1 là '鬱つ'.
  v_ret := public.review_submit_answer('example', '00000000-0000-0000-0000-0000000000e1', 'E1', '鬱つ', null, gen_random_uuid());
  if (v_ret->>'is_correct')::boolean is not true then raise exception 'E1 bấm đúng term phải đúng, có %', v_ret; end if;
  v_ret := public.review_submit_answer('example', '00000000-0000-0000-0000-0000000000e1', 'E1', 'không phải 鬱つ', null, gen_random_uuid());
  if (v_ret->>'is_correct')::boolean is not false then raise exception 'E1 bấm nhiễu phải sai'; end if;
  begin
    perform public.review_submit_answer('example', '00000000-0000-0000-0000-0000000000e1', 'E1', '   ', null, gen_random_uuid());
    raise exception 'Câu trả lời rỗng phải bị từ chối';
  exception when others then if sqlerrm not like '%Chưa nhập%' then raise; end if; end;
  -- E2 không còn trong danh mục thẻ của ví dụ (review_card_catalog dừng sinh) → nộp bị từ chối.
  begin
    perform public.review_submit_answer('example', '00000000-0000-0000-0000-0000000000e1', 'E2', 'うつつ', null, gen_random_uuid());
    raise exception 'Phải từ chối nộp E2 cho ví dụ (không còn trong danh mục thẻ)';
  exception when others then if sqlerrm not like '%chờ xác nhận%' then raise; end if; end;
  if ((public.review_home_stats())->'overall'->>'seen')::int < 3 then raise exception 'review_home_stats phải đếm thẻ đã làm của A'; end if;

  -- attempt_log append-only, card_state không xoá được
  update review_attempt_log set is_correct = true; get diagnostics n = row_count;
  if n <> 0 then raise exception 'attempt_log phải append-only (update đổi % dòng)', n; end if;
  delete from review_attempt_log; get diagnostics n = row_count;
  if n <> 0 then raise exception 'attempt_log phải append-only (delete xoá % dòng)', n; end if;
  delete from review_card_state; get diagnostics n = row_count;
  if n <> 0 then raise exception 'card_state không được xoá (xoá % dòng)', n; end if;
end $$;
reset role;

-- ---------- B: không thấy, không sửa, không chèn được vào dữ liệu ôn luyện của A ----------
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ declare n int; v_a_attempt uuid; begin
  if (select count(*) from review_list) <> 0 then raise exception 'RÒ RỈ: B thấy review_list của A'; end if;
  if (select count(*) from review_list_item) <> 0 then raise exception 'RÒ RỈ: B thấy review_list_item của A'; end if;
  if (select count(*) from review_card_state) <> 0 then raise exception 'RÒ RỈ: B thấy review_card_state của A'; end if;
  if (select count(*) from review_attempt_log) <> 0 then raise exception 'RÒ RỈ: B thấy review_attempt_log của A'; end if;

  update review_list set name = 'B đổi tên'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RÒ RỈ: B sửa được review_list của A'; end if;
  update review_card_state set streak = 99; get diagnostics n = row_count;
  if n <> 0 then raise exception 'RÒ RỈ: B sửa được review_card_state của A'; end if;

  begin
    insert into review_card_state (user_id, item_type, item_id, question_type)
      values ('00000000-0000-0000-0000-00000000000a', 'kanji', '00000000-0000-0000-0000-0000000000f1', 'K1');
    raise exception 'RÒ RỈ: B chèn được review_card_state mang user_id của A';
  exception when insufficient_privilege then null; end;
  begin
    insert into review_attempt_log (user_id, item_type, item_id, question_type, is_correct, client_attempt_id)
      values ('00000000-0000-0000-0000-00000000000a', 'kanji', '00000000-0000-0000-0000-0000000000f1', 'K2', true, gen_random_uuid());
    raise exception 'RÒ RỈ: B chèn được review_attempt_log mang user_id của A';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- B chèn item vào list của A (lấy id bằng superuser, rồi thử dưới quyền B)
do $$ begin
  create temporary table if not exists tmp_review(k text primary key, v uuid);
  insert into tmp_review values ('a_list', (select id from review_list where user_id = '00000000-0000-0000-0000-00000000000a'))
    on conflict (k) do update set v = excluded.v;
  insert into tmp_review values ('a_attempt', (select client_attempt_id from review_attempt_log where user_id = '00000000-0000-0000-0000-00000000000a' limit 1))
    on conflict (k) do update set v = excluded.v;
end $$;
grant select on tmp_review to authenticated;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin
    insert into review_list_item (list_id, item_type, item_id)
      values ((select v from tmp_review where k = 'a_list'), 'kanji', '00000000-0000-0000-0000-0000000000f1');
    raise exception 'RÒ RỈ: B chèn được item vào list của A';
  exception when insufficient_privilege then null; end;
  begin -- dùng lại client_attempt_id của A: không được đọc/ghi đè kết quả của A
    perform public.review_submit_answer('kanji', '00000000-0000-0000-0000-0000000000f1', 'K2', null, true, (select v from tmp_review where k = 'a_attempt'));
    raise exception 'RÒ RỈ: B dùng lại được client_attempt_id của A';
  exception when others then if sqlerrm not like '%đã được dùng%' then raise; end if; end;
  if (select count(*) from review_card_state) <> 0 then raise exception 'B không được có card_state sau lần nộp bị từ chối'; end if;
  if ((public.review_home_stats())->'overall'->>'seen')::int <> 0 then raise exception 'RÒ RỈ: review_home_stats của B đếm cả thẻ của A'; end if;
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
