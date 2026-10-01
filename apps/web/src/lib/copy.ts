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
  createPlanDoneUpToLabel: 'Mình đã học XONG đến hết task…',
  createPlanDoneUpToNone: 'Chưa bắt đầu (bắt đầu từ task đầu tiên)',

  // Hôm nay
  todayTitle: 'Hôm nay',
  todayDoneButton: 'Xong',
  todayEmptyState: 'Không còn task nào đang chờ — bạn đã hoàn thành lộ trình!',
  todayFinishLabel: (date: string) => `Ngày dự kiến hoàn thành: ${date}`,
  todayRequiredHoursLabel: (hours: number) => `Cần khoảng ${hours} giờ/ngày để xong trong 365 ngày`,

  // Cập nhật tiến độ (đã học đến đâu)
  updateProgressTitle: 'Cập nhật tiến độ',
  updateProgressSelectLabel: 'Mình đã học XONG đến hết task…',
  updateProgressPreviewSubmit: 'Xem trước',
  updateProgressNextTaskLabel: (name: string) => `Task tiếp theo của bạn sẽ là: ${name}`,
  updateProgressAllDoneLabel: 'Bạn đã xong toàn bộ lộ trình!',
  updateProgressConfirmCount: (count: number) => `Sẽ đánh dấu ${count} task là Xong.`,
  updateProgressConfirmRange: (first: string, last: string) => `Từ "${first}" đến "${last}".`,
  updateProgressConfirmNone: 'Không có task nào cần đổi — có thể bạn đã đánh dấu xong tới đây rồi.',
  updateProgressConfirmSubmit: 'Xác nhận',
  updateProgressChooseAgain: 'Chọn lại',
  updateProgressResult: (count: number) => `Đã đánh dấu ${count} task là Xong.`,
  updateProgressLink: 'Cập nhật tiến độ (đã học đến đâu)',

  // Lộ trình
  roadmapTitle: 'Lộ trình',
  roadmapDoneCount: (done: number, total: number) => `${done}/${total} xong`,
  roadmapOptionalOffCount: (count: number) => `${count} task tùy chọn đang tắt`,
  roadmapJumpToCurrent: 'Đi tới task đang học',
  roadmapStatusTodo: 'Chưa làm',
  roadmapStatusInProgress: 'Đang làm',
  roadmapStatusDone: 'Đã xong',
  roadmapStatusSkipped: 'Đã bỏ qua',
  roadmapOptionalTag: '(tùy chọn)',
  roadmapNoDates: '—',
  roadmapEstHoursLabel: (hours: number) => `${hours} giờ`,

  // Thao tác lịch (T-006)
  scheduleSkipButton: 'Bỏ qua',
  scheduleUnskipButton: 'Bỏ "bỏ qua"',
  scheduleDelayLabel: 'Hoãn (số ngày)',
  scheduleDelaySubmit: 'Hoãn',
  schedulePinLabel: 'Ghim ngày bắt đầu',
  schedulePinSubmit: 'Ghim',
  scheduleUnpinSubmit: 'Xóa ghim',
  scheduleBreakTitle: 'Nghỉ N ngày',
  scheduleBreakFromLabel: 'Từ ngày',
  scheduleBreakDaysLabel: 'Số ngày nghỉ',
  scheduleBreakSubmit: 'Áp dụng nghỉ',
  scheduleActionSuccess: 'Đã cập nhật.',
  scheduleConflictWarning: 'Ngày ghim sớm hơn lịch tự tính nên có thể trùng với task trước.',
  scheduleClampedWarning: 'Ngày ghim đã ở quá khứ nên bị đưa về ngày bắt đầu hiệu lực (hôm nay).',
  scheduleNoTaskAffected: 'Không có task nào sau ngày này cần dời — không đổi gì.',
} as const;
