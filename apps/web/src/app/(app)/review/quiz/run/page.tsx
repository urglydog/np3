'use client';

// Route tĩnh (không [sessionId]) — plan câu hỏi đọc từ sessionStorage phía client (xem
// components/quiz-scope-picker.tsx và quiz-runner.tsx), không có bảng DB riêng cho quiz session
// (đúng quyết định kỹ thuật ở đề bài M4: không thiết kế bảng mới chỉ để lưu phiên quiz tạm thời).
import { QuizRunner } from '@/components/quiz-runner';

export default function ReviewQuizRunPage() {
  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 p-4 md:p-6">
      <QuizRunner />
    </main>
  );
}
