import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, isEmail, isNonEmptyString, sanitizeString } from '@/lib/security';
import { signJwt } from '@/lib/auth';
import { handleApiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'login',
      limit: 10,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const email = sanitizeString(body?.email).toLowerCase();
    const password = sanitizeString(body?.password);

    if (!isEmail(email) || !isNonEmptyString(password)) {
      return NextResponse.json({ success: false, message: 'Invalid email or password format' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const learner = await db.collection('learners').findOne({ email });
    if (!learner) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }
    const passwordMatch = await bcrypt.compare(password, learner.password);
    if (!passwordMatch) {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }

    const token = signJwt({
      email: learner.email,
      role: learner.role || 'learner',
      organisation: learner.organisation || 'RiskAwareOrg',
    });

    const response = NextResponse.json({ success: true, message: 'Login successful', learner: { email: learner.email } });
    response.cookies.set('session', email, { httpOnly: true, sameSite: 'lax', path: '/' });
    response.cookies.set('token', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    return response;
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to sign in right now. Please try again.',
      logMessage: 'Login endpoint failed',
    });
  }
}
