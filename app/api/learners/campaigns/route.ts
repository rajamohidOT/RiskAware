import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Db, ObjectId } from 'mongodb';
import { isNonEmptyString, isValidObjectIdLike, sanitizeObject, sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';
import { ATTACK_TEMPLATE_OPTIONS, TRAINING_MODULE_OPTIONS, getAttackTemplateById, getTrainingModuleById, type AttackTemplateOption } from '@/lib/campaign-options';
import { sendAttackSimulationEmails } from '@/lib/attack-email';

type CampaignDoc = {
  _id: ObjectId;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  sendTime?: string;
  timezone?: string;
  users: 'all' | string[];
  type: 'attack' | 'training';
  assignments?: Array<{ id: string; title: string; [key: string]: unknown }>;
  createdBy?: string;
  organisation?: string | null;
};

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function parseDateParts(dateValue: string) {
  const match = sanitizeString(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return { year, month, day };
}

function parseTimeParts(timeValue: string) {
  const match = sanitizeString(timeValue).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return { hour, minute };
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0');

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
}

function normalizeAssignmentIds(rawAssignmentIds: unknown) {
  if (!Array.isArray(rawAssignmentIds)) {
    return [] as string[];
  }

  return rawAssignmentIds
    .map((value) => sanitizeString(value))
    .filter((value) => isNonEmptyString(value));
}

function normalizeUsers(rawUsers: unknown): 'all' | string[] | null {
  if (rawUsers === 'all') {
    return 'all';
  }
  if (!Array.isArray(rawUsers)) {
    return null;
  }

  const users = rawUsers
    .map((value) => sanitizeString(value).toLowerCase())
    .filter((value) => isNonEmptyString(value));

  return users;
}

function buildAssignmentsByType(type: 'attack' | 'training', assignmentIds: string[]) {
  if (type === 'attack') {
    const selected = assignmentIds
      .map((id) => getAttackTemplateById(id))
      .filter((item): item is (typeof ATTACK_TEMPLATE_OPTIONS)[number] => Boolean(item));
    return selected;
  }

  const selected = assignmentIds
    .map((id) => getTrainingModuleById(id))
    .filter((item): item is (typeof TRAINING_MODULE_OPTIONS)[number] => Boolean(item));
  return selected;
}

async function getAttackRecipients(usersDb: Db, organisation: string | null | undefined, users: 'all' | string[]) {
  if (users === 'all') {
    return usersDb.collection('users').find(
      {
        organisation: organisation || null,
        role: 'learner',
        status: 'active',
      },
      { projection: { email: 1, firstName: 1 } }
    ).toArray();
  }

  return usersDb.collection('users').find(
    {
      email: { $in: users },
      organisation: organisation || null,
      role: 'learner',
      status: 'active',
    },
    { projection: { email: 1, firstName: 1 } }
  ).toArray();
}

function deriveScheduledSendTime(startDate: string, sendTime: string, timezone: string) {
  const dateParts = parseDateParts(startDate);
  const timeParts = parseTimeParts(sendTime);
  const sanitizedTimezone = sanitizeString(timezone);

  if (!dateParts || !timeParts || !isValidTimezone(sanitizedTimezone)) {
    return new Date();
  }

  const desiredLocalEpoch = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    0,
    0
  );

  let utcEpoch = desiredLocalEpoch;
  for (let i = 0; i < 2; i += 1) {
    const zoned = getZonedParts(new Date(utcEpoch), sanitizedTimezone);
    const zonedLocalEpoch = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
      0
    );
    const offsetMs = zonedLocalEpoch - utcEpoch;
    utcEpoch = desiredLocalEpoch - offsetMs;
  }

  return new Date(utcEpoch);
}

