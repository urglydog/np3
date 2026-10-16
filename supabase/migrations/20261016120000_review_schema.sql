-- Module "Ôn luyện" (Kanji 512) — M1a: schema + RLS + RPC khung. Chưa seed dữ liệu (M1b làm riêng).
-- Thiết kế chi tiết: docs/plans/review-feature.plan.md §3 (bảng), §3.4 + §7 (RLS), §4 (RPC).
-- Chấm tự động K1/E1/E2 (so khớp Hán Việt / tiếng Nhật) là việc của M2: hàm review_grade_answer ở cuối
-- file hiện chỉ là khung, M2 thay bằng bản mirror chính xác packages/core/src/review.ts trong migration mới.

-- ============ DANH MỤC DÙNG CHUNG (chỉ đọc với người dùng, ghi bằng service role) ============
create table review_kanji (
  id uuid primary key default gen_random_uuid(),
  unicode_hex text not null unique,               -- '04e00', khớp tên file SVG KanjiVG
  kanji text not null unique,
  is_kanji boolean not null default true,         -- false chỉ cho 々
  deck_lesson int not null,                       -- 1..32 theo deck gốc; đợt 1 chỉ seed bài 1–12
  deck_order int not null,                        -- 1..16
  vnjp_lesson int,                                -- null nếu chưa có dữ liệu VNJP (bài 13–32)
  vnjp_order int,
  han_viet_main text,                             -- null hợp lệ cho 込/々 (bài 13–32)
  han_viet_accepted text[] not null default '{}', -- biến thể ĐƯỢC CHẤP NHẬN khi chấm
  han_viet_other text[] not null default '{}',    -- chỉ tham khảo nội bộ: KHÔNG hiển thị, KHÔNG dùng để chấm
  meaning_en text,
  meaning_vi text,
  onyomi text[] not null default '{}',
  kunyomi text[] not null default '{}',
  stroke_count int,
  note text,                                      -- ghi chú bộ thủ
  svg_path text not null,                         -- '/kanjivg/04e00.svg'
  needs_review boolean not null default false,
  review_note text,
  confirmed_at timestamptz,                       -- null = đang chờ xác nhận, loại khỏi quiz
  source text not null default 'kanji-look-and-learn-512',
  created_at timestamptz not null default now(),
  check (deck_lesson between 1 and 32),
  check (deck_order between 1 and 16)
);
create unique index review_kanji_deck_pos_idx on review_kanji(deck_lesson, deck_order);

create table review_example (
  id uuid primary key default gen_random_uuid(),
  term text not null,                             -- dạng có kanji, vd '一つ'
  reading_kana text not null,
  meaning_vi text,
  needs_review boolean not null default false,
  note text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (term, reading_kana)                     -- định danh ổn định để seed idempotent
);

-- Một ví dụ có thể thuộc nhiều kanji cha (春夏秋冬, 森林...) nên quan hệ N-N
create table review_example_kanji (
  example_id uuid not null references review_example(id) on delete cascade,
  kanji_id uuid not null references review_kanji(id) on delete cascade,
  lesson_context int not null,                    -- bài VNJP nơi cặp này xuất hiện
  primary key (example_id, kanji_id)
);
create index review_example_kanji_kanji_idx on review_example_kanji(kanji_id);

-- Nhật ký mỗi lần chạy script nạp (audit phạm vi đã seed). Không có policy nào: chỉ service role đọc/ghi.
create table review_import_batch (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  imported_at timestamptz not null default now(),
  kanji_count int not null,
  example_count int not null,
  needs_review_kanji_count int not null,
  needs_review_example_count int not null,
  notes text
);

-- ============ DỮ LIỆU CÁ NHÂN (RLS owner-only) ============
create table review_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index review_list_user_idx on review_list(user_id);

-- item_id là polymorphic (kanji hoặc example) nên không FK trực tiếp được; tồn tại được kiểm bằng
-- trigger review_check_item_exists (xem dưới). Đánh đổi: ràng buộc không hiện ở \d như FK thật.
create table review_list_item (
  list_id uuid not null references review_list(id) on delete cascade,
  item_type text not null check (item_type in ('kanji','example')),
  item_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (list_id, item_type, item_id)
);

create table review_card_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('kanji','example')),
  item_id uuid not null,
  question_type text not null check (question_type in ('K1','E1','K2','E2')),
  correct_count int not null default 0 check (correct_count >= 0),
  wrong_count int not null default 0 check (wrong_count >= 0),
  streak int not null default 0 check (streak >= 0),
  mastery_level text not null default 'new' check (mastery_level in ('new','bad','to_confirm','good','mastered')),
  last_reviewed_at timestamptz,
  primary key (user_id, item_type, item_id, question_type),
  check ((item_type = 'kanji' and question_type in ('K1','K2')) or (item_type = 'example' and question_type in ('E1','E2')))
);

