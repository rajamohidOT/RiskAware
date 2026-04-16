import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { isValidObjectIdLike, sanitizeString } from '@/lib/security';
import { TRAINING_MODULE_OPTIONS } from '@/lib/campaign-options';

type CampaignDoc = {
  name?: string;
  organisation?: string | null;
  users?: 'all' | string[];
  type?: 'attack' | 'training';
};

type LearnerDoc = {
  email?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
};

type AssessmentMetrics = {
  engagement?: number;
  knowledge?: number;
  compatibility?: number;
  compatability?: number;
  confidence?: number;
  commitment?: number;
};

type AssessmentDoc = {
  learnerEmail?: string;
  overallScore?: number;
  metrics?: AssessmentMetrics;
  recommendedModules?: string[];
  submittedAt?: Date;
  completedOnTime?: boolean;
  completionDurationMs?: number;
};

type LearnerProgressDoc = {
  learnerEmail?: string;
  status?: string;
};

type RecommendationCount = {
  moduleId: string;
  title: string;
  learners: number;
  percentage: number;
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(1));
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}

export async function GET(req: NextRequest) {
  try {
    const adminEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!adminEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const campaignId = sanitizeString(req.nextUrl.searchParams.get('campaignId'));
    if (!campaignId || !isValidObjectIdLike(campaignId)) {
      return NextResponse.json({ success: false, message: 'Valid campaignId is required' }, { status: 400 });
    }

    const objectCampaignId = new ObjectId(campaignId);

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

    const organisation = admin.organisation || null;

    const campaign = await dataDb.collection<CampaignDoc>('campaigns').findOne({
      _id: objectCampaignId,
      organisation,
      type: 'training',
    });

    if (!campaign) {
      return NextResponse.json({ success: false, message: 'Training campaign not found' }, { status: 404 });
    }

    const assignedLearners = campaign.users === 'all'
      ? await usersDb.collection<LearnerDoc>('users').find(
          {
            organisation,
            role: 'learner',
            status: { $ne: 'deleted' },
          },
          {
            projection: {
              email: 1,
              firstName: 1,
              lastName: 1,
              status: 1,
            },
          }
        ).toArray()
      : await usersDb.collection<LearnerDoc>('users').find(
          {
            organisation,
            role: 'learner',
            status: { $ne: 'deleted' },
            email: { $in: Array.isArray(campaign.users) ? campaign.users : [] },
          },
          {
            projection: {
              email: 1,
              firstName: 1,
              lastName: 1,
              status: 1,
            },
          }
        ).toArray();

    const assignedEmails = assignedLearners
      .map((learner) => sanitizeString(learner.email).toLowerCase())
      .filter((email) => Boolean(email));

    const [assessmentDocs, progressDocs] = assignedEmails.length > 0
      ? await Promise.all([
          dataDb.collection<AssessmentDoc>('initial-assessment-results').find(
            {
              campaignId: objectCampaignId,
              learnerEmail: { $in: assignedEmails },
            },
            {
              projection: {
                learnerEmail: 1,
                submittedAt: 1,
                overallScore: 1,
                metrics: 1,
                recommendedModules: 1,
                completedOnTime: 1,
                completionDurationMs: 1,
              },
              sort: { submittedAt: -1 },
            }
          ).toArray(),
          dataDb.collection<LearnerProgressDoc>('learner-progress').find(
            {
              campaignId: objectCampaignId,
              learnerEmail: { $in: assignedEmails },
              type: 'training',
            },
            {
              projection: {
                learnerEmail: 1,
                status: 1,
              },
            }
          ).toArray(),
        ])
      : [[], []];

    const latestAssessmentByLearner = new Map<string, AssessmentDoc>();
    for (const doc of assessmentDocs) {
      const email = sanitizeString(doc.learnerEmail).toLowerCase();
      if (!email || latestAssessmentByLearner.has(email)) {
        continue;
      }
      latestAssessmentByLearner.set(email, doc);
    }

    const progressByLearner = new Map<string, string>();
    for (const progress of progressDocs) {
      const email = sanitizeString(progress.learnerEmail).toLowerCase();
      if (!email || progressByLearner.has(email)) {
        continue;
      }
      progressByLearner.set(email, sanitizeString(progress.status).toLowerCase());
    }

    const moduleCounts = new Map<string, number>();
    const learnerRows = assignedLearners.map((learner) => {
      const email = sanitizeString(learner.email).toLowerCase();
      const fullName = `${sanitizeString(learner.firstName)} ${sanitizeString(learner.lastName)}`.trim();
      const assessment = latestAssessmentByLearner.get(email);
      const progressStatus = progressByLearner.get(email);

      let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
      if (assessment) {
        status = 'completed';
      } else if (progressStatus) {
        status = progressStatus === 'completed' ? 'completed' : 'in-progress';
      }

      if (assessment && Array.isArray(assessment.recommendedModules)) {
        const unique = Array.from(new Set(assessment.recommendedModules.map((value) => sanitizeString(value)).filter(Boolean)));
        for (const moduleId of unique) {
          moduleCounts.set(moduleId, (moduleCounts.get(moduleId) || 0) + 1);
        }
      }

      return {
        learnerEmail: email,
        learnerName: fullName || email,
        status,
        completedOnTime: Boolean(assessment?.completedOnTime),
        submittedAt: assessment?.submittedAt || null,
        completionDurationMs: typeof assessment?.completionDurationMs === 'number' ? assessment.completionDurationMs : null,
        overallScore: typeof assessment?.overallScore === 'number' ? Number(assessment.overallScore.toFixed(1)) : null,
        metrics: assessment
          ? {
              engagement: Number(assessment.metrics?.engagement || 0),
              knowledge: Number(assessment.metrics?.knowledge || 0),
              compatability: Number(assessment.metrics?.compatability ?? assessment.metrics?.compatibility ?? 0),
              confidence: Number(assessment.metrics?.confidence || 0),
              commitment: Number(assessment.metrics?.commitment || 0),
            }
          : null,
      };
    });

    const completedRows = learnerRows.filter((row) => row.status === 'completed' && row.metrics);
    const startedRows = learnerRows.filter((row) => row.status !== 'not-started');

    const recommendationCounts: RecommendationCount[] = Array.from(moduleCounts.entries())
      .map(([moduleId, learners]) => {
        const moduleOption = TRAINING_MODULE_OPTIONS.find((option) => option.id === moduleId);
        return {
          moduleId,
          title: moduleOption?.title || moduleId,
          learners,
          percentage: percent(learners, completedRows.length),
        };
      })
      .sort((a, b) => b.learners - a.learners);

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaignId,
        name: sanitizeString(campaign.name) || 'Training Campaign',
      },
      summary: {
        assignedLearners: learnerRows.length,
        startedLearners: startedRows.length,
        completedLearners: completedRows.length,
        notStartedLearners: Math.max(0, learnerRows.length - startedRows.length),
        startRate: percent(startedRows.length, learnerRows.length),
        completionRate: percent(completedRows.length, learnerRows.length),
        averageCompletionMinutes: average(
          completedRows
            .map((row) => Number(row.completionDurationMs || 0) / 60000)
            .filter((value) => Number.isFinite(value) && value > 0)
        ),
        averageMetrics: {
          overallScore: average(completedRows.map((row) => Number(row.overallScore || 0))),
          engagement: average(completedRows.map((row) => Number(row.metrics?.engagement || 0))),
          knowledge: average(completedRows.map((row) => Number(row.metrics?.knowledge || 0))),
          compatability: average(completedRows.map((row) => Number(row.metrics?.compatability || 0))),
          confidence: average(completedRows.map((row) => Number(row.metrics?.confidence || 0))),
          commitment: average(completedRows.map((row) => Number(row.metrics?.commitment || 0))),
        },
      },
      recommendations: recommendationCounts,
      learners: learnerRows.sort((a, b) => a.learnerName.localeCompare(b.learnerName)),
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Unable to load training campaign metrics' }, { status: 500 });
  }
}
