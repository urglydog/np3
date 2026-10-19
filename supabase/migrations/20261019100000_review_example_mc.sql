-- Module "Ôn luyện" — đổi câu hỏi "ví dụ" (item_type='example') từ gõ tự do sang trắc nghiệm 4 lựa chọn.
-- Lý do (phản hồi người dùng sau khi test thật): ở giai đoạn này nhớ phiên âm Hán Việt hoặc gõ đúng tiếng
-- Nhật cho MỘT từ ví dụ là bất khả thi; mục tiêu chỉ là "làm quen mặt chữ" → trắc nghiệm chọn từ đúng
-- theo nghĩa tiếng Việt (meaning_vi), 3 nhiễu lấy ngẫu nhiên từ các ví dụ KHÁC trong cùng phạm vi luyện.
--
-- Quyết định: TÁI SỬ DỤNG question_type='E1' cho item_type='example' làm loại trắc nghiệm mới này (đổi
-- ngữ nghĩa, không đổi CHECK constraint vì ('example','E1'/'E2') vẫn đúng). DỪNG HẲN việc sinh câu E2 cho
-- ví dụ (không xoá khỏi schema/constraint — chỉ không còn mục nào trong review_card_catalog có question_type
-- 'E2' nữa, nên review_get_quiz_batch/review_home_stats tự nhiên không bao giờ trả về câu E2).
-- Lưu ý: K1/K2 (item_type='kanji') KHÔNG bị ảnh hưởng.

-- ============ 1) Danh mục thẻ: ví dụ chỉ còn E1 (bỏ E2); E1 không còn cần han_viet_parts ============
-- (han_viet_parts vẫn giữ trong schema, không dùng nữa cho mục đích chấm ví dụ — có thể dùng lại sau nếu cần).
create or replace view public.review_card_catalog with (security_invoker = on) as
  select 'kanji'::text as item_type, k.id as item_id, qt.question_type, k.vnjp_lesson as lesson
  from public.review_kanji k
  cross join (values ('K1'), ('K2')) as qt(question_type)
  where k.is_kanji and k.han_viet_main is not null and k.confirmed_at is not null and k.vnjp_lesson is not null
  union all
  select distinct 'example'::text, e.id, 'E1'::text, ek.lesson_context
  from public.review_example e
  join public.review_example_kanji ek on ek.example_id = e.id
  where e.meaning_vi is not null and e.confirmed_at is not null;

-- ============ 2) Chấm E1 cho ví dụ: so khớp CHÍNH XÁC chuỗi với term (bấm nút, không phải gõ tay) ============
-- K1 (kanji) và nhánh E2 (không còn được sinh ra, giữ lại không dọn vì vô hại) không đổi.
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
    -- Trắc nghiệm: client gửi lên đúng text của nút đã bấm (one of prompt.choices) → so khớp chính xác
    -- với term thật, không cần khoan dung dấu/hoà âm như gõ tay (compareHanVietAnswer không còn dùng ở đây).
    select * into v_example from public.review_example where id = p_item_id;
    if not found then return false; end if;
    return btrim(coalesce(p_answer_text, '')) = btrim(v_example.term);
  elsif p_question_type = 'E2' and p_item_type = 'example' then
    -- Không còn được sinh ra bởi review_card_catalog nữa (FE không bao giờ gửi E2) — giữ lại không dọn.
    select * into v_example from public.review_example where id = p_item_id;
    if not found then return false; end if;
    v_norm := public.review_jp_normalize(p_answer_text);
    return v_norm <> '' and v_norm in (public.review_jp_normalize(v_example.reading_kana), public.review_jp_normalize(v_example.term));
  end if;
  raise exception 'Loại câu % không chấm tự động được', p_question_type using errcode = '0A000';
end;
$$;

-- ============ 3) get_quiz_batch: đề E1 ví dụ trả {meaning_vi, choices} thay vì {term} ============
-- choices = term đúng + tối đa 3 term ngẫu nhiên từ CÁC VÍ DỤ KHÁC trong cùng p_item_refs (đã xác nhận với
-- người dùng: nhiễu lấy trong phạm vi đang luyện, không phải toàn bộ 512 từ). Không đánh dấu phần tử nào là
-- đáp án đúng trong response. Nếu phạm vi không đủ 3 ví dụ khác → choices có ít hơn 4 phần tử (tối thiểu 1,
-- chính là đáp án đúng) — FE PHẢI xử lý được danh sách choices ngắn hơn 4 mà không lỗi.
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
    -- K1 {kanji} · K2 {han_viet_main, meaning_en, meaning_vi, stroke_count} (không có kanji)
    select c.item_type, c.item_id, c.question_type,
      case c.question_type
        when 'K1' then jsonb_build_object('kanji', k.kanji)
        else jsonb_build_object('han_viet_main', k.han_viet_main, 'meaning_en', k.meaning_en,
                                'meaning_vi', k.meaning_vi, 'stroke_count', k.stroke_count)
      end as prompt
    from cards c join public.review_kanji k on c.item_type = 'kanji' and k.id = c.item_id
    union all
    -- E1 {meaning_vi, choices: term đúng + tối đa 3 nhiễu từ ví dụ khác trong refs, đã trộn ngẫu nhiên}
    select c.item_type, c.item_id, c.question_type,
      case c.question_type
        when 'E1' then (
          select jsonb_build_object(
            'meaning_vi', e.meaning_vi,
            'choices', jsonb_agg(ch.term_val order by ch.rnd)
          )
          from (
            select e.term as term_val, random() as rnd
            union all
            select picked.term_val, random()
            from (
              select e2.term as term_val
              from refs r2
              join public.review_example e2 on e2.id = r2.item_id
              where r2.item_type = 'example' and r2.item_id <> e.id
              order by random()
              limit 3
            ) picked
          ) ch
        )
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
