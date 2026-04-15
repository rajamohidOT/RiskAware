import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { hashTrackingToken, deriveAttackStage } from '@/lib/attack-tracking';
import { sanitizeString } from '@/lib/security';

export async function GET(req: NextRequest) {
  const token = sanitizeString(req.nextUrl.searchParams.get('t'));
  if (!token) {
    return NextResponse.redirect(new URL('/signin', req.url));
  }

  try {
    const client = await clientPromise;
    const db = client.db('data');
    const collection = db.collection('attack-simulation-events');
    const tokenHash = hashTrackingToken(token);

    const existing = await collection.findOne({ tokenHash });
    if (existing) {
      const clickedAt = existing.clickedAt || new Date();
      const stage = deriveAttackStage({
        openedAt: existing.openedAt || null,
        clickedAt,
        reportedAt: existing.reportedAt || null,
        credentialsSubmittedAt: existing.credentialsSubmittedAt || null,
      });

      await collection.updateOne(
        { tokenHash },
        {
          $set: {
            clickedAt,
            status: stage,
            updatedAt: new Date(),
          },
        }
      );
    }
  } catch {
  }

  return NextResponse.redirect(new URL(`/attack-sim/${token}`, req.url));
}