create table review_attempt_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('kanji','example')),
  item_id uuid not null,
  question_type text not null check (question_type in ('K1','E1','K2','E2')),
  is_correct boolean not null,
  self_assessed boolean not null default false,   -- true chỉ cho K2
  raw_answer_text text,                           -- null cho K2 (không gửi ảnh canvas lên server)
  client_attempt_id uuid not null unique,         -- idempotency: gửi lại không ghi trùng
  answered_at timestamptz not null default now(),
  check ((item_type = 'kanji' and question_type in ('K1','K2')) or (item_type = 'example' and question_type in ('E1','E2')))
);
create index review_attempt_log_user_item_idx on review_attempt_log(user_id, item_type, item_id, question_type);

-- ============ Ràng buộc item_id polymorphic ============
create or replace function public.review_check_item_exists()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.item_type = 'kanji' then
    if not exists (select 1 from public.review_kanji where id = new.item_id) then
      raise exception 'Không tìm thấy kanji %', new.item_id using errcode = '23503';
    end if;
  elsif new.item_type = 'example' then
    if not exists (select 1 from public.review_example where id = new.item_id) then
      raise exception 'Không tìm thấy ví dụ %', new.item_id using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create trigger review_list_item_check_item before insert or update on review_list_item
  for each row execute function public.review_check_item_exists();
create trigger review_card_state_check_item before insert or update on review_card_state
  for each row execute function public.review_check_item_exists();
create trigger review_attempt_log_check_item before insert or update on review_attempt_log
  for each row execute function public.review_check_item_exists();

-- ============ RLS ============
alter table review_kanji         enable row level security;
alter table review_example       enable row level security;
alter table review_example_kanji enable row level security;
alter table review_import_batch  enable row level security;
alter table review_list          enable row level security;
alter table review_list_item     enable row level security;
alter table review_card_state    enable row level security;
alter table review_attempt_log   enable row level security;

-- Danh mục: người đăng nhập đọc hết (kể cả mục chưa xác nhận, để màn duyệt hiện nhãn "đang chờ xác nhận";
-- việc loại khỏi quiz làm ở RPC/packages/core). anon không có policy nên không thấy gì.
create policy review_kanji_read on review_kanji for select to authenticated using (true);
create policy review_example_read on review_example for select to authenticated using (true);
create policy review_example_kanji_read on review_example_kanji for select to authenticated using (true);

create policy review_list_owner on review_list for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy review_list_item_owner on review_list_item for all to authenticated
  using (exists (select 1 from review_list l where l.id = list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from review_list l where l.id = list_id and l.user_id = (select auth.uid())));
-- card_state: không có policy delete (giữ lịch sử mastery, ma trận quyền §7 của plan)
create policy review_card_state_select on review_card_state for select to authenticated
  using (user_id = (select auth.uid()));
create policy review_card_state_insert on review_card_state for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy review_card_state_update on review_card_state for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- attempt_log: append-only — chỉ select + insert, không có policy update/delete
create policy review_attempt_log_select on review_attempt_log for select to authenticated
  using (user_id = (select auth.uid()));
create policy review_attempt_log_insert on review_attempt_log for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ============ Hàm thuần phụ trợ (mirror packages/core/src/review.ts — M2) ============
-- streak>=3 mastered; 2 good; 1 to_confirm; 0 và đã từng sai → bad; còn lại new
create or replace function public.review_calculate_mastery(p_streak int, p_wrong_count int)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_streak >= 3 then 'mastered'
    when p_streak = 2 then 'good'
    when p_streak = 1 then 'to_confirm'
    when p_wrong_count > 0 then 'bad'
    else 'new'
  end;
$$;

