import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { isEmail, isNonEmptyString, sanitizeObject, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  try {
    const body = sanitizeObject(await req.json());
    const email = sanitizeString(body?.email).toLowerCase();
    const password = sanitizeString(body?.password);
    const rest = body && typeof body === 'object' ? body : {};
    const { password: _ignoredPassword, role: _ignoredRole, status: _ignoredStatus, ...safeRest } = rest as Record<string, unknown>;

    if (!isEmail(email) || !isNonEmptyString(password) || password.length < 8) {
      return NextResponse.json({ success: false, message: 'Invalid signup payload' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('learners');
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Email already registered' }, { status: 409 });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const learner = {
      ...safeRest,
      email,
      password: hashedPassword,
      role: 'learner',
      status: 'active',
      createdAt: new Date(),
    };
    await db.collection('users').insertOne(learner);
    return NextResponse.json({ success: true, message: 'Signup successful' });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to create your account right now. Please try again.',
      logMessage: 'Learner signup endpoint failed',
    });
  }
}
