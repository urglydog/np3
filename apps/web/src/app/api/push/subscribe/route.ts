import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json({ error: 'Chưa triển khai (xem T-001 trong UpComming_Plan)' }, { status: 501 });
}
