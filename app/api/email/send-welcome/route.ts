import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import path from 'path';
import { enforceRateLimit, isEmail, isNonEmptyString, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'email-welcome',
      limit: 20,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const to = sanitizeString(body?.to).toLowerCase();
    const firstName = sanitizeString(body?.firstName);

    if (!isEmail(to) || !isNonEmptyString(firstName)) {
      return NextResponse.json({ success: false, message: 'Invalid email payload' }, { status: 400 });
    }

    const templatePath = path.join(process.cwd(), 'public', 'email-templates', 'welcome.html');
    let html = await fs.readFile(templatePath, 'utf-8');
    html = html.replace(/{{firstName}}/g, firstName);
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
      subject: 'Welcome to RiskAware',
      html,
    });
    return NextResponse.json({ success: true, message: 'Welcome email sent' });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to send the welcome email right now. Please try again.',
      logMessage: 'Send welcome email endpoint failed',
    });
  }
}
