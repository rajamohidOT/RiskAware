import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import path from 'path';
import type { Db, ObjectId } from 'mongodb';
import { createTrackingToken, hashTrackingToken } from '@/lib/attack-tracking';
import { sanitizeString } from '@/lib/security';
import type { AttackTemplateOption } from '@/lib/campaign-options';

export type AttackEmailRecipient = {
  email: string;
  firstName?: string;
};

function getAppBaseUrl() {
  return sanitizeString(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function sendAttackSimulationEmails(params: {
  campaignsDb: Db;
  campaignId: ObjectId;
  campaignName: string;
  organisation: string | null | undefined;
  recipients: AttackEmailRecipient[];
  assignments: AttackTemplateOption[];
}) {
  if (params.recipients.length === 0 || params.assignments.length === 0) {
    return;
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

  const baseUrl = getAppBaseUrl();
  const trackingCollection = params.campaignsDb.collection('attack-simulation-events');

  await Promise.all(
    params.assignments.map(async (assignment) => {
      const templatePath = path.join(process.cwd(), 'public', 'email-templates', 'attack', String(assignment.templateFile || ''));
      const templateHtml = await fs.readFile(templatePath, 'utf-8');

      await Promise.all(
        params.recipients.map(async (recipient) => {
          const token = createTrackingToken();
          const tokenHash = hashTrackingToken(token);

          await trackingCollection.insertOne({
            tokenHash,
            campaignId: params.campaignId,
            campaignName: params.campaignName,
            organisation: params.organisation || null,
            learnerEmail: recipient.email,
            learnerFirstName: sanitizeString(recipient.firstName),
            templateId: assignment.id,
            templateTitle: assignment.title,
            collectsCredentials: assignment.collectsCredentials,
            status: 'email unopened',
            sentAt: new Date(),
            openedAt: null,
            clickedAt: null,
            reportedAt: null,
            credentialsSubmittedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const clickUrl = `${baseUrl}/api/attack/track/click?t=${token}`;
          const reportLink = `${baseUrl}/api/attack/track/report?t=${token}&src=email`;
          const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          const openPixelUrl = `${baseUrl}/api/attack/track/open?t=${token}&m=img&n=${nonce}`;
          const openPixelUrlAlt = `${baseUrl}/api/attack/track/open?t=${token}&m=img-alt&n=${nonce}`;
          const openPixelCssUrl = `${baseUrl}/api/attack/track/open?t=${token}&m=css-bg&n=${nonce}`;

          const html = templateHtml
            .replace(/{{firstName}}/g, sanitizeString(recipient.firstName) || 'Learner')
            .replace(/{{organisation}}/g, sanitizeString(params.organisation) || 'your organisation')
            .replace(/{{ctaLink}}/g, clickUrl)
            .replace(/{{reportLink}}/g, reportLink)
            .replace(/{{openPixelUrl}}/g, openPixelUrl)
            .replace(/{{openPixelUrlAlt}}/g, openPixelUrlAlt)
            .replace(/{{openPixelCssUrl}}/g, openPixelCssUrl);

          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: recipient.email,
            subject: String(assignment.subject || assignment.title || 'Security Notice'),
            html,
          });
        })
      );
    })
  );
}
