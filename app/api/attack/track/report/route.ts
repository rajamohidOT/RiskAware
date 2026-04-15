import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { hashTrackingToken, deriveAttackStage } from '@/lib/attack-tracking';
import { sanitizeString } from '@/lib/security';

async function trackReportedEvent(token: string) {
  const client = await clientPromise;
  const db = client.db('data');
  const collection = db.collection('attack-simulation-events');
  const tokenHash = hashTrackingToken(token);

  const existing = await collection.findOne({ tokenHash });
  if (!existing) {
    return { ok: false as const, reason: 'not-found' as const };
  }

  const reportedAt = existing.reportedAt || new Date();
  const stage = deriveAttackStage({
    openedAt: existing.openedAt || null,
    clickedAt: existing.clickedAt || null,
    reportedAt,
    credentialsSubmittedAt: existing.credentialsSubmittedAt || null,
  });

  await collection.updateOne(
    { tokenHash },
    {
      $set: {
        reportedAt,
        status: stage,
        updatedAt: new Date(),
      },
    }
  );

  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  const token = sanitizeString(req.nextUrl.searchParams.get('t'));
  if (!token) {
    return NextResponse.redirect(new URL('/signin', req.url));
  }

  try {
    await trackReportedEvent(token);
  } catch {
  }

  return NextResponse.redirect(new URL(`/attack-sim/${token}?reported=1`, req.url));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = sanitizeString(body?.token);

    if (!token) {
      return NextResponse.json({ success: false, message: 'Tracking token is required' }, { status: 400 });
    }

    const result = await trackReportedEvent(token);
    if (!result.ok) {
      return NextResponse.json({ success: false, message: 'Tracking record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Suspicious email reported' });
  } catch {
    return NextResponse.json({ success: false, message: 'Unable to report suspicious email' }, { status: 500 });
  }
}
