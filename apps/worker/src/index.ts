import { z } from 'zod';
import { todayInTimeZone } from '@roadmap/core';

// Scaffold: chỉ ghi nhịp tim và chứng minh nối workspace được với @roadmap/core.
// KHÔNG gửi push thật ở đây (xem T-010).
const envSchema = z.object({
  TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
});

const env = envSchema.parse({ TIMEZONE: process.env.TIMEZONE });

let stopped = false;

function heartbeat(): void {
  if (stopped) return;
  console.log(`[worker] nhịp tim ${new Date().toISOString()} — hôm nay (${env.TIMEZONE}): ${todayInTimeZone(env.TIMEZONE)}`);
}

heartbeat();
const interval = setInterval(heartbeat, 60_000);

function shutdown(signal: string): void {
  stopped = true;
  clearInterval(interval);
  console.log(`[worker] nhận ${signal}, tắt sạch.`);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
