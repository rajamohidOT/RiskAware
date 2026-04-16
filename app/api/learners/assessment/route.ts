import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { handleApiError } from '@/lib/api-error';
import { isValidObjectIdLike, sanitizeObject, sanitizeString } from '@/lib/security';
import {
  evaluateInitialAssessment,
  INITIAL_ASSESSMENT_ID,
  normalizeInitialAssessmentResponse,
} from '@/lib/initial-assessment';

type CampaignUserAssignment = {
  userEmail?: string;
  email?: string;
  userId?: string;
};

type CampaignDocument = {
  users?: 'all' | string[];
  endDate?: string;
  assignments?: CampaignUserAssignment[];
};

function isAssignedToCampaign(campaign: CampaignDocument | null, learnerEmail: string) {
  if (campaign?.users === 'all') {
    return true;
  }

  if (Array.isArray(campaign?.users) && campaign.users.includes(learnerEmail)) {
    return true;
  }

  if (Array.isArray(campaign?.assignments)) {
    return campaign.assignments.some((assignment) => {
      const assignmentUser = assignment?.userEmail || assignment?.email || assignment?.userId;
      return assignmentUser === learnerEmail;
    });
  }

  return false;
}

function toDateOrNull(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeCompletionDurationMs(startedAt: Date | null, completedAt: Date) {
  if (!startedAt) {
    return null;
  }

  const duration = completedAt.getTime() - startedAt.getTime();
  if (!Number.isFinite(duration) || duration < 0) {
    return null;
  }

  return Math.round(duration);
}

export async function GET(req: NextRequest) {
  try {
    const learnerEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!learnerEmail) {
      return NextResponse.json({ success: false, message: 'Please sign in to continue.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('data');

    const assessments = await db.collection('initial-assessment-results').find(
      { learnerEmail },
      {
        projection: {
          submittedAt: 1,
          overallScore: 1,
        },
      }
    ).sort({ submittedAt: -1 }).toArray();

    if (assessments.length === 0) {
      return NextResponse.json({ success: true, hasAssessment: false });
    }

    const totalScore = assessments.reduce((sum, item) => {
      const score = Number(item.overallScore);
      return Number.isFinite(score) ? sum + score : sum;
    }, 0);

    const averageScore = Number((totalScore / assessments.length).toFixed(1));

    return NextResponse.json({
      success: true,
      hasAssessment: true,
      assessment: {
        assessmentCount: assessments.length,
        latestSubmittedAt: assessments[0]?.submittedAt || null,
        overallScoreAverage: averageScore,
      },
    });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load initial assessment right now. Please try again.',
      logMessage: 'Initial assessment GET endpoint failed',
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const learnerEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!learnerEmail) {
      return NextResponse.json({ success: false, message: 'Please sign in to continue.' }, { status: 401 });
    }

    const body = sanitizeObject(await req.json());
    const normalizedResponse = normalizeInitialAssessmentResponse(body?.response);
    if (!normalizedResponse) {
      return NextResponse.json(
        { success: false, message: 'Please complete all required assessment questions.' },
        { status: 400 }
      );
    }

    const dueAt = toDateOrNull(sanitizeString(body?.dueAt));
    const now = new Date();
    const completedOnTime = !dueAt || now <= dueAt;
    const startedAt = toDateOrNull(sanitizeString(body?.startedAt));
    const completionDurationMs = computeCompletionDurationMs(startedAt, now);

    const campaignId = sanitizeString(body?.campaignId);
    const itemId = sanitizeString(body?.itemId) || INITIAL_ASSESSMENT_ID;

    const client = await clientPromise;
    const dataDb = client.db('data');
    const usersDb = client.db('learners');

    const learner = await usersDb.collection('users').findOne(
      {
        email: learnerEmail,
        status: { $ne: 'deleted' },
      },
      {
        projection: {
          organisation: 1,
        },
      }
    );

    if (!learner) {
      return NextResponse.json({ success: false, message: 'Learner not found.' }, { status: 404 });
    }

    let campaignOrganisation: string | null = learner.organisation || null;

    let objectCampaignId: ObjectId | null = null;
    if (campaignId && itemId) {
      if (!isValidObjectIdLike(campaignId)) {
        return NextResponse.json({ success: false, message: 'Invalid campaignId format.' }, { status: 400 });
      }

      objectCampaignId = new ObjectId(campaignId);
      const campaign = await dataDb.collection<CampaignDocument & { organisation?: string | null }>('campaigns').findOne({
        _id: objectCampaignId,
        type: 'training',
      });

      if (!campaign) {
        return NextResponse.json({ success: false, message: 'Training campaign not found.' }, { status: 404 });
      }

      if (!isAssignedToCampaign(campaign, learnerEmail)) {
        return NextResponse.json({ success: false, message: 'You are not assigned to this campaign.' }, { status: 403 });
      }

      const campaignEnd = toDateOrNull(sanitizeString(campaign.endDate));
      if (campaignEnd && now > campaignEnd) {
        return NextResponse.json(
          { success: false, message: 'This assignment has expired and can no longer be submitted.' },
          { status: 403 }
        );
      }

      const existingAssessmentProgress = await dataDb.collection('learner-progress').findOne({
        campaignId: objectCampaignId,
        learnerEmail,
        type: 'training',
        itemId,
        status: 'completed',
      });

      if (existingAssessmentProgress) {
        return NextResponse.json(
          { success: false, message: 'This assignment is already completed and cannot be submitted again.' },
          { status: 409 }
        );
      }

      campaignOrganisation = campaign.organisation || campaignOrganisation;
    }

    const failedAttack = await dataDb.collection('attack-simulation-events').findOne(
      {
        learnerEmail,
        $or: [
          { credentialsSubmittedAt: { $ne: null } },
          {
            clickedAt: { $ne: null },
            reportedAt: null,
          },
        ],
      },
      {
        sort: { updatedAt: -1 },
      }
    );

    const attackSimulationFailed = Boolean(failedAttack);
    const evaluation = evaluateInitialAssessment({
      response: normalizedResponse,
      completedOnTime,
      attackSimulationFailed,
    });

    const assessmentDoc = {
      learnerEmail,
      moduleId: INITIAL_ASSESSMENT_ID,
      response: normalizedResponse,
      metrics: evaluation.metrics,
      overallScore: evaluation.overallScore,
      recommendedModules: evaluation.recommendedModules,
      attackSimulationFailed,
      completedOnTime,
      dueAt,
      submittedAt: now,
      updatedAt: now,
      campaignId: objectCampaignId,
      itemId,
      organisation: campaignOrganisation,
      startedAt,
      completionDurationMs,
    };

    await dataDb.collection('initial-assessment-results').insertOne(assessmentDoc);

    if (objectCampaignId && itemId) {
      await dataDb.collection('learner-progress').updateOne(
        {
          campaignId: objectCampaignId,
          learnerEmail,
          type: 'training',
          itemId,
        },
        {
          $set: {
            status: 'completed',
            result: {
              assessmentId: INITIAL_ASSESSMENT_ID,
              metrics: evaluation.metrics,
              overallScore: evaluation.overallScore,
              recommendedModules: evaluation.recommendedModules,
              attackSimulationFailed,
              completionDurationMs,
            },
            completedAt: now,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Assessment submitted successfully.',
    });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to submit initial assessment right now. Please try again.',
      logMessage: 'Initial assessment POST endpoint failed',
    });
  }
}