import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json({
    success: false,
    output: 'Tool API is disabled. Agents no longer have direct filesystem access.',
  });
}
