-- Module "Ôn luyện" — M2: chấm điểm thật cho K1/E1/E2 (mirror packages/core/src/review.ts),
-- đáp án E1 lưu sẵn trên ví dụ, danh mục thẻ dùng chung và thống kê Home.
-- Sửa logic chấm ở đây thì PHẢI sửa packages/core/src/review.ts (scripts/test-review.mts so khớp hai bên).

-- Đáp án Hán Việt cho E1: mảng theo từng kanji trong từ, mỗi phần tử là các cách viết chấp nhận.
-- vd 一時 → [["Nhất"],["Thời","Thì"]]. null = có kanji không tra được (ngoài 512 chữ) → không hỏi E1.
-- Script seed tính sẵn từ kanji_512.csv (kể cả kanji bài 13–32 — chỉ lấy âm Hán Việt, không nạp kanji đó).
alter table review_example add column han_viet_parts jsonb
  check (han_viet_parts is null or (jsonb_typeof(han_viet_parts) = 'array' and jsonb_array_length(han_viet_parts) > 0));

-- ============ Hàm chấm (mirror TS) ============
-- Khoá âm tiết "chữ gốc|thanh" — mirror hanVietSyllableKey. null nếu rỗng/có khoảng trắng/nhiều hơn 1 dấu thanh.
create or replace function public.review_hv_key(p_input text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_d text := normalize(btrim(coalesce(p_input, '')), NFD);
  v_tones text;
begin
  if v_d = '' or v_d ~ '\s' then return null; end if;
  v_tones := regexp_replace(v_d, '[^̣̀́̃̉]', '', 'g');
  if length(v_tones) > 1 then return null; end if;
  return normalize(lower(translate(regexp_replace(v_d, '[̣̀́̃̉]', '', 'g'), 'Đ', 'đ')), NFC)
    || '|' || case v_tones
      when U&'\0300' then 'f' when U&'\0301' then 's' when U&'\0303' then 'x'
      when U&'\0309' then 'r' when U&'\0323' then 'j' else '' end;
end;
$$;

-- Mirror compareHanVietAnswer: p_parts là jsonb [[cách viết...], ...]
create or replace function public.review_hv_compare(p_input text, p_parts jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_syllables text[];
  v_key text;
  i int;
begin
  if p_parts is null or jsonb_typeof(p_parts) <> 'array' or jsonb_array_length(p_parts) = 0 then return false; end if;
  if btrim(coalesce(p_input, '')) = '' then return false; end if;
  v_syllables := regexp_split_to_array(btrim(p_input), '\s+');
  if cardinality(v_syllables) <> jsonb_array_length(p_parts) then return false; end if;
  for i in 1 .. cardinality(v_syllables) loop
    v_key := public.review_hv_key(v_syllables[i]);
    if v_key is null then return false; end if;
    if not exists (
      select 1 from jsonb_array_elements_text(p_parts -> (i - 1)) f where public.review_hv_key(f) = v_key
    ) then return false; end if;
  end loop;
  return true;
end;
$$;

-- Mirror normalizeJapaneseAnswer: NFKC, bỏ mọi khoảng trắng (gồm khoảng trắng toàn độ rộng sau NFKC)
create or replace function public.review_jp_normalize(p_input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(normalize(coalesce(p_input, ''), NFKC), '\s+', '', 'g');
$$;

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
declare
  v_kanji public.review_kanji%rowtype;
  v_example public.review_example%rowtype;
  v_norm text;
begin
  if p_question_type = 'K1' and p_item_type = 'kanji' then
    select * into v_kanji from public.review_kanji where id = p_item_id;
    if not found or v_kanji.han_viet_main is null then return false; end if;
    return public.review_hv_compare(p_answer_text,
      jsonb_build_array(to_jsonb(array[v_kanji.han_viet_main] || v_kanji.han_viet_accepted)));
  elsif p_question_type = 'E1' and p_item_type = 'example' then
    select * into v_example from public.review_example where id = p_item_id;
    if not found then return false; end if;
    return public.review_hv_compare(p_answer_text, v_example.han_viet_parts);
  elsif p_question_type = 'E2' and p_item_type = 'example' then
    select * into v_example from public.review_example where id = p_item_id;
    if not found then return false; end if;
    v_norm := public.review_jp_normalize(p_answer_text);
    return v_norm <> '' and v_norm in (public.review_jp_normalize(v_example.reading_kana), public.review_jp_normalize(v_example.term));
  end if;
  raise exception 'Loại câu % không chấm tự động được', p_question_type using errcode = '0A000';
end;
$$;

-- ============ Danh mục thẻ có thể hỏi (nguồn sự thật duy nhất cho "câu nào áp dụng cho mục nào") ============
-- Một ví dụ thuộc nhiều bài thì xuất hiện ở mỗi bài (lesson khác nhau); đếm tổng thì dùng distinct.
create or replace view public.review_card_catalog with (security_invoker = on) as
  select 'kanji'::text as item_type, k.id as item_id, qt.question_type, k.vnjp_lesson as lesson
  from public.review_kanji k
  cross join (values ('K1'), ('K2')) as qt(question_type)
  where k.is_kanji and k.han_viet_main is not null and k.confirmed_at is not null and k.vnjp_lesson is not null
  union all
  select distinct 'example'::text, e.id, qt.question_type, ek.lesson_context
  from public.review_example e
  join public.review_example_kanji ek on ek.example_id = e.id
  cross join (values ('E1'), ('E2')) as qt(question_type)
  where e.meaning_vi is not null and e.confirmed_at is not null
    and (qt.question_type = 'E2' or e.han_viet_parts is not null);

-- ============ get_quiz_batch: dùng danh mục thẻ ============
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
  cards as (
    select distinct c.item_type, c.item_id, c.question_type
    from public.review_card_catalog c
    join refs on refs.item_type = c.item_type and refs.item_id = c.item_id
    where c.question_type = any(p_question_types)
  ),
  questions as (
    -- Chỉ trả phần "đề": K1 {kanji} · K2 {han_viet_main, meaning_en, meaning_vi, stroke_count} (không có kanji)
    -- E1 {term} · E2 {meaning_vi} (không có term/reading_kana)
    select c.item_type, c.item_id, c.question_type,
      case c.question_type
        when 'K1' then jsonb_build_object('kanji', k.kanji)
        else jsonb_build_object('han_viet_main', k.han_viet_main, 'meaning_en', k.meaning_en,
                                'meaning_vi', k.meaning_vi, 'stroke_count', k.stroke_count)
      end as prompt
    from cards c join public.review_kanji k on c.item_type = 'kanji' and k.id = c.item_id
    union all
    select c.item_type, c.item_id, c.question_type,
      case c.question_type
        when 'E1' then jsonb_build_object('term', e.term)
        else jsonb_build_object('meaning_vi', e.meaning_vi)
      end
    from cards c join public.review_example e on c.item_type = 'example' and e.id = c.item_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'item_type', q.item_type, 'item_id', q.item_id, 'question_type', q.question_type, 'prompt', q.prompt)), '[]'::jsonb)
  into v_result
  from (select * from questions order by random() limit p_limit) q;

  return v_result;
end;
$$;

-- ============ submit_answer: chỉ nhận thẻ có trong danh mục, trả đáp án + giải thích sau khi chấm ============
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
  v_answer jsonb;
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

  -- Đáp án + giải thích hiển thị SAU khi trả lời
  if p_item_type = 'kanji' then
    select jsonb_build_object('kanji', k.kanji, 'han_viet_main', k.han_viet_main, 'han_viet_accepted', to_jsonb(k.han_viet_accepted),
        'meaning_vi', k.meaning_vi, 'meaning_en', k.meaning_en, 'unicode_hex', k.unicode_hex)
      into v_answer from public.review_kanji k where k.id = p_item_id;
  else
    select jsonb_build_object('term', e.term, 'reading_kana', e.reading_kana, 'meaning_vi', e.meaning_vi,
        'han_viet', (select string_agg(p ->> 0, ' ' order by o) from jsonb_array_elements(e.han_viet_parts) with ordinality as x(p, o)))
      into v_answer from public.review_example e where e.id = p_item_id;
  end if;

  -- Gửi lại (mạng lag): trả kết quả cũ, không chấm lại
  select * into v_prev from public.review_attempt_log where client_attempt_id = p_client_attempt_id;
  if found then
    if v_prev.item_type <> p_item_type or v_prev.item_id <> p_item_id or v_prev.question_type <> p_question_type then
      raise exception 'Mã lần trả lời đã dùng cho câu khác';
    end if;
    select * into v_state from public.review_card_state
      where user_id = v_user_id and item_type = p_item_type and item_id = p_item_id and question_type = p_question_type;
    return jsonb_build_object('is_correct', v_prev.is_correct, 'answer', v_answer, 'new_streak', v_state.streak,
      'new_mastery_level', v_state.mastery_level, 'duplicate', true);
  end if;

  if not exists (select 1 from public.review_card_catalog c
                 where c.item_type = p_item_type and c.item_id = p_item_id and c.question_type = p_question_type) then
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

  return jsonb_build_object('is_correct', v_is_correct, 'answer', v_answer,
    'new_streak', v_state.streak, 'new_mastery_level', v_state.mastery_level, 'duplicate', false);
end;
$$;

-- ============ Thống kê Home (RPC vì Supabase JS giới hạn 1000 dòng/lần đọc) ============
-- Mỗi bài đã nạp: tổng thẻ, số thẻ mastered, số thẻ đã làm; kèm tổng toàn bộ (distinct) và số mục chờ xác nhận.
create or replace function public.review_home_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_lessons jsonb;
  v_overall jsonb;
begin
  if v_user_id is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;

  with cat as (
    select c.*, s.mastery_level, s.user_id is not null as seen
    from public.review_card_catalog c
    left join public.review_card_state s
      on s.user_id = v_user_id and s.item_type = c.item_type and s.item_id = c.item_id and s.question_type = c.question_type
  )
  select coalesce(jsonb_agg(jsonb_build_object('lesson', lesson, 'total', total, 'mastered', mastered, 'seen', seen) order by lesson), '[]'::jsonb)
  into v_lessons
  from (
    select lesson, count(*) as total, count(*) filter (where mastery_level = 'mastered') as mastered,
           count(*) filter (where seen) as seen
    from cat group by lesson
  ) t;

  with cards as (
    select distinct c.item_type, c.item_id, c.question_type from public.review_card_catalog c
  )
  select jsonb_build_object(
      'total', count(*),
      'mastered', count(*) filter (where s.mastery_level = 'mastered'),
      'seen', count(s.user_id),
      'pending_kanji', (select count(*) from public.review_kanji where confirmed_at is null),
      'pending_examples', (select count(*) from public.review_example where confirmed_at is null))
  into v_overall
  from cards c
  left join public.review_card_state s
    on s.user_id = v_user_id and s.item_type = c.item_type and s.item_id = c.item_id and s.question_type = c.question_type;

  return jsonb_build_object('lessons', v_lessons, 'overall', v_overall);
end;
$$;

revoke all on function public.review_hv_key(text) from public, anon;
grant execute on function public.review_hv_key(text) to authenticated;
revoke all on function public.review_hv_compare(text, jsonb) from public, anon;
grant execute on function public.review_hv_compare(text, jsonb) to authenticated;
revoke all on function public.review_jp_normalize(text) from public, anon;
grant execute on function public.review_jp_normalize(text) to authenticated;
revoke all on function public.review_home_stats() from public, anon;
grant execute on function public.review_home_stats() to authenticated;
revoke all on public.review_card_catalog from anon;
grant select on public.review_card_catalog to authenticated;
