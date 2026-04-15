import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import { isEmail, isNonEmptyString, sanitizeObject, sanitizeString } from '@/lib/security';
import { withAuth } from '@/lib/middleware';
import { handleApiError } from '@/lib/api-error';

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = sanitizeObject(await req.json());
    const email = sanitizeString(body?.email).toLowerCase();
    const firstName = sanitizeString(body?.firstName);
    const lastName = sanitizeString(body?.lastName);
    const country = sanitizeString(body?.country);
    const department = sanitizeString(body?.department);
    const password = sanitizeString(body?.password);

    if (!isEmail(email) || !isNonEmptyString(firstName) || !isNonEmptyString(lastName) || !isNonEmptyString(country) || !isNonEmptyString(department) || !isNonEmptyString(password) || password.length < 8) {
      return NextResponse.json({ success: false, message: 'Invalid learner payload' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('learners');
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Email already registered' }, { status: 409 });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const learner = {
      email,
      firstName,
      lastName,
      country,
      department,
      password: hashedPassword,
      createdAt: new Date(),
      status: 'active',
      role: 'learner',
    };
    await db.collection('users').insertOne(learner);
    return NextResponse.json({ success: true, message: 'Learner created' });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to create learner right now. Please try again.',
      logMessage: 'Admin learner creation endpoint failed',
    });
  }
}, { roles: ['admin'] });
