import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { sendAttackSimulationEmails } from '@/lib/attack-email';
import type { AttackTemplateOption } from '@/lib/campaign-options';
import { sanitizeString } from '@/lib/security';

type AttackEmailJob = {
  _id: ObjectId;
  campaignId: ObjectId;
  campaignName: string;
  organisation?: string | null;
  recipients: Array<{ email: string; firstName?: string }>;
  assignments: AttackTemplateOption[];
  sendAt: Date;
  status: 'scheduled' | 'processing' | 'sent' | 'failed';
  attempts?: number;
};

function isAuthorizedDispatchRequest(req: NextRequest) {
  const expected = sanitizeString(process.env.ATTACK_EMAIL_CRON_SECRET);
  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }

  const bearer = sanitizeString(req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  const query = sanitizeString(req.nextUrl.searchParams.get('key'));
  return bearer === expected || query === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedDispatchRequest(req)) {
    return NextResponse.json({ success: false, message: 'Not authorized for dispatch' }, { status: 403 });
  }

  const client = await clientPromise;
  const campaignsDb = client.db('data');
  const jobsCollection = campaignsDb.collection('attack-email-jobs');

  const now = new Date();
  const jobs = (await jobsCollection.find({
    status: 'scheduled',
    sendAt: { $lte: now },
  }).limit(20).toArray()) as AttackEmailJob[];

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    const lock = await jobsCollection.updateOne(
      { _id: job._id, status: 'scheduled' },
      {
        $set: {
          status: 'processing',
          updatedAt: new Date(),
        },
      }
    );

    if (lock.matchedCount === 0) {
      continue;
    }

    try {
      await sendAttackSimulationEmails({
        campaignsDb,
        campaignId: job.campaignId,
        campaignName: sanitizeString(job.campaignName),
        organisation: job.organisation || null,
        recipients: Array.isArray(job.recipients) ? job.recipients : [],
        assignments: Array.isArray(job.assignments) ? job.assignments : [],
      });

      await jobsCollection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'sent',
            sentAt: new Date(),
            updatedAt: new Date(),
          },
          $inc: { attempts: 1 },
        }
      );
      sent += 1;
    } catch (error) {
      const attempts = (job.attempts || 0) + 1;
      const nextStatus = attempts >= 5 ? 'failed' : 'scheduled';
      await jobsCollection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: nextStatus,
            updatedAt: new Date(),
            lastError: error instanceof Error ? error.message : 'Dispatch failed',
          },
          $inc: { attempts: 1 },
        }
      );
      failed += 1;
    }
  }

  return NextResponse.json({
    success: true,
    processed: jobs.length,
    sent,
    failed,
  });
}