-- KHUNG (M1a): chấm tự động K1/E1/E2 chưa có. M2 thay thân hàm bằng bản mirror compareHanVietAnswer /
-- compareJapaneseAnswer của packages/core trong một migration mới (create or replace, giữ nguyên chữ ký).
create or replace function public.review_grade_answer(
  p_item_type text,
  p_item_id uuid,
  p_question_type text,
  p_answer_text text
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  raise exception 'Chưa hỗ trợ chấm tự động loại câu %', p_question_type using errcode = '0A000';
end;
$$;

-- ============ RPC ============
-- Lấy đề cho một phiên luyện. Chỉ trả phần "đề" theo từng loại câu, không bao giờ trả đáp án:
--   K1 {kanji} · E1 {term} · K2 {han_viet_main, meaning_en, stroke_count} (không có kanji) · E2 {meaning_vi}
-- Mục chưa xác nhận (confirmed_at null) hoặc thiếu dữ liệu chấm bị loại.
create or replace function public.review_get_quiz_batch(
  p_item_refs jsonb,
  p_question_types text[],
  p_limit int
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;
  if p_item_refs is null or jsonb_typeof(p_item_refs) <> 'array' then
    raise exception 'Danh sách mục ôn luyện không hợp lệ';
  end if;
  if jsonb_array_length(p_item_refs) > 2000 then
    raise exception 'Chọn tối đa 2000 mục cho một phiên luyện';
  end if;
  if p_question_types is null or cardinality(p_question_types) = 0
     or not (p_question_types <@ array['K1','E1','K2','E2']) then
    raise exception 'Loại câu hỏi không hợp lệ';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Số câu mỗi phiên phải từ 1 đến 200';
  end if;

  with refs as (
    select distinct r->>'item_type' as item_type, (r->>'item_id')::uuid as item_id
    from jsonb_array_elements(p_item_refs) r
  ),
  questions as (
    select 'kanji' as item_type, k.id as item_id, qt.question_type,
      case qt.question_type
        when 'K1' then jsonb_build_object('kanji', k.kanji)
        else jsonb_build_object('han_viet_main', k.han_viet_main, 'meaning_en', k.meaning_en, 'stroke_count', k.stroke_count)
      end as prompt
    from refs
    join public.review_kanji k on refs.item_type = 'kanji' and k.id = refs.item_id
    cross join unnest(array['K1','K2']) as qt(question_type)
    where qt.question_type = any(p_question_types)
      and k.is_kanji and k.han_viet_main is not null and k.confirmed_at is not null
    union all
    select 'example', e.id, qt.question_type,
      case qt.question_type
        when 'E1' then jsonb_build_object('term', e.term)
        else jsonb_build_object('meaning_vi', e.meaning_vi)
      end
    from refs
    join public.review_example e on refs.item_type = 'example' and e.id = refs.item_id
    cross join unnest(array['E1','E2']) as qt(question_type)
    where qt.question_type = any(p_question_types)
      and e.meaning_vi is not null and e.confirmed_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'item_type', q.item_type, 'item_id', q.item_id, 'question_type', q.question_type, 'prompt', q.prompt)), '[]'::jsonb)
  into v_result
  from (select * from questions order by random() limit p_limit) q;

  return v_result;
end;
$$;

