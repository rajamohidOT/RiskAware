import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { enforceRateLimit, isEmail, isNonEmptyString, sanitizeHtml, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'email-attack',
      limit: 20,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const to = sanitizeString(body?.to).toLowerCase();
    const subject = sanitizeString(body?.subject);
    const html = sanitizeHtml(body?.html);

    if (!isEmail(to) || !isNonEmptyString(subject) || !isNonEmptyString(html)) {
      return NextResponse.json({ success: false, message: 'Invalid email payload' }, { status: 400 });
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
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
    return NextResponse.json({ success: true, message: 'Attack simulation email sent' });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to send the attack simulation email right now. Please try again.',
      logMessage: 'Send attack email endpoint failed',
    });
  }
}