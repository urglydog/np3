-- Module "Ôn luyện" (Kanji 512) — M1a: schema + RLS + RPC khung.
-- Theo docs/plans/review-feature.plan.md §3/§4 + delta ở
-- /home/dev-thien/.claude/plans/serene-chasing-kay.md (cột auto_graded, cột stroke_points).
-- Chưa seed dữ liệu thật (M1b làm sau) — migration này chỉ tạo cấu trúc + RPC khung dùng được ngay.
-- Mọi ngày học khác không áp dụng ở module này (không có khái niệm Start/Due) nên không có cột DATE
-- lịch tính toán — bất biến #1 CLAUDE.md không áp dụng cho module này.

-- ============ 1. DANH MỤC DÙNG CHUNG (đọc-only người dùng, ghi bằng service role) ============

create table review_kanji (
  id uuid primary key default gen_random_uuid(),
  unicode_hex text not null unique,               -- '04e00' — khớp tên file SVG, nguồn: kanji_512.csv
  kanji text not null unique,
  is_kanji boolean not null default true,         -- false chỉ cho 々 (thuộc bài 13-32, chưa seed đợt này)
  deck_lesson int not null,                        -- 1..32, kanji_512.csv.lesson (thứ tự deck gốc, cố định
                                                    -- theo cấu trúc sách — đợt 1 chỉ seed deck_lesson<=12)
  deck_order int not null,                         -- 1..16, kanji_512.csv.order_in_lesson
  vnjp_lesson int,                                 -- null nếu ngoài bài 1-12 (chưa có dữ liệu VNJP)
  vnjp_order int,                                  -- thứ tự hiển thị trong bài theo VNJP
  han_viet_main text,                              -- rỗng hợp lệ cho 込/々 (bài 13-32, không seed đợt 1)
  han_viet_accepted text[] not null default '{}', -- biến thể Hán Việt được CHẤP NHẬN khi chấm (dùng để chấm)
  han_viet_other text[] not null default '{}',    -- CHỈ tham khảo nội bộ — KHÔNG hiển thị UI, KHÔNG dùng để chấm
  meaning_en text,
  meaning_vi text,                                 -- null nếu ngoài bài 1-12
  onyomi text[] not null default '{}',
  kunyomi text[] not null default '{}',
  stroke_count int,
  note text,                                       -- ghi chú bộ thủ
  svg_path text not null,                          -- '/kanjivg/04e00.svg'
  stroke_points jsonb,                              -- toạ độ nét chuẩn KanjiVG đã resample/parse sẵn từ
                                                     -- path d=... lúc build/seed (dùng cho scoreHandwriting
                                                     -- phía client ở K2 — xem Delta 2 của plan UI redesign).
                                                     -- Nullable: M1a chưa điền, M1b sẽ chạy script trích
                                                     -- toạ độ từ 192 file SVG và UPDATE cột này.
  needs_review boolean not null default false,
  review_note text,
  confirmed_at timestamptz,                         -- null = đang chờ xác nhận Hán Việt, loại khỏi quiz
  source text not null default 'kanji-look-and-learn-512',
  created_at timestamptz not null default now(),
  check (deck_lesson between 1 and 32),
  check (deck_order between 1 and 16)
);
create unique index review_kanji_deck_pos_idx on review_kanji(deck_lesson, deck_order);

create table review_example (
  id uuid primary key default gen_random_uuid(),
  term text not null,                               -- dạng kanji, vd '一つ'
  reading_kana text not null,
  meaning_vi text,
  needs_review boolean not null default false,
  note text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (term, reading_kana)                        -- định danh ổn định khi nạp (dedupe)
);

-- Một ví dụ có thể thuộc nhiều kanji cha (春夏秋冬, 森林...) — N-N, tránh đếm trùng khi gộp phạm vi
create table review_example_kanji (
  example_id uuid not null references review_example(id) on delete cascade,
  kanji_id uuid not null references review_kanji(id) on delete cascade,
  lesson_context int not null,                       -- bài VNJP nơi cặp này xuất hiện
  primary key (example_id, kanji_id)
);

-- Nhật ký mỗi lần chạy script nạp, phục vụ audit phạm vi đã seed. Không có policy nào cho
-- authenticated (deny-all mặc định của RLS) — chỉ service role đọc/ghi được.
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