-- Hiện đáp án cho K2 trước khi người dùng tự chấm ✓/✗. Chỉ đọc, không ghi gì.
create or replace function public.review_reveal_answer(
  p_item_type text,
  p_item_id uuid,
  p_question_type text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;
  if p_item_type is distinct from 'kanji' or p_question_type is distinct from 'K2' then
    raise exception 'Chỉ câu viết kanji (K2) mới xem đáp án trước khi chấm';
  end if;

  select jsonb_build_object(
      'kanji', k.kanji, 'svg_path', k.svg_path, 'stroke_count', k.stroke_count,
      'han_viet_main', k.han_viet_main, 'meaning_en', k.meaning_en)
  into v_result
  from public.review_kanji k
  where k.id = p_item_id and k.confirmed_at is not null;

  if v_result is null then
    raise exception 'Không tìm thấy kanji này hoặc kanji đang chờ xác nhận';
  end if;
  return v_result;
end;
$$;

-- Nộp một câu trả lời: chấm → ghi attempt_log (idempotent theo client_attempt_id) → cập nhật card_state.
-- Gửi lại cùng client_attempt_id: không tính lần hai, trả lại kết quả đã lưu.
create or replace function public.review_submit_answer(
  p_item_type text,
  p_item_id uuid,
  p_question_type text,
  p_answer_text text,
  p_self_correct boolean,
  p_client_attempt_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_correct boolean;
  v_answer_display text;
  v_inserted uuid;
  v_prev public.review_attempt_log%rowtype;
  v_state public.review_card_state%rowtype;
begin
  if v_user_id is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;
  if p_client_attempt_id is null then
    raise exception 'Thiếu mã lần trả lời';
  end if;
  if not ((p_item_type = 'kanji' and p_question_type in ('K1','K2'))
       or (p_item_type = 'example' and p_question_type in ('E1','E2'))) then
    raise exception 'Loại câu % không áp dụng cho %', p_question_type, p_item_type;
  end if;
  if p_answer_text is not null and length(p_answer_text) > 200 then
    raise exception 'Câu trả lời quá dài (tối đa 200 ký tự)';
  end if;

  -- Gửi lại (mạng lag): trả kết quả cũ, không chấm lại
  select * into v_prev from public.review_attempt_log where client_attempt_id = p_client_attempt_id;
  if found then
    if v_prev.item_type <> p_item_type or v_prev.item_id <> p_item_id or v_prev.question_type <> p_question_type then
      raise exception 'Mã lần trả lời đã dùng cho câu khác';
    end if;
    select * into v_state from public.review_card_state
      where user_id = v_user_id and item_type = p_item_type and item_id = p_item_id and question_type = p_question_type;
    return jsonb_build_object('is_correct', v_prev.is_correct, 'new_streak', v_state.streak,
      'new_mastery_level', v_state.mastery_level, 'duplicate', true);
  end if;

  if p_item_type = 'kanji' then
    select k.kanji into v_answer_display from public.review_kanji k
      where k.id = p_item_id and k.confirmed_at is not null and k.is_kanji and k.han_viet_main is not null;
  else
    select e.term into v_answer_display from public.review_example e
      where e.id = p_item_id and e.confirmed_at is not null and e.meaning_vi is not null;
  end if;
  if v_answer_display is null then
    raise exception 'Không tìm thấy mục này hoặc mục đang chờ xác nhận';
  end if;

  if p_question_type = 'K2' then
    if p_self_correct is null then
      raise exception 'Câu viết kanji cần tự chấm đúng/sai';
    end if;
    v_is_correct := p_self_correct;
  else
    if p_answer_text is null or btrim(p_answer_text) = '' then
      raise exception 'Chưa nhập câu trả lời';
    end if;
    v_is_correct := public.review_grade_answer(p_item_type, p_item_id, p_question_type, p_answer_text);
  end if;

  insert into public.review_attempt_log
    (user_id, item_type, item_id, question_type, is_correct, self_assessed, raw_answer_text, client_attempt_id)
  values
    (v_user_id, p_item_type, p_item_id, p_question_type, v_is_correct, p_question_type = 'K2',
     case when p_question_type = 'K2' then null else p_answer_text end, p_client_attempt_id)
  on conflict (client_attempt_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    -- Hai request cùng mã chạy song song, hoặc mã đã bị tài khoản khác dùng
    raise exception 'Mã lần trả lời đã được dùng, hãy tải lại câu hỏi';
  end if;

  insert into public.review_card_state (user_id, item_type, item_id, question_type)
    values (v_user_id, p_item_type, p_item_id, p_question_type)
    on conflict do nothing;

  select * into v_state from public.review_card_state
    where user_id = v_user_id and item_type = p_item_type and item_id = p_item_id and question_type = p_question_type
    for update;

  if v_is_correct then
    v_state.streak := v_state.streak + 1;
    v_state.correct_count := v_state.correct_count + 1;
  else
    v_state.streak := 0;
    v_state.wrong_count := v_state.wrong_count + 1;
  end if;
  v_state.mastery_level := public.review_calculate_mastery(v_state.streak, v_state.wrong_count);

  update public.review_card_state
    set streak = v_state.streak, correct_count = v_state.correct_count, wrong_count = v_state.wrong_count,
        mastery_level = v_state.mastery_level, last_reviewed_at = now()
    where user_id = v_user_id and item_type = p_item_type and item_id = p_item_id and question_type = p_question_type;

  return jsonb_build_object('is_correct', v_is_correct, 'correct_answer_display', v_answer_display,
    'new_streak', v_state.streak, 'new_mastery_level', v_state.mastery_level, 'duplicate', false);
end;
$$;

revoke all on function public.review_calculate_mastery(int, int) from public, anon;
grant execute on function public.review_calculate_mastery(int, int) to authenticated;
revoke all on function public.review_grade_answer(text, uuid, text, text) from public, anon;
grant execute on function public.review_grade_answer(text, uuid, text, text) to authenticated;
revoke all on function public.review_get_quiz_batch(jsonb, text[], int) from public, anon;
grant execute on function public.review_get_quiz_batch(jsonb, text[], int) to authenticated;
revoke all on function public.review_reveal_answer(text, uuid, text) from public, anon;
grant execute on function public.review_reveal_answer(text, uuid, text) to authenticated;
revoke all on function public.review_submit_answer(text, uuid, text, text, boolean, uuid) from public, anon;
grant execute on function public.review_submit_answer(text, uuid, text, text, boolean, uuid) to authenticated;
revoke all on function public.review_check_item_exists() from public, anon;
