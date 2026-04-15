import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    const learnerEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!learnerEmail) {
      return NextResponse.json({ success: false, message: 'Please sign in to continue.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('learners');
    const learner = await db.collection('users').findOne(
      { email: learnerEmail, status: { $ne: 'deleted' } },
      { projection: { password: 0 } }
    );

    if (!learner) {
      return NextResponse.json({ success: false, message: 'Learner profile not found.' }, { status: 404 });
    }
    return NextResponse.json(learner);
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load learner profile right now. Please try again.',
      logMessage: 'Learner profile endpoint failed',
    });
  }
}