-- ============ 2. DỮ LIỆU CÁ NHÂN (RLS owner-only) ============

create table review_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table review_list_item (
  list_id uuid not null references review_list(id) on delete cascade,
  item_type text not null check (item_type in ('kanji','example')),
  item_id uuid not null,                             -- không FK trực tiếp (polymorphic) — ràng buộc bằng trigger
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
  auto_graded boolean not null default false,        -- true nếu lần chấm gần nhất (K2) do heuristic client tự
                                                      -- chấm (scoreHandwriting >= ngưỡng), false nếu người
                                                      -- dùng tự xác nhận hoặc là câu đọc (K1/E1/E2 luôn false)
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
  self_assessed boolean not null default false,      -- true chỉ cho K2
  auto_graded boolean not null default false,         -- true nếu K2 này được heuristic client tự chấm đúng
                                                       -- (không hỏi lại người dùng) — xem review_card_state.auto_graded
  raw_answer_text text,                                -- null cho K2 (không có text, chỉ self-assess)
  client_attempt_id uuid not null unique,              -- idempotency: resend không ghi trùng
  answered_at timestamptz not null default now()
);
create index review_attempt_log_user_item_idx on review_attempt_log(user_id, item_type, item_id, question_type);

-- ============ 3. RÀNG BUỘC POLYMORPHIC item_id BẰNG TRIGGER ============
-- item_id không có FK trực tiếp vì có thể tham chiếu review_kanji HOẶC review_example tuỳ item_type.
-- Dùng trigger BEFORE INSERT/UPDATE để kiểm tồn tại đúng bảng tương ứng. Lưu ý: cú pháp
-- "CREATE CONSTRAINT TRIGGER" của Postgres chỉ hỗ trợ timing AFTER (deferrable), không hỗ trợ BEFORE —
-- vì plan yêu cầu chặn NGAY trước khi ghi (before), ở đây dùng trigger thường (không phải constraint
-- trigger theo nghĩa cú pháp), chặn bằng raise exception giống hành vi mong muốn.
create or replace function check_review_item_exists()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.item_type = 'kanji' then
    if not exists (select 1 from public.review_kanji where id = new.item_id) then
      raise exception 'item_id % không tồn tại trong review_kanji', new.item_id;
    end if;
  elsif new.item_type = 'example' then
    if not exists (select 1 from public.review_example where id = new.item_id) then
      raise exception 'item_id % không tồn tại trong review_example', new.item_id;
    end if;
  else
    raise exception 'item_type không hợp lệ: %', new.item_type;
  end if;
  return new;
end;
$$;

create trigger review_list_item_check_item
  before insert or update on review_list_item
  for each row execute function check_review_item_exists();

create trigger review_card_state_check_item
  before insert or update on review_card_state
  for each row execute function check_review_item_exists();

create trigger review_attempt_log_check_item
  before insert or update on review_attempt_log
  for each row execute function check_review_item_exists();

-- ============ 4. BẢO MẬT HÀNG (RLS) ============

alter table review_kanji enable row level security;
alter table review_example enable row level security;
alter table review_example_kanji enable row level security;
alter table review_import_batch enable row level security;
alter table review_list enable row level security;
alter table review_list_item enable row level security;
alter table review_card_state enable row level security;
alter table review_attempt_log enable row level security;

-- Danh mục chung: đọc được (ngay cả needs_review=true/confirmed_at null, để browse vẫn hiện — chỉ
-- loại khỏi quiz ở tầng ứng dụng/RPC); ghi chỉ bằng service role (không có policy insert/update/delete).
create policy review_kanji_read on review_kanji for select to authenticated using (true);
create policy review_example_read on review_example for select to authenticated using (true);
create policy review_example_kanji_read on review_example_kanji for select to authenticated using (true);
-- review_import_batch: KHÔNG tạo policy nào cho authenticated (deny-all mặc định của RLS).

create policy review_list_owner on review_list for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy review_list_item_owner on review_list_item for all to authenticated
  using (exists (select 1 from review_list l where l.id = list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from review_list l where l.id = list_id and l.user_id = (select auth.uid())));

