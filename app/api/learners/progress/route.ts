import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { isNonEmptyString, isValidObjectIdLike, sanitizeObject, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

const ATTACK_STATUSES = ['unopened', 'opened', 'link clicked', 'credentials entered'] as const;
type AttackStatus = (typeof ATTACK_STATUSES)[number];

function isValidObjectId(id: string) {
  return ObjectId.isValid(id);
}

function isAssignedToCampaign(campaign: any, learnerEmail: string) {
  if (campaign?.users === 'all') {
    return true;
  }

  if (Array.isArray(campaign?.users) && campaign.users.includes(learnerEmail)) {
    return true;
  }

  if (Array.isArray(campaign?.assignments)) {
    return campaign.assignments.some((assignment: any) => {
      const assignmentUser = assignment?.userEmail || assignment?.email || assignment?.userId;
      return assignmentUser === learnerEmail;
    });
  }

  return false;
}

function normalizeStatus(status: string): AttackStatus | null {
  const trimmed = String(status || '').trim().toLowerCase();
  const found = ATTACK_STATUSES.find((s) => s === trimmed);
  return found || null;
}

function isForwardAttackTransition(currentStatus: AttackStatus | undefined, nextStatus: AttackStatus) {
  if (!currentStatus) {
    return true;
  }

  const order: Record<AttackStatus, number> = {
    unopened: 0,
    opened: 1,
    'link clicked': 2,
    'credentials entered': 3,
  };

  return order[nextStatus] >= order[currentStatus];
}

export async function GET(req: NextRequest) {
  try {
    const learnerEmail = req.cookies.get('session')?.value;
    if (!learnerEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const campaignId = sanitizeString(req.nextUrl.searchParams.get('campaignId'));
    const type = sanitizeString(req.nextUrl.searchParams.get('type'));

    const query: any = { learnerEmail };

    if (campaignId) {
      if (!isValidObjectIdLike(campaignId) || !isValidObjectId(campaignId)) {
        return NextResponse.json({ success: false, message: 'Invalid campaignId' }, { status: 400 });
      }
      query.campaignId = new ObjectId(campaignId);
    }

    if (type) {
      if (!['attack', 'training'].includes(type)) {
        return NextResponse.json({ success: false, message: 'Invalid type. Use attack or training.' }, { status: 400 });
      }
      query.type = type;
    }

    const client = await clientPromise;
    const db = client.db('data');
    const progress = await db.collection('learner-progress').find(query).sort({ updatedAt: -1 }).toArray();

    return NextResponse.json({ success: true, progress });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load campaign progress right now. Please try again.',
      logMessage: 'Campaign progress GET endpoint failed',
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const learnerEmail = req.cookies.get('session')?.value;
    if (!learnerEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = sanitizeObject(await req.json());
    const campaignId = sanitizeString(body?.campaignId);
    const type = sanitizeString(body?.type);
    const itemId = sanitizeString(body?.itemId);
    const status = sanitizeString(body?.status);
    const result = body?.result;

    if (!isNonEmptyString(campaignId) || !isNonEmptyString(type) || !isNonEmptyString(itemId)) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: campaignId, type, itemId' },
        { status: 400 }
      );
    }

    if (!isValidObjectIdLike(campaignId) || !isValidObjectId(campaignId)) {
      return NextResponse.json({ success: false, message: 'Invalid campaignId' }, { status: 400 });
    }

    if (!isValidObjectIdLike(itemId) || !isValidObjectId(itemId)) {
      return NextResponse.json({ success: false, message: 'Invalid itemId' }, { status: 400 });
    }

    if (!['attack', 'training'].includes(type)) {
      return NextResponse.json({ success: false, message: 'Invalid type. Use attack or training.' }, { status: 400 });
    }

    const client = await clientPromise;
    const progressDb = client.db('data');
    const dataDb = client.db('data');

    const campaign = await dataDb.collection('campaigns').findOne({ _id: new ObjectId(campaignId) });
    if (!campaign) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }

    if (!isAssignedToCampaign(campaign, learnerEmail)) {
      return NextResponse.json({ success: false, message: 'You are not assigned to this campaign' }, { status: 403 });
    }

    if (campaign.type !== type) {
      return NextResponse.json(
        { success: false, message: `Campaign type mismatch. This campaign is ${campaign.type}.` },
        { status: 400 }
      );
    }

    const baseFilter = {
      campaignId: new ObjectId(campaignId),
      learnerEmail,
      type,
      itemId: String(itemId),
    };

    const itemCollectionName = type === 'attack' ? 'attack-simulations' : 'training';
    const itemExists = await dataDb.collection(itemCollectionName).findOne({ _id: new ObjectId(itemId) });
    if (!itemExists) {
      return NextResponse.json(
        { success: false, message: `${type === 'attack' ? 'Attack simulation' : 'Training module'} not found` },
        { status: 404 }
      );
    }

    const existingProgress = await progressDb.collection('learner-progress').findOne(baseFilter);

    if (type === 'attack') {
      const normalizedStatus = normalizeStatus(status);
      if (!normalizedStatus) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid attack status. Use one of: unopened, opened, link clicked, credentials entered.',
          },
          { status: 400 }
        );
      }

      if (!isForwardAttackTransition(existingProgress?.status, normalizedStatus)) {
        return NextResponse.json(
          { success: false, message: 'Attack status cannot move backwards.' },
          { status: 400 }
        );
      }

      await progressDb.collection('learner-progress').updateOne(
        baseFilter,
        {
          $set: {
            status: normalizedStatus,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    if (type === 'training') {
      if (!result) {
        return NextResponse.json(
          { success: false, message: 'Training updates require result payload.' },
          { status: 400 }
        );
      }

      await progressDb.collection('learner-progress').updateOne(
        baseFilter,
        {
          $set: {
            status: 'completed',
            result,
            completedAt: new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true, message: 'Progress updated' });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to submit campaign progress right now. Please try again.',
      logMessage: 'Campaign progress POST endpoint failed',
    });
  }
}