function parseDate(dateValue: string) {
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCampaignState(campaign: CampaignDoc) {
  const now = new Date();
  const start = parseDate(campaign.startDate);
  const end = parseDate(campaign.endDate);

  if (!start || !end) {
    return 'inactive';
  }

  if (now < start || now > end) {
    return 'inactive';
  }

  return 'in-progress';
}

function computeCompletionPercentage(completedItems: number, enrolledUsers: number, assignmentCount: number) {
  if (enrolledUsers <= 0 || assignmentCount <= 0) {
    return 0;
  }

  const totalExpected = enrolledUsers * assignmentCount;
  const rawPercentage = (completedItems / totalExpected) * 100;
  return Math.max(0, Math.min(100, Number(rawPercentage.toFixed(1))));
}

export async function GET(req: NextRequest) {
  try {
    const userEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!userEmail) {
      return NextResponse.json({ success: false, message: 'Please sign in to continue.' }, { status: 401 });
    }

    const client = await clientPromise;
    const usersDb = client.db('learners');
    const campaignsDb = client.db('data');

    const user = await usersDb.collection('users').findOne({ email: userEmail, status: { $ne: 'deleted' } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin';

    const campaigns = (await campaignsDb.collection('campaigns').find(
      isAdmin
        ? { organisation: user.organisation || null }
        : {
            type: 'training',
            $or: [{ users: userEmail }, { users: 'all' }],
          }
    ).toArray()) as CampaignDoc[];

    const progressCollection = campaignsDb.collection('learner-progress');
    const attackTrackingCollection = campaignsDb.collection('attack-simulation-events');
    const activeLearnersInOrg = isAdmin
      ? await usersDb.collection('users').countDocuments({
          organisation: user.organisation || null,
          role: 'learner',
          status: 'active',
        })
      : 0;

    const mappedCampaigns = await Promise.all(
      campaigns.map(async (campaign) => {
        const assignmentCount = Array.isArray(campaign.assignments) ? campaign.assignments.length : 0;

        const enrolledUsers = campaign.users === 'all'
          ? (isAdmin ? activeLearnersInOrg : 1)
          : Array.isArray(campaign.users)
            ? campaign.users.length
            : 0;

        let completedItems = 0;
        if (campaign.type === 'training') {
          completedItems = await progressCollection.countDocuments({
            campaignId: campaign._id,
            type: 'training',
            status: 'completed',
          });
        } else {
          completedItems = await attackTrackingCollection.countDocuments({
            campaignId: campaign._id,
            $or: [
              { openedAt: { $ne: null } },
              { clickedAt: { $ne: null } },
              { reportedAt: { $ne: null } },
              { credentialsSubmittedAt: { $ne: null } },
            ],
          });
        }

        const completionPercentage = computeCompletionPercentage(completedItems, enrolledUsers, assignmentCount);
        const state = getCampaignState(campaign);

        const learnerCompleted = !isAdmin && completionPercentage >= 100;
        const status = learnerCompleted ? 'completed' : state;

        return {
          ...campaign,
          enrolledUsers,
          completionPercentage,
          status,
          canSendReminders: campaign.type === 'training' && isAdmin,
        };
      })
    );

    return NextResponse.json({ success: true, campaigns: mappedCampaigns });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load campaigns right now. Please try again.',
      logMessage: 'Campaign GET endpoint failed',
    });
  }
}