create policy review_card_state_owner on review_card_state for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- attempt_log: append-only — chỉ select+insert, KHÔNG update/delete (không tạo policy cho 2 lệnh này = bị chặn)
create policy review_attempt_log_select on review_attempt_log for select to authenticated
  using (user_id = (select auth.uid()));
create policy review_attempt_log_insert on review_attempt_log for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ============ 5. HÀM SO KHỚP HÁN VIỆT (mirror SQL của packages/core/src/review.ts, viết ở M2) ============
-- normalize_han_viet_syllable: NFC+lowercase+trim, rồi tách riêng DẤU THANH (chỉ 5 dấu: huyền/sắc/
-- ngã/hỏi/nặng — các dấu hình dạng nguyên âm như â/ơ/ư/ă không tách vì chúng là CHỮ khác, không phải
-- vị trí dấu thanh) ra khỏi phần chữ cái, rồi so khớp CHỮ CÁI + TẬP DẤU THANH (không quan tâm dấu thanh
-- nằm trên chữ nào) — đúng ngữ nghĩa quyết định 2.1.1: "hoà"≡"hòa" (cùng 1 dấu huyền, khác chữ mang dấu),
-- "Hỏa"≠"Hóa" (dấu khác nhau: hỏi vs sắc), không có dấu nào thì không bao giờ khớp với có dấu
-- ("hoa"≠"hoà" vì tập dấu thanh rỗng ≠ {huyền}).
-- ĐÂY LÀ BẢN MIRROR của packages/core/src/review.ts (M2) — nếu 2 bên lệch sẽ có test tương đương
-- (scripts/test-review-grading-equivalence.mts, M4) phát hiện; không cố làm phức tạp hơn mức cần.
create or replace function normalize_han_viet_syllable(p_input text)
returns text
language plpgsql
immutable
as $$
declare
  v_nfd text;
  v_base text := '';
  v_tones text := '';
  v_ch text;
  i int;
begin
  if p_input is null then
    return null;
  end if;
  v_nfd := normalize(lower(trim(p_input)), nfd);
  for i in 1..length(v_nfd) loop
    v_ch := substr(v_nfd, i, 1);
    -- 5 dấu thanh dạng combining: huyền U+0300, sắc U+0301, ngã U+0303, hỏi U+0309, nặng U+0323
    if v_ch in (chr(768), chr(769), chr(771), chr(777), chr(803)) then
      v_tones := v_tones || v_ch;
    else
      v_base := v_base || v_ch;
    end if;
  end loop;
  return normalize(v_base, nfc) || '#' || v_tones;
end;
$$;

create or replace function compare_han_viet_answer(p_user_input text, p_accepted_forms text[])
returns boolean
language plpgsql
immutable
as $$
declare
  v_user_syllables text[];
  v_accepted_syllables text[];
  v_accepted text;
  v_match boolean;
  i int;
begin
  if p_user_input is null or p_accepted_forms is null then
    return false;
  end if;
  v_user_syllables := regexp_split_to_array(trim(p_user_input), '\s+');
  foreach v_accepted in array p_accepted_forms loop
    if v_accepted is null or length(trim(v_accepted)) = 0 then
      continue;
    end if;
    v_accepted_syllables := regexp_split_to_array(trim(v_accepted), '\s+');
    if array_length(v_accepted_syllables, 1) is distinct from array_length(v_user_syllables, 1) then
      continue; -- số âm tiết không khớp số chữ trong term -> không thể khớp
    end if;
    v_match := true;
    for i in 1..array_length(v_user_syllables, 1) loop
      if normalize_han_viet_syllable(v_user_syllables[i]) is distinct from normalize_han_viet_syllable(v_accepted_syllables[i]) then
        v_match := false;
        exit;
      end if;
    end loop;
    if v_match then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- ============ 6. RPC ============
-- Theo mẫu create_plan/update_plan_progress: security invoker, raise exception tiếng Việt khi sai.

