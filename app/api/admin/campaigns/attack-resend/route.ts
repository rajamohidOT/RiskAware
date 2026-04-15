import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { enforceRateLimit, isValidObjectIdLike, sanitizeObject, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';
import { sendAttackSimulationEmails } from '@/lib/attack-email';

type AttackAssignment = {
  id?: string;
  title?: string;
  subject?: string;
  templateFile?: string;
  collectsCredentials?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      keyPrefix: 'admin-attack-resend',
      limit: 20,
      windowMs: 60 * 1000,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const adminEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!adminEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = sanitizeObject(await req.json());
    const campaignId = sanitizeString(body?.campaignId);

    if (!isValidObjectIdLike(campaignId)) {
      return NextResponse.json({ success: false, message: 'Invalid campaign id' }, { status: 400 });
    }

    const client = await clientPromise;
    const usersDb = client.db('learners');
    const dataDb = client.db('data');

    const admin = await usersDb.collection('users').findOne({
      email: adminEmail,
      role: 'admin',
      status: { $ne: 'deleted' },
    });
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
    }

    const campaign = await dataDb.collection('campaigns').findOne({
      _id: new ObjectId(campaignId),
      organisation: admin.organisation || null,
      type: 'attack',
    });

    if (!campaign) {
      return NextResponse.json({ success: false, message: 'Attack campaign not found' }, { status: 404 });
    }

    const assignments = (Array.isArray(campaign.assignments) ? campaign.assignments : []) as AttackAssignment[];
    if (assignments.length === 0) {
      return NextResponse.json({ success: false, message: 'No attack templates configured on this campaign' }, { status: 400 });
    }

    const recipientsRaw = campaign.users === 'all'
      ? await usersDb.collection('users').find(
          {
            organisation: admin.organisation || null,
            role: 'learner',
            status: 'active',
          },
          { projection: { email: 1, firstName: 1 } }
        ).toArray()
      : await usersDb.collection('users').find(
          {
            email: { $in: Array.isArray(campaign.users) ? campaign.users : [] },
            role: 'learner',
            status: 'active',
            organisation: admin.organisation || null,
          },
          { projection: { email: 1, firstName: 1 } }
        ).toArray();

    const recipients = recipientsRaw
      .map((recipient) => ({
        email: sanitizeString(recipient.email).toLowerCase(),
        firstName: sanitizeString(recipient.firstName),
      }))
      .filter((recipient) => Boolean(recipient.email));

    if (recipients.length === 0) {
      return NextResponse.json({ success: false, message: 'No active learners available for resend' }, { status: 400 });
    }

    const normalizedAssignments = assignments
      .map((assignment) => ({
        id: sanitizeString(assignment.id),
        title: sanitizeString(assignment.title),
        subject: sanitizeString(assignment.subject),
        description: '',
        templateFile: sanitizeString(assignment.templateFile),
        collectsCredentials: Boolean(assignment.collectsCredentials),
      }))
      .filter((assignment) => assignment.id && assignment.templateFile);

    await sendAttackSimulationEmails({
      campaignsDb: dataDb,
      campaignId: campaign._id,
      campaignName: sanitizeString(campaign.name),
      organisation: campaign.organisation || null,
      recipients,
      assignments: normalizedAssignments,
    });

    return NextResponse.json({ success: true, message: `Attack simulation emails resent to ${recipients.length} learner(s)` });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to resend attack simulation emails right now. Please try again.',
      logMessage: 'Admin attack resend endpoint failed',
    });
  }
}
