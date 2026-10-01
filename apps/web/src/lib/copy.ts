// Chuỗi hiển thị cho người dùng, tập trung một nơi để rà soát câu chữ trung thực.

export const copy = {
  hoursEstimateDisclaimer: 'Số giờ học là ước tính, có thể lệch so với thực tế của bạn.',
  priceReferenceLabel: (checkedAtIso: string) => `Giá tham khảo, kiểm tra lần cuối ${checkedAtIso}`,
  affiliateLabel: 'Link affiliate: chúng tôi có thể nhận hoa hồng nếu bạn mua qua link này.',
  notImplemented: (taskId: string) => `Chưa triển khai (xem ${taskId} trong UpComming_Plan)`,
} as const;