export async function POST(req: NextRequest) {
  try {
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
      sendTime,
      timezone,
      users,
      type,
      assignmentIds
    } = body;

    const sanitizedType = sanitizeString(type) as 'attack' | 'training';
    const sanitizedSendTime = sanitizeString(sendTime) || '09:00';
    const sanitizedTimezone = sanitizeString(timezone) || 'UTC';
    const sanitizedUsers = normalizeUsers(users);
    const selectedAssignmentIds = normalizeAssignmentIds(assignmentIds);

    if (!isNonEmptyString(name) || !isNonEmptyString(description) || !isNonEmptyString(startDate) || !isNonEmptyString(endDate) || !sanitizedUsers || !isNonEmptyString(sanitizedType) || selectedAssignmentIds.length === 0) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    if (!['attack', 'training'].includes(sanitizedType)) {
      return NextResponse.json({ success: false, message: 'Invalid campaign type' }, { status: 400 });
    }

    if (sanitizedType === 'attack' && !parseTimeParts(sanitizedSendTime)) {
      return NextResponse.json({ success: false, message: 'Invalid send time. Use HH:MM format.' }, { status: 400 });
    }

    if (sanitizedType === 'attack' && !isValidTimezone(sanitizedTimezone)) {
      return NextResponse.json({ success: false, message: 'Invalid timezone' }, { status: 400 });
    }

    const assignments = buildAssignmentsByType(sanitizedType, selectedAssignmentIds);
    if (assignments.length === 0) {
      return NextResponse.json({ success: false, message: 'Select valid modules/templates for this campaign type' }, { status: 400 });
    }

    const campaign = {
      name: sanitizeString(name),
      description: sanitizeString(description),
      startDate: sanitizeString(startDate),
      endDate: sanitizeString(endDate),
      users: sanitizedUsers,
      type: sanitizedType,
      sendTime: sanitizedType === 'attack' ? sanitizedSendTime : undefined,
      timezone: sanitizedType === 'attack' ? sanitizedTimezone : undefined,
      assignments,
      createdAt: new Date(),
      createdBy: adminEmail,
      organisation: admin.organisation || null,
    };
    const result = await campaignsDb.collection('campaigns').insertOne(campaign);

    if (sanitizedType === 'attack') {
      const rawRecipients = await getAttackRecipients(usersDb, admin.organisation || null, sanitizedUsers);
      const recipients = rawRecipients
        .map((recipient) => ({
          email: sanitizeString(recipient.email).toLowerCase(),
          firstName: sanitizeString(recipient.firstName),
        }))
        .filter((recipient) => isNonEmptyString(recipient.email));

      const sendAt = deriveScheduledSendTime(campaign.startDate, campaign.sendTime || '09:00', campaign.timezone || 'UTC');
      const now = new Date();

      if (sendAt <= now) {
        await sendAttackSimulationEmails({
          campaignsDb,
          campaignId: result.insertedId,
          campaignName: campaign.name,
          organisation: admin.organisation || null,
          recipients,
          assignments: assignments as AttackTemplateOption[],
        });
      } else {
        await campaignsDb.collection('attack-email-jobs').insertOne({
          campaignId: result.insertedId,
          campaignName: campaign.name,
          organisation: admin.organisation || null,
          recipients,
          assignments,
          sendAt,
          status: 'scheduled',
          attempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

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
    const adminEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!adminEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = sanitizeObject(await req.json());
    const { id, assignmentIds, ...updateFields } = body;
    const sanitizedId = sanitizeString(id);
    const campaignObjectId = new ObjectId(sanitizedId);

    if (!sanitizedId) {
      return NextResponse.json({ success: false, message: 'Missing campaign id' }, { status: 400 });
    }
    if (!isValidObjectIdLike(sanitizedId)) {
      return NextResponse.json({ success: false, message: 'Invalid campaign id format' }, { status: 400 });
    }

    const client = await clientPromise;
    const usersDb = client.db('learners');
    const campaignsDb = client.db('data');

    const admin = await usersDb.collection('users').findOne({ email: adminEmail, role: 'admin', status: { $ne: 'deleted' } });
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
    }

    const patchSet: Record<string, unknown> = {
      ...updateFields,
      updatedAt: new Date(),
    };

    const existingCampaign = await campaignsDb.collection('campaigns').findOne({
      _id: campaignObjectId,
      organisation: admin.organisation || null,
    });
    if (!existingCampaign) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }

    if (isNonEmptyString(updateFields.startDate)) {
      patchSet.startDate = sanitizeString(updateFields.startDate);
    }
    if (isNonEmptyString(updateFields.endDate)) {
      patchSet.endDate = sanitizeString(updateFields.endDate);
    }

    if (existingCampaign.type === 'attack') {
      if (isNonEmptyString(updateFields.sendTime)) {
        const nextSendTime = sanitizeString(updateFields.sendTime);
        if (!parseTimeParts(nextSendTime)) {
          return NextResponse.json({ success: false, message: 'Invalid send time. Use HH:MM format.' }, { status: 400 });
        }
        patchSet.sendTime = nextSendTime;
      }

      if (isNonEmptyString(updateFields.timezone)) {
        const nextTimezone = sanitizeString(updateFields.timezone);
        if (!isValidTimezone(nextTimezone)) {
          return NextResponse.json({ success: false, message: 'Invalid timezone' }, { status: 400 });
        }
        patchSet.timezone = nextTimezone;
      }
    }

    const normalizedUsers = normalizeUsers(updateFields.users);
    if (normalizedUsers) {
      patchSet.users = normalizedUsers;
    }

    const selectedAssignmentIds = normalizeAssignmentIds(assignmentIds);
    if (selectedAssignmentIds.length > 0) {
      const assignmentType = existingCampaign.type === 'attack' ? 'attack' : 'training';
      const normalizedAssignments = buildAssignmentsByType(assignmentType, selectedAssignmentIds);
      if (normalizedAssignments.length === 0) {
        return NextResponse.json({ success: false, message: 'Select valid modules/templates for this campaign type' }, { status: 400 });
      }
      patchSet.assignments = normalizedAssignments;
    }

    const result = await campaignsDb.collection('campaigns').updateOne(
      { _id: campaignObjectId, organisation: admin.organisation || null },
      { $set: patchSet }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Campaign not found' }, { status: 404 });
    }

    if (existingCampaign.type === 'attack') {
      const nextStartDate = sanitizeString((patchSet.startDate as string) || existingCampaign.startDate);
      const nextSendTime = sanitizeString((patchSet.sendTime as string) || existingCampaign.sendTime || '09:00');
      const nextTimezone = sanitizeString((patchSet.timezone as string) || existingCampaign.timezone || 'UTC');
      const nextUsers = (patchSet.users as ('all' | string[] | undefined)) || (existingCampaign.users as ('all' | string[]));
      const nextCampaignName = sanitizeString((patchSet.name as string) || existingCampaign.name);

      const nextAssignmentsRaw = Array.isArray(patchSet.assignments)
        ? patchSet.assignments
        : Array.isArray(existingCampaign.assignments)
          ? existingCampaign.assignments
          : [];

      const nextAssignments = nextAssignmentsRaw
        .map((item) => {
          if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') {
            return null;
          }
          return getAttackTemplateById((item as { id: string }).id);
        })
        .filter((item): item is AttackTemplateOption => Boolean(item));

      if (nextAssignments.length > 0) {
        const sendAt = deriveScheduledSendTime(nextStartDate, nextSendTime, nextTimezone);
        if (sendAt > new Date()) {
          const rawRecipients = await getAttackRecipients(usersDb, admin.organisation || null, nextUsers);
          const recipients = rawRecipients
            .map((recipient) => ({
              email: sanitizeString(recipient.email).toLowerCase(),
              firstName: sanitizeString(recipient.firstName),
            }))
            .filter((recipient) => isNonEmptyString(recipient.email));

          await campaignsDb.collection('attack-email-jobs').updateOne(
            { campaignId: campaignObjectId, status: 'scheduled' },
            {
              $set: {
                campaignName: nextCampaignName,
                organisation: admin.organisation || null,
                recipients,
                assignments: nextAssignments,
                sendAt,
                updatedAt: new Date(),
              },
              $setOnInsert: {
                campaignId: campaignObjectId,
                status: 'scheduled',
                attempts: 0,
                createdAt: new Date(),
              },
            },
            { upsert: true }
          );
        } else {
          await campaignsDb.collection('attack-email-jobs').deleteMany({
            campaignId: campaignObjectId,
            status: 'scheduled',
          });
        }
      }
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
    const adminEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!adminEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = sanitizeObject(await req.json());
    const id = sanitizeString(body?.id);

    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing campaign id' }, { status: 400 });
    }
    if (!isValidObjectIdLike(id)) {
      return NextResponse.json({ success: false, message: 'Invalid campaign id format' }, { status: 400 });
    }

    const client = await clientPromise;
    const usersDb = client.db('learners');
    const campaignsDb = client.db('data');

    const admin = await usersDb.collection('users').findOne({ email: adminEmail, role: 'admin', status: { $ne: 'deleted' } });
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
    }

    const result = await campaignsDb.collection('campaigns').deleteOne({ _id: new ObjectId(id), organisation: admin.organisation || null });
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
