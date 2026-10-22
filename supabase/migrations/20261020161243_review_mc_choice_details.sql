-- Module "Ôn luyện" — trắc nghiệm ví dụ (E1): hiện nghĩa + phát âm của CẢ 4 lựa chọn khi trả lời sai,
-- không chỉ đáp án đúng. choices trong đề đổi từ mảng string (chỉ term) sang mảng object
-- {term, reading_kana, meaning_vi} cho mỗi lựa chọn (đúng lẫn nhiễu) — vẫn KHÔNG đánh dấu lựa chọn nào
-- đúng trong response (giữ đúng nguyên tắc cũ, FE tự so với result.answer.term sau khi nộp).
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
    -- E1 {meaning_vi, choices: [{term, reading_kana, meaning_vi}] đúng + tối đa 3 nhiễu từ ví dụ khác
    -- trong refs, đã trộn ngẫu nhiên}
    select c.item_type, c.item_id, c.question_type,
      case c.question_type
        when 'E1' then (
          select jsonb_build_object(
            'meaning_vi', e.meaning_vi,
            'choices', jsonb_agg(
              jsonb_build_object('term', ch.term_val, 'reading_kana', ch.reading_kana_val, 'meaning_vi', ch.meaning_vi_val)
              order by ch.rnd
            )
          )
          from (
            select e.term as term_val, e.reading_kana as reading_kana_val, e.meaning_vi as meaning_vi_val, random() as rnd
            union all
            select picked.term_val, picked.reading_kana_val, picked.meaning_vi_val, random()
            from (
              select e2.term as term_val, e2.reading_kana as reading_kana_val, e2.meaning_vi as meaning_vi_val
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

revoke all on function public.review_get_quiz_batch(jsonb, text[], int) from public, anon;
grant execute on function public.review_get_quiz_batch(jsonb, text[], int) to authenticated;
