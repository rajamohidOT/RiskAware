import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { enforceRateLimit, isValidObjectIdLike, sanitizeObject, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'admin-campaign-reminder',
      limit: 20,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const adminEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!adminEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = sanitizeObject(await req.json());
    const campaignId = sanitizeString(body?.campaignId);

    if (!isValidObjectIdLike(campaignId)) {
      return NextResponse.json({ success: false, message: 'Invalid campaign id' }, { status: 400 });
    }

    const client = await clientPromise;
    const usersDb = client.db('learners');
    const dataDb = client.db('data');

    const admin = await usersDb.collection('users').findOne({
      email: adminEmail,
      role: 'admin',
      status: { $ne: 'deleted' },
    });
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
    }

    const campaign = await dataDb.collection('campaigns').findOne({
      _id: new ObjectId(campaignId),
      organisation: admin.organisation || null,
    });

    if (!campaign) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }
    if (campaign.type !== 'training') {
      return NextResponse.json({ success: false, message: 'Reminders are only available for training campaigns' }, { status: 400 });
    }

    const recipients = campaign.users === 'all'
      ? await usersDb.collection('users').find(
          {
            organisation: admin.organisation || null,
            role: 'learner',
            status: 'active',
          },
          { projection: { email: 1, firstName: 1 } }
        ).toArray()
      : await usersDb.collection('users').find(
          {
            email: { $in: Array.isArray(campaign.users) ? campaign.users : [] },
            role: 'learner',
            status: 'active',
            organisation: admin.organisation || null,
          },
          { projection: { email: 1, firstName: 1 } }
        ).toArray();

    if (recipients.length === 0) {
      return NextResponse.json({ success: false, message: 'No active learners available for reminders' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const baseUrl = sanitizeString(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

    await Promise.all(
      recipients.map((recipient) => {
        const firstName = sanitizeString(recipient.firstName) || 'Learner';
        return transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: recipient.email,
          subject: `Reminder: ${campaign.name}`,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.5;">
              <p>Hi ${firstName},</p>
              <p>This is a reminder to complete your training campaign:</p>
              <p><strong>${campaign.name}</strong></p>
              <p>Please log in to your dashboard to continue.</p>
              <p><a href="${baseUrl}/dashboard">Open Dashboard</a></p>
            </div>
          `,
        });
      })
    );

    return NextResponse.json({ success: true, message: `Reminder sent to ${recipients.length} learner(s)` });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to send reminders right now. Please try again.',
      logMessage: 'Admin campaign reminder endpoint failed',
    });
  }
}
