import { NextResponse } from 'next/server';
import { todayInTimeZone } from '@roadmap/core';
import { loadBackupExportData } from '@/lib/backup-io';

export async function GET() {
  const payload = await loadBackupExportData();
  if (!payload) {
    return NextResponse.json({ error: 'Chưa đăng nhập hoặc chưa có lộ trình' }, { status: 401 });
  }

  const dateSuffix = todayInTimeZone(payload.plan.timezone);
  const filename = `roadmap-backup-${dateSuffix}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
