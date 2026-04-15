import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import { enforceRateLimit, isEmail, isNonEmptyString, sanitizeObject, sanitizeString } from '@/lib/security';
import { withAuth } from '@/lib/middleware';
import { handleApiError } from '@/lib/api-error';

type InviteEmailInput = {
  to: string;
  firstName: string;
  organisation: string;
  invitationToken: string;
};

type AuthUser = {
  email?: string;
  organisation?: string;
};

function getBaseUrl(req: NextRequest) {
  const configured = sanitizeString(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL);
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const protocol = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
  return `${protocol}://${host}`.replace(/\/$/, '');
}

function createInviteTokenPayload() {
  const invitationToken = crypto.randomBytes(32).toString('hex');
  const invitationTokenHash = crypto.createHash('sha256').update(invitationToken).digest('hex');
  const invitationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  return {
    invitationToken,
    invitationTokenHash,
    invitationExpiresAt,
  };
}

async function sendInviteEmail(req: NextRequest, input: InviteEmailInput) {
  const templatePath = path.join(process.cwd(), 'public', 'email-templates', 'invite-signup.html');
  let html = await fs.readFile(templatePath, 'utf-8');
  const signupLink = `${getBaseUrl(req)}/signup?token=${input.invitationToken}`;
  html = html
    .replace(/{{firstName}}/g, input.firstName)
    .replace(/{{organisation}}/g, input.organisation)
    .replace(/{{signupLink}}/g, signupLink)
    .replace(/{{expiresIn}}/g, '7 days');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject: 'Complete your RiskAware account setup',
    html,
  });
}

function getAuthUser(req: NextRequest) {
  return (req as NextRequest & { user?: AuthUser }).user;
}

function getAdminOrganisation(req: NextRequest) {
  const authUser = getAuthUser(req);
  return sanitizeString(authUser?.organisation);
}

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'admin-learner-list',
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const organisation = getAdminOrganisation(req);
    if (!isNonEmptyString(organisation)) {
      return NextResponse.json({ success: false, message: 'Admin organisation is missing from session' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('learners');
    const users = db.collection('users');

    const learners = await users
      .find(
        {
          organisation,
          role: 'learner',
          status: { $ne: 'deleted' },
        },
        {
          projection: {
            password: 0,
            invitationTokenHash: 0,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ success: true, learners });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load learners right now. Please try again.',
      logMessage: 'Admin learner list endpoint failed',
    });
  }
}, { roles: ['admin'] });

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'admin-learner-invite',
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = sanitizeObject(await req.json());
    const email = sanitizeString(body?.email).toLowerCase();
    const firstName = sanitizeString(body?.firstName);
    const lastName = sanitizeString(body?.lastName);
    const country = sanitizeString(body?.country);
    const department = sanitizeString(body?.department);
    const organisation = getAdminOrganisation(req);

    if (!isEmail(email) || !isNonEmptyString(firstName) || !isNonEmptyString(lastName) || !isNonEmptyString(country) || !isNonEmptyString(department) || !isNonEmptyString(organisation)) {
      return NextResponse.json({ success: false, message: 'Invalid learner payload' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('learners');
    const users = db.collection('users');

    const existing = await users.findOne({ email });
    if (existing && sanitizeString(existing.organisation) !== organisation) {
      return NextResponse.json({ success: false, message: 'Email already belongs to another organisation' }, { status: 409 });
    }
    if (existing && existing.status === 'active') {
      return NextResponse.json({ success: false, message: 'Email already registered as an active user' }, { status: 409 });
    }

    const { invitationToken, invitationTokenHash, invitationExpiresAt } = createInviteTokenPayload();

    const learner = {
      email,
      firstName,
      lastName,
      country,
      department,
      organisation,
      password: null,
      createdAt: new Date(),
      status: 'invited',
      role: 'learner',
      invitationTokenHash,
      invitationExpiresAt,
      invitedAt: new Date(),
    };

    if (existing) {
      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            firstName,
            lastName,
            country,
            department,
            organisation,
            role: 'learner',
            status: 'invited',
            invitationTokenHash,
            invitationExpiresAt,
            invitedAt: new Date(),
            password: null,
          },
        }
      );
    } else {
      await users.insertOne(learner);
    }

    await sendInviteEmail(req, {
      to: email,
      firstName,
      organisation,
      invitationToken,
    });

    return NextResponse.json({ success: true, message: 'Invite sent successfully' });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to invite learner right now. Please try again.',
      logMessage: 'Admin learner invite endpoint failed',
    });
  }
}, { roles: ['admin'] });

