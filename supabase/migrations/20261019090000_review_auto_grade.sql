-- Module "Ôn luyện" — cho phép tự chấm K2 bằng heuristic hình học client-side (CLAUDE.md bất biến #4c):
-- so khớp nét vẽ (toạ độ chuẩn hoá 0..1, chạy hoàn toàn trên máy người dùng, không OCR/ML, không gửi ảnh
-- lên server) với toạ độ nét chuẩn KanjiVG (`stroke_points`). Dưới ngưỡng tin cậy cao vẫn rơi về luồng
-- tự xác nhận ✓/✗ đã có (review_reveal_answer + p_self_correct) — hàm SQL KHÔNG tự tính điểm, chỉ ghi
-- nhận cờ `auto_graded` do client gửi lên sau khi đã tự quyết định (xem packages/core scoreHandwriting).
-- `stroke_points` nullable: script seed điền sau, đến lúc đó UI phải coi null = "chưa có, ẩn gợi ý".

-- Toạ độ nét chuẩn KanjiVG cho kanji, dùng để so khớp heuristic ở client (packages/core scoreHandwriting).
-- Dạng: StrokePath[] = [[{x,y}, ...], ...], mỗi {x,y} đã chuẩn hoá 0..1. null = chưa có dữ liệu.
alter table review_kanji add column stroke_points jsonb
  check (stroke_points is null or jsonb_typeof(stroke_points) = 'array');

-- Cờ lần chấm gần nhất của mỗi thẻ có phải do máy tự chấm (K2, score cao) hay không — chỉ để hiển thị/thống kê,
-- không ảnh hưởng công thức mastery (vẫn tính như applyAnswer bình thường).
alter table review_card_state add column auto_graded boolean not null default false;
-- Cờ của từng lần trả lời trong lịch sử (append-only, giữ nguyên ý nghĩa gốc của bảng).
alter table review_attempt_log add column auto_graded boolean not null default false;

-- create or replace, thêm p_auto_graded Ở CUỐI với default false để không phá vỡ lời gọi cũ từ FE hiện có
-- (apps/web/src/lib/review-mutations.ts chưa truyền tham số này cho tới khi UI K2 auto-grade được nối dây).
create or replace function public.review_submit_answer(
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
  if p_auto_graded and p_question_type <> 'K2' then
    raise exception 'Chỉ câu viết kanji (K2) mới tự chấm bằng máy';
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
    (user_id, item_type, item_id, question_type, is_correct, self_assessed, raw_answer_text, client_attempt_id, auto_graded)
  values
    (v_user_id, p_item_type, p_item_id, p_question_type, v_is_correct, p_question_type = 'K2',
     case when p_question_type = 'K2' then null else p_answer_text end, p_client_attempt_id, p_auto_graded)
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
        mastery_level = v_state.mastery_level, last_reviewed_at = now(), auto_graded = p_auto_graded
    where user_id = v_user_id and item_type = p_item_type and item_id = p_item_id and question_type = p_question_type;

  return jsonb_build_object('is_correct', v_is_correct, 'answer', v_answer,
    'new_streak', v_state.streak, 'new_mastery_level', v_state.mastery_level, 'duplicate', false);
end;
$$;

revoke all on function public.review_submit_answer(text, uuid, text, text, boolean, uuid, boolean) from public, anon;
grant execute on function public.review_submit_answer(text, uuid, text, text, boolean, uuid, boolean) to authenticated;
