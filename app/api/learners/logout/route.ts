import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.set('session', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  response.cookies.set('token', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
