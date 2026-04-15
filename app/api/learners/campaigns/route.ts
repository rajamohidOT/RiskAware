import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isNonEmptyString, isValidObjectIdLike, sanitizeObject, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    // Get user from session (placeholder: replace with real session logic)
    const userEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!userEmail) {
      return NextResponse.json({ success: false, message: 'Please sign in to continue.' }, { status: 401 });
    }
    const client = await clientPromise;
    const campaignsDb = client.db('data');
    const campaigns = await campaignsDb.collection('campaigns').find({
      $or: [
        { users: userEmail },
        { users: 'all' }
      ]
    }).toArray();
    return NextResponse.json({ campaigns });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load campaigns right now. Please try again.',
      logMessage: 'Campaign GET endpoint failed',
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get admin from session (placeholder: replace with real session logic)
    const adminEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!adminEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }
    const client = await clientPromise;
    const usersDb = client.db('learners');
    const campaignsDb = client.db('data');
    const admin = await usersDb.collection('users').findOne({ email: adminEmail, role: 'admin' });
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
    }
    const body = sanitizeObject(await req.json());
    const {
      name,
      description,
      startDate,
      endDate,
      users,
      type,
      assignments
    } = body;

    if (!isNonEmptyString(name) || !isNonEmptyString(description) || !isNonEmptyString(startDate) || !isNonEmptyString(endDate) || (!Array.isArray(users) && users !== 'all') || !isNonEmptyString(type) || !Array.isArray(assignments)) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    if (!['attack', 'training'].includes(type)) {
      return NextResponse.json({ success: false, message: 'Invalid campaign type' }, { status: 400 });
    }
    const campaign = {
      name,
      description,
      startDate,
      endDate,
      users,
      type,
      assignments,
      createdAt: new Date(),
      createdBy: adminEmail,
      organisation: admin.organisation || null,
    };
    const result = await campaignsDb.collection('campaigns').insertOne(campaign);
    return NextResponse.json({ success: true, campaignId: result.insertedId });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to create campaign right now. Please try again.',
      logMessage: 'Campaign POST endpoint failed',
    });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = sanitizeObject(await req.json());
    const { id, ...updateFields } = body;
    const sanitizedId = sanitizeString(id);

    if (!sanitizedId) {
      return NextResponse.json({ success: false, message: 'Missing campaign id' }, { status: 400 });
    }
    if (!isValidObjectIdLike(sanitizedId)) {
      return NextResponse.json({ success: false, message: 'Invalid campaign id format' }, { status: 400 });
    }

    const client = await clientPromise;
    const campaignsDb = client.db('data');
    const result = await campaignsDb.collection('campaigns').updateOne(
      { _id: new ObjectId(sanitizedId) },
      { $set: { ...updateFields, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to update campaign right now. Please try again.',
      logMessage: 'Campaign PATCH endpoint failed',
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = sanitizeObject(await req.json());
    const id = sanitizeString(body?.id);

    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing campaign id' }, { status: 400 });
    }
    if (!isValidObjectIdLike(id)) {
      return NextResponse.json({ success: false, message: 'Invalid campaign id format' }, { status: 400 });
    }

    const client = await clientPromise;
    const campaignsDb = client.db('data');
    const result = await campaignsDb.collection('campaigns').deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to delete campaign right now. Please try again.',
      logMessage: 'Campaign DELETE endpoint failed',
    });
  }
}
