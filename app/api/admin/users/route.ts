import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { withAuth } from '@/lib/middleware';
import { ObjectId } from 'mongodb';
import { isValidObjectIdLike, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

// PATCH: Promote/demote user (change role)
export const PATCH = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const id = sanitizeString(body?.id);
    const role = sanitizeString(body?.role);

    if (!id || !role) {
      return NextResponse.json({ success: false, message: 'User id and role are required.' }, { status: 400 });
    }
    if (!isValidObjectIdLike(id)) {
      return NextResponse.json({ success: false, message: 'Invalid user id format.' }, { status: 400 });
    }
    if (!['admin', 'learner'].includes(role)) {
      return NextResponse.json({ success: false, message: 'Role must be admin or learner.' }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db('learners');
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { role } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to update user role right now. Please try again.',
      logMessage: 'Admin users PATCH endpoint failed',
    });
  }
}, { roles: ['admin'] });

// POST: Soft-delete or restore user
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const id = sanitizeString(body?.id);
    const status = sanitizeString(body?.status);

    if (!id || !status) {
      return NextResponse.json({ success: false, message: 'User id and status are required.' }, { status: 400 });
    }
    if (!isValidObjectIdLike(id)) {
      return NextResponse.json({ success: false, message: 'Invalid user id format.' }, { status: 400 });
    }
    if (!['active', 'deleted'].includes(status)) {
      return NextResponse.json({ success: false, message: 'Status must be active or deleted.' }, { status: 400 });
    }
    const client = await clientPromise;
    const db = client.db('learners');
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to update learner status right now. Please try again.',
      logMessage: 'Admin users POST endpoint failed',
    });
  }
}, { roles: ['admin'] });
