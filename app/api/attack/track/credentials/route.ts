import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { hashTrackingToken, deriveAttackStage } from '@/lib/attack-tracking';
import { sanitizeString } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = sanitizeString(body?.token);

    if (!token) {
      return NextResponse.json({ success: false, message: 'Tracking token is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('data');
    const collection = db.collection('attack-simulation-events');
    const tokenHash = hashTrackingToken(token);

    const existing = await collection.findOne({ tokenHash });
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Tracking record not found' }, { status: 404 });
    }

    const clickedAt = existing.clickedAt || new Date();
    const credentialsSubmittedAt = existing.credentialsSubmittedAt || new Date();
    const stage = deriveAttackStage({
      openedAt: existing.openedAt || null,
      clickedAt,
      reportedAt: existing.reportedAt || null,
      credentialsSubmittedAt,
    });

    await collection.updateOne(
      { tokenHash },
      {
        $set: {
          clickedAt,
          credentialsSubmittedAt,
          status: stage,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true, message: 'Credentials entered' });
  } catch {
    return NextResponse.json({ success: false, message: 'Unable to track credential event' }, { status: 500 });
  }
}