-- 6.1 review_get_quiz_batch: trả đề đã lọc confirmed_at not null, KHÔNG BAO GIỜ trả đáp án trước khi
-- trả lời (han_viet_main/han_viet_accepted/meaning_vi(với E)/reading_kana(với E2)).
create or replace function review_get_quiz_batch(
  p_item_refs jsonb,
  p_question_types text[],
  p_limit int
)
returns table(item_id uuid, item_type text, question_type text, payload jsonb)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;

  if p_item_refs is null or jsonb_typeof(p_item_refs) <> 'array' then
    raise exception 'p_item_refs phải là mảng JSON dạng [{"item_type":..,"item_id":..}]';
  end if;

  if p_question_types is null or array_length(p_question_types, 1) is null then
    raise exception 'Phải chọn ít nhất một loại câu hỏi';
  end if;

  if p_limit is null or p_limit <= 0 then
    raise exception 'p_limit phải lớn hơn 0';
  end if;

  return query
  with refs as (
    select
      (elem->>'item_type') as item_type,
      (elem->>'item_id')::uuid as item_id
    from jsonb_array_elements(p_item_refs) as elem
  ),
  kanji_candidates as (
    select k.id as item_id, 'kanji'::text as item_type, qt as question_type
    from refs r
    join public.review_kanji k on k.id = r.item_id and r.item_type = 'kanji'
    cross join unnest(array['K1', 'K2']) as qt
    where k.is_kanji = true
      and k.han_viet_main is not null
      and k.confirmed_at is not null
      and qt = any(p_question_types)
  ),
  example_candidates as (
    select e.id as item_id, 'example'::text as item_type, qt as question_type
    from refs r
    join public.review_example e on e.id = r.item_id and r.item_type = 'example'
    cross join unnest(array['E1', 'E2']) as qt
    where e.meaning_vi is not null
      and e.confirmed_at is not null
      and qt = any(p_question_types)
  ),
  candidates as (
    select * from kanji_candidates
    union all
    select * from example_candidates
  ),
  shuffled as (
    select * from candidates order by random() limit p_limit
  )
  select
    s.item_id,
    s.item_type,
    s.question_type,
    case s.question_type
      when 'K1' then jsonb_build_object('kanji', k1.kanji)
      when 'K2' then jsonb_build_object('han_viet_main', k2.han_viet_main, 'meaning_en', k2.meaning_en, 'stroke_count_hint', k2.stroke_count)
      when 'E1' then jsonb_build_object('term', e1.term)
      when 'E2' then jsonb_build_object('meaning_vi', e2.meaning_vi)
    end as payload
  from shuffled s
  left join public.review_kanji k1 on s.question_type = 'K1' and k1.id = s.item_id
  left join public.review_kanji k2 on s.question_type = 'K2' and k2.id = s.item_id
  left join public.review_example e1 on s.question_type = 'E1' and e1.id = s.item_id
  left join public.review_example e2 on s.question_type = 'E2' and e2.id = s.item_id;
end;
$$;

revoke all on function review_get_quiz_batch(jsonb, text[], int) from public;
revoke all on function review_get_quiz_batch(jsonb, text[], int) from anon;
grant execute on function review_get_quiz_batch(jsonb, text[], int) to authenticated;

