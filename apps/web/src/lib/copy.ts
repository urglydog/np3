// Chuỗi hiển thị cho người dùng, tập trung một nơi để rà soát câu chữ trung thực.

export const copy = {
  hoursEstimateDisclaimer: 'Số giờ học là ước tính, có thể lệch so với thực tế của bạn.',
  priceReferenceLabel: (checkedAtIso: string) => `Giá tham khảo, kiểm tra lần cuối ${checkedAtIso}`,
  affiliateLabel: 'Link affiliate: chúng tôi có thể nhận hoa hồng nếu bạn mua qua link này.',
  notImplemented: (taskId: string) => `Chưa triển khai (xem ${taskId} trong UpComming_Plan)`,

  // Đăng nhập / đăng ký
  loginTitle: 'Đăng nhập',
  loginEmailLabel: 'Email',
  loginPasswordLabel: 'Mật khẩu',
  loginSubmit: 'Đăng nhập',
  signupSubmit: 'Tạo tài khoản',
  loginSwitchToSignup: 'Chưa có tài khoản? Tạo tài khoản',
  loginSwitchToLogin: 'Đã có tài khoản? Đăng nhập',
  logoutButton: 'Đăng xuất',

  // Tạo plan
  createPlanTitle: 'Tạo lộ trình học',
  createPlanPackageLabel: 'Chọn gói học',
  createPlanPackageCore: 'Bản gốc — 425 giờ (chỉ task bắt buộc)',
  createPlanPackageFull: 'Kèm phần bổ sung — 566 giờ (gồm cả task tùy chọn)',
  createPlanStartDateLabel: 'Ngày bắt đầu',
  createPlanHoursPerDayLabel: 'Số giờ học mỗi ngày học',
  createPlanDaysPerWeekLabel: 'Số ngày học mỗi tuần',
  createPlanTimezoneLabel: 'Múi giờ',
  createPlanSubmit: 'Tạo lộ trình',
  createPlanHoursDisclaimer: 'Số giờ ở trên là ước tính của tác giả, chưa kiểm chứng — dùng để tự lên lịch, không phải cam kết.',

  // Hôm nay
  todayTitle: 'Hôm nay',
  todayDoneButton: 'Xong',
  todayEmptyState: 'Không còn task nào đang chờ — bạn đã hoàn thành lộ trình!',
  todayFinishLabel: (date: string) => `Ngày dự kiến hoàn thành: ${date}`,
  todayRequiredHoursLabel: (hours: number) => `Cần khoảng ${hours} giờ/ngày để xong trong 365 ngày`,
} as const;
