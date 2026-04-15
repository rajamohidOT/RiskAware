import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from './auth';

const ORGANISATIONS = ['AcmeCorp', 'RiskAwareOrg'];

type AuthOptions = { roles?: string[]; orgCheck?: boolean };

export function withAuth(handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>, options: AuthOptions = {}) {
  return async (req: NextRequest, ...args: any[]) => {
    const token = req.cookies.get('token')?.value || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const user = verifyJwt(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    if (options.roles && (!user.role || !options.roles.includes(user.role))) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    if (options.orgCheck && (!user.organisation || !ORGANISATIONS.includes(user.organisation))) {
      return NextResponse.json({ error: 'Invalid organisation' }, { status: 403 });
    }
    (req as any).user = user;
    return handler(req, ...args);
  };
}
