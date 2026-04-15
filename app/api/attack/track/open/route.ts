import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { hashTrackingToken, deriveAttackStage } from '@/lib/attack-tracking';
import { sanitizeString } from '@/lib/security';

const PIXEL_GIF_BASE64 = 'R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=';

export async function GET(req: NextRequest) {
  const token = sanitizeString(req.nextUrl.searchParams.get('t'));
  const method = sanitizeString(req.nextUrl.searchParams.get('m')) || 'img';
  const userAgent = sanitizeString(req.headers.get('user-agent'));

  if (token) {
    try {
      const client = await clientPromise;
      const db = client.db('data');
      const collection = db.collection('attack-simulation-events');
      const tokenHash = hashTrackingToken(token);

      const existing = await collection.findOne({ tokenHash });
      if (existing) {
        const openedAt = existing.openedAt || new Date();
        const stage = deriveAttackStage({
          openedAt,
          clickedAt: existing.clickedAt || null,
          reportedAt: existing.reportedAt || null,
          credentialsSubmittedAt: existing.credentialsSubmittedAt || null,
        });

        await collection.updateOne(
          { tokenHash },
          {
            $set: {
              openedAt,
              status: stage,
              updatedAt: new Date(),
            },
            $push: {
              openSignals: {
                method,
                userAgent,
                trackedAt: new Date(),
              },
            },
          }
        );
      }
    } catch {
    }
  }

  const buffer = Buffer.from(PIXEL_GIF_BASE64, 'base64');
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
