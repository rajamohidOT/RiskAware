import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { enforceRateLimit, isNonEmptyString, sanitizeObject, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    const token = sanitizeString(req.nextUrl.searchParams.get('token'));

    if (!isNonEmptyString(token)) {
      return NextResponse.json({ success: false, message: 'Invite token is required' }, { status: 400 });
    }

    const invitationTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const client = await clientPromise;
    const db = client.db('learners');

    const learner = await db.collection('users').findOne(
      {
        invitationTokenHash,
        status: 'invited',
        invitationExpiresAt: { $gt: new Date() },
      },
      {
        projection: {
          email: 1,
          firstName: 1,
          lastName: 1,
          country: 1,
          department: 1,
          organisation: 1,
        },
      }
    );

    if (!learner) {
      return NextResponse.json({ success: false, message: 'Invite link is invalid or has expired' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      invite: {
        email: learner.email,
        firstName: learner.firstName,
        lastName: learner.lastName,
        country: learner.country,
        department: learner.department,
        organisation: learner.organisation,
      },
    });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load invite details right now. Please try again.',
      logMessage: 'Learner signup invite lookup failed',
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'learner-signup-complete',
      limit: 10,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = sanitizeObject(await req.json());
    const token = sanitizeString(body?.token);
    const password = sanitizeString(body?.password);
    const confirmPassword = sanitizeString(body?.confirmPassword);

    if (!isNonEmptyString(token) || !isNonEmptyString(password) || password.length < 8) {
      return NextResponse.json({ success: false, message: 'Invalid signup payload' }, { status: 400 });
    }
    if (isNonEmptyString(confirmPassword) && password !== confirmPassword) {
      return NextResponse.json({ success: false, message: 'Passwords do not match' }, { status: 400 });
    }

    const invitationTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const client = await clientPromise;
    const db = client.db('learners');
    const users = db.collection('users');

    const invitedUser = await users.findOne({
      invitationTokenHash,
      status: 'invited',
      invitationExpiresAt: { $gt: new Date() },
    });

    if (!invitedUser) {
      return NextResponse.json({ success: false, message: 'Invite token is invalid or has expired' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await users.updateOne(
      { _id: invitedUser._id },
      {
        $set: {
          password: hashedPassword,
          status: 'active',
          invitedAcceptedAt: new Date(),
        },
        $unset: {
          invitationTokenHash: '',
          invitationExpiresAt: '',
        },
      }
    );

    return NextResponse.json({ success: true, message: 'Signup successful' });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to create your account right now. Please try again.',
      logMessage: 'Learner signup endpoint failed',
    });
  }
}