-- 6.2 review_reveal_answer: chỉ SELECT, không ghi gì, dùng cho K2 trước khi người dùng tự xác nhận.
create or replace function review_reveal_answer(
  p_item_type text,
  p_item_id uuid,
  p_question_type text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;

  if p_item_type not in ('kanji', 'example') then
    raise exception 'item_type không hợp lệ: %', p_item_type;
  end if;

  if p_question_type not in ('K1', 'E1', 'K2', 'E2') then
    raise exception 'question_type không hợp lệ: %', p_question_type;
  end if;

  if (p_item_type = 'kanji' and p_question_type not in ('K1', 'K2'))
     or (p_item_type = 'example' and p_question_type not in ('E1', 'E2')) then
    raise exception 'question_type % không áp dụng cho item_type %', p_question_type, p_item_type;
  end if;

  if p_item_type = 'kanji' then
    select jsonb_build_object(
      'kanji', k.kanji,
      'svg_path', k.svg_path,
      'stroke_count', k.stroke_count,
      'han_viet_main', k.han_viet_main,
      'meaning_en', k.meaning_en
    ) into v_result
    from public.review_kanji k
    where k.id = p_item_id;
  else
    select jsonb_build_object(
      'term', e.term,
      'reading_kana', e.reading_kana,
      'meaning_vi', e.meaning_vi
    ) into v_result
    from public.review_example e
    where e.id = p_item_id;
  end if;

  if v_result is null then
    raise exception 'Không tìm thấy item: %', p_item_id;
  end if;

  return v_result;
end;
$$;

revoke all on function review_reveal_answer(text, uuid, text) from public;
revoke all on function review_reveal_answer(text, uuid, text) from anon;
grant execute on function review_reveal_answer(text, uuid, text) to authenticated;

-- 6.3 review_submit_answer: chấm (K1/E1/E2 bằng so khớp SQL mirror, K2 bằng self_correct/heuristic client),
-- upsert review_card_state theo logic mastery, insert review_attempt_log idempotent theo client_attempt_id.
create or replace function review_submit_answer(
  p_item_type text,
  p_item_id uuid,
  p_question_type text,
  p_answer_text text,
  p_self_correct boolean,
  p_client_attempt_id uuid,
  p_auto_graded boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_correct boolean;
  v_correct_answer_display text;
  v_existing record;
  v_state record;
  v_new_correct_count int;
  v_new_wrong_count int;
  v_new_streak int;
  v_new_mastery text;
  v_now timestamptz := now();
  v_accepted_phrase text[];
begin
  if v_user_id is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;

  if p_item_type not in ('kanji', 'example') then
    raise exception 'item_type không hợp lệ: %', p_item_type;
  end if;

  if p_question_type not in ('K1', 'E1', 'K2', 'E2') then
    raise exception 'question_type không hợp lệ: %', p_question_type;
  end if;

  if (p_item_type = 'kanji' and p_question_type not in ('K1', 'K2'))
     or (p_item_type = 'example' and p_question_type not in ('E1', 'E2')) then
    raise exception 'question_type % không áp dụng cho item_type %', p_question_type, p_item_type;
  end if;

  if p_client_attempt_id is null then
    raise exception 'Thiếu client_attempt_id';
  end if;

  -- Idempotent: resend cùng client_attempt_id (mạng lag/retry) -> trả lại kết quả đã lưu, không tính 2 lần.
  select * into v_existing from public.review_attempt_log where client_attempt_id = p_client_attempt_id;
  if found then
    select cs.mastery_level, cs.streak into v_new_mastery, v_new_streak
      from public.review_card_state cs
      where cs.user_id = v_user_id and cs.item_type = p_item_type and cs.item_id = p_item_id and cs.question_type = p_question_type;

    if p_item_type = 'kanji' then
      select k.han_viet_main into v_correct_answer_display from public.review_kanji k where k.id = p_item_id;
    elsif p_question_type = 'E1' then
      select e.term into v_correct_answer_display from public.review_example e where e.id = p_item_id;
    else
      select e.reading_kana into v_correct_answer_display from public.review_example e where e.id = p_item_id;
    end if;

    return jsonb_build_object(
      'is_correct', v_existing.is_correct,
      'correct_answer_display', v_correct_answer_display,
      'new_streak', coalesce(v_new_streak, 0),
      'new_mastery_level', coalesce(v_new_mastery, 'new')
    );
  end if;

  -- Tính is_correct theo từng loại câu hỏi.
  if p_question_type = 'K2' then
    -- K2 bỏ qua p_answer_text (không gửi ảnh canvas lên server) — chỉ dùng p_self_correct, do người dùng
    -- tự xác nhận hoặc do heuristic scoreHandwriting phía client tự chấm (auto_graded=true khi đó).
    select k.han_viet_main into v_correct_answer_display from public.review_kanji k
      where k.id = p_item_id and k.confirmed_at is not null;
    if v_correct_answer_display is null then
      raise exception 'Không tìm thấy kanji đã xác nhận: %', p_item_id;
    end if;
    v_is_correct := coalesce(p_self_correct, false);

  elsif p_question_type = 'K1' then
    select k.han_viet_main into v_correct_answer_display from public.review_kanji k
      where k.id = p_item_id and k.confirmed_at is not null;
    if v_correct_answer_display is null then
      raise exception 'Không tìm thấy kanji đã xác nhận: %', p_item_id;
    end if;
    v_is_correct := compare_han_viet_answer(
      p_answer_text,
      (select array_append(k.han_viet_accepted, k.han_viet_main) from public.review_kanji k where k.id = p_item_id)
    );

  elsif p_question_type = 'E1' then
    select e.term into v_correct_answer_display from public.review_example e
      where e.id = p_item_id and e.confirmed_at is not null;
    if v_correct_answer_display is null then
      raise exception 'Không tìm thấy ví dụ đã xác nhận: %', p_item_id;
    end if;
    -- Chấm Hán Việt cả từ ghép: ghép han_viet_main của từng chữ Hán cấu thành term, theo đúng thứ tự
    -- xuất hiện trong term, thành 1 cụm cách nhau bởi khoảng trắng rồi so khớp bằng compare_han_viet_answer
    -- (đã tách theo khoảng trắng per âm tiết) — bản mirror đơn giản của logic TS ở M2.
    select array_agg(k.han_viet_main order by chars.ord) into v_accepted_phrase
    from (
      select ord, substr(v_correct_answer_display, ord, 1) as ch
      from generate_series(1, length(v_correct_answer_display)) as ord
    ) chars
    join public.review_kanji k on k.kanji = chars.ch;
    v_is_correct := compare_han_viet_answer(p_answer_text, array[array_to_string(v_accepted_phrase, ' ')]);

  else -- E2: chấm tiếng Nhật (reading_kana), so khớp chính xác sau NFKC+lowercase+trim.
    select e.reading_kana into v_correct_answer_display from public.review_example e
      where e.id = p_item_id and e.confirmed_at is not null;
    if v_correct_answer_display is null then
      raise exception 'Không tìm thấy ví dụ đã xác nhận: %', p_item_id;
    end if;
    v_is_correct := (normalize(lower(trim(coalesce(p_answer_text, ''))), nfkc) = normalize(lower(trim(v_correct_answer_display)), nfkc));
  end if;

  -- Upsert review_card_state theo logic mastery: đúng -> streak+1; sai/pass -> streak=0.
  select * into v_state from public.review_card_state cs
    where cs.user_id = v_user_id and cs.item_type = p_item_type and cs.item_id = p_item_id and cs.question_type = p_question_type;

  if not found then
    v_new_correct_count := 0;
    v_new_wrong_count := 0;
    v_new_streak := 0;
  else
    v_new_correct_count := v_state.correct_count;
    v_new_wrong_count := v_state.wrong_count;
    v_new_streak := v_state.streak;
  end if;

  if v_is_correct then
    v_new_correct_count := v_new_correct_count + 1;
    v_new_streak := v_new_streak + 1;
  else
    v_new_wrong_count := v_new_wrong_count + 1;
    v_new_streak := 0;
  end if;

  v_new_mastery := case
    when v_new_streak >= 3 then 'mastered'
    when v_new_streak = 2 then 'good'
    when v_new_streak = 1 then 'to_confirm'
    when v_new_streak = 0 and v_new_wrong_count > 0 then 'bad'
    else 'new'
  end;

  insert into public.review_card_state (user_id, item_type, item_id, question_type, correct_count, wrong_count, streak, mastery_level, last_reviewed_at, auto_graded)
  values (v_user_id, p_item_type, p_item_id, p_question_type, v_new_correct_count, v_new_wrong_count, v_new_streak, v_new_mastery, v_now, coalesce(p_auto_graded, false))
  on conflict (user_id, item_type, item_id, question_type) do update set
    correct_count = excluded.correct_count,
    wrong_count = excluded.wrong_count,
    streak = excluded.streak,
    mastery_level = excluded.mastery_level,
    last_reviewed_at = excluded.last_reviewed_at,
    auto_graded = excluded.auto_graded;

  insert into public.review_attempt_log (user_id, item_type, item_id, question_type, is_correct, self_assessed, auto_graded, raw_answer_text, client_attempt_id, answered_at)
  values (v_user_id, p_item_type, p_item_id, p_question_type, v_is_correct, (p_question_type = 'K2'), coalesce(p_auto_graded, false), p_answer_text, p_client_attempt_id, v_now)
  on conflict (client_attempt_id) do nothing;

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_answer_display', v_correct_answer_display,
    'new_streak', v_new_streak,
    'new_mastery_level', v_new_mastery
  );
end;
$$;

revoke all on function review_submit_answer(text, uuid, text, text, boolean, uuid, boolean) from public;
revoke all on function review_submit_answer(text, uuid, text, text, boolean, uuid, boolean) from anon;
grant execute on function review_submit_answer(text, uuid, text, text, boolean, uuid, boolean) to authenticated;