export const PATCH = withAuth(async (req: NextRequest) => {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'admin-learner-resend-invite',
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = sanitizeObject(await req.json());
    const action = sanitizeString(body?.action || 'resend').toLowerCase();
    const email = sanitizeString(body?.email).toLowerCase();
    const regenerate = body?.regenerate !== false;
    const organisation = getAdminOrganisation(req);

    if (action === 'edit') {
      const learnerId = sanitizeString(body?.learnerId);
      const firstName = sanitizeString(body?.firstName);
      const lastName = sanitizeString(body?.lastName);
      const country = sanitizeString(body?.country);
      const department = sanitizeString(body?.department);

      if (!isNonEmptyString(organisation)) {
        return NextResponse.json({ success: false, message: 'Admin organisation is missing from session' }, { status: 403 });
      }
      if (!isNonEmptyString(learnerId) || !ObjectId.isValid(learnerId)) {
        return NextResponse.json({ success: false, message: 'Valid learner id is required' }, { status: 400 });
      }
      if (!isNonEmptyString(firstName) || !isNonEmptyString(lastName) || !isNonEmptyString(country) || !isNonEmptyString(department)) {
        return NextResponse.json({ success: false, message: 'All learner fields are required' }, { status: 400 });
      }

      const client = await clientPromise;
      const db = client.db('learners');
      const users = db.collection('users');

      const result = await users.updateOne(
        {
          _id: new ObjectId(learnerId),
          organisation,
          role: 'learner',
          status: { $ne: 'deleted' },
        },
        {
          $set: {
            firstName,
            lastName,
            country,
            department,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ success: false, message: 'Learner not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: 'Learner updated successfully' });
    }

    if (!isEmail(email)) {
      return NextResponse.json({ success: false, message: 'Valid learner email is required' }, { status: 400 });
    }
    if (!isNonEmptyString(organisation)) {
      return NextResponse.json({ success: false, message: 'Admin organisation is missing from session' }, { status: 403 });
    }
    if (!regenerate) {
      return NextResponse.json({ success: false, message: 'For security, invites are stored hashed and must be regenerated when resending' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('learners');
    const users = db.collection('users');

    const existing = await users.findOne({ email, organisation });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Learner not found' }, { status: 404 });
    }
    if (existing.status === 'active') {
      return NextResponse.json({ success: false, message: 'Learner is already active and cannot be re-invited' }, { status: 409 });
    }

    const firstName = sanitizeString(existing.firstName);
    const learnerOrganisation = sanitizeString(existing.organisation);
    if (!isNonEmptyString(firstName) || !isNonEmptyString(learnerOrganisation)) {
      return NextResponse.json({ success: false, message: 'Learner is missing required invite details' }, { status: 400 });
    }

    const { invitationToken, invitationTokenHash, invitationExpiresAt } = createInviteTokenPayload();

    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          status: 'invited',
          invitationTokenHash,
          invitationExpiresAt,
          invitedAt: new Date(),
          password: null,
        },
      }
    );

    await sendInviteEmail(req, {
      to: email,
      firstName,
      organisation: learnerOrganisation,
      invitationToken,
    });

    return NextResponse.json({ success: true, message: 'Invite regenerated and resent successfully' });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to resend invite right now. Please try again.',
      logMessage: 'Admin learner resend invite endpoint failed',
    });
  }
}, { roles: ['admin'] });

export const DELETE = withAuth(async (req: NextRequest) => {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'admin-learner-delete',
      limit: 30,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = sanitizeObject(await req.json());
    const learnerId = sanitizeString(body?.learnerId);
    const organisation = getAdminOrganisation(req);

    if (!isNonEmptyString(organisation)) {
      return NextResponse.json({ success: false, message: 'Admin organisation is missing from session' }, { status: 403 });
    }
    if (!isNonEmptyString(learnerId) || !ObjectId.isValid(learnerId)) {
      return NextResponse.json({ success: false, message: 'Valid learner id is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('learners');
    const users = db.collection('users');

    const result = await users.updateOne(
      {
        _id: new ObjectId(learnerId),
        organisation,
        role: 'learner',
        status: { $ne: 'deleted' },
      },
      {
        $set: {
          status: 'deleted',
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Learner not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Learner deleted successfully' });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to delete learner right now. Please try again.',
      logMessage: 'Admin learner delete endpoint failed',
    });
  }
}, { roles: ['admin'] });
