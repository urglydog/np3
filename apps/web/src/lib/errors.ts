export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toUserMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Có lỗi không xác định.';
}
