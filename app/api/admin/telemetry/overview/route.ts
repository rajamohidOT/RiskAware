import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

type CampaignDoc = {
  startDate?: string;
  endDate?: string;
  users?: 'all' | string[];
};

type AssessmentSummaryDoc = {
  organisation?: string | null;
  learnerEmail?: string;
  submittedAt?: Date;
  overallScore?: number;
  completionDurationMs?: number;
  metrics?: {
    engagement?: number;
    knowledge?: number;
    compatibility?: number;
    compatability?: number;
    confidence?: number;
    commitment?: number;
  };
};

type TrendPeriod = 'weekly' | 'monthly' | 'yearly';

type TrendPoint = {
  key: string;
  label: string;
  submissions: number;
  averageOverallScore: number;
  engagement: number;
  knowledge: number;
  compatability: number;
  confidence: number;
  commitment: number;
  averageCompletionMinutes: number;
};

function isRunningCampaign(campaign: CampaignDoc) {
  const now = new Date();
  const start = new Date(sanitizeString(campaign.startDate));
  const end = new Date(sanitizeString(campaign.endDate));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return start <= now && now <= end;
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Number(((value / total) * 100).toFixed(1));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(1));
}

function parseTrendPeriod(input: string): TrendPeriod {
  if (input === 'monthly' || input === 'yearly') {
    return input;
  }

  return 'weekly';
}

function startOfWeek(date: Date) {
  const value = new Date(date);
  const dayOffset = (value.getDay() + 6) % 7;
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - dayOffset);
  return value;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function addWeeks(date: Date, weeks: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + (weeks * 7));
  return value;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, 0, 1);
}

function formatTrendLabel(date: Date, period: TrendPeriod) {
  if (period === 'yearly') {
    return String(date.getFullYear());
  }

  if (period === 'monthly') {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function trendKey(date: Date, period: TrendPeriod) {
  if (period === 'yearly') {
    return String(date.getFullYear());
  }

  if (period === 'monthly') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  return date.toISOString().slice(0, 10);
}

function buildTrendFrame(period: TrendPeriod) {
  const now = new Date();
  let count = 12;
  let currentStart = startOfWeek(now);

  if (period === 'monthly') {
    currentStart = startOfMonth(now);
    count = 12;
  }

  if (period === 'yearly') {
    currentStart = startOfYear(now);
    count = 5;
  }

  const starts: Date[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    if (period === 'weekly') {
      starts.push(addWeeks(currentStart, -index));
    } else if (period === 'monthly') {
      starts.push(addMonths(currentStart, -index));
    } else {
      starts.push(addYears(currentStart, -index));
    }
  }

  return starts.map((start) => ({
    key: trendKey(start, period),
    label: formatTrendLabel(start, period),
    start,
  }));
}

function trendBucketKey(submittedAt: Date, period: TrendPeriod) {
  if (period === 'yearly') {
    return trendKey(startOfYear(submittedAt), period);
  }

  if (period === 'monthly') {
    return trendKey(startOfMonth(submittedAt), period);
  }

  return trendKey(startOfWeek(submittedAt), period);
}

export async function GET(req: NextRequest) {
  try {
    const adminEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!adminEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
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

    const organisation = admin.organisation || null;
    const trendPeriod = parseTrendPeriod(sanitizeString(req.nextUrl.searchParams.get('period')));

    const [campaignsRaw, learnersRaw] = await Promise.all([
      dataDb.collection('campaigns').find({ organisation }).toArray(),
      usersDb.collection('users').find({
        organisation,
        role: 'learner',
        status: { $ne: 'deleted' },
      }, { projection: { email: 1, status: 1 } }).toArray(),
    ]);

    const campaigns = campaignsRaw as CampaignDoc[];
    const runningCampaigns = campaigns.filter((campaign) => isRunningCampaign(campaign));

    const activeLearners = learnersRaw.filter((learner) => sanitizeString(learner.status) === 'active');
    const inactiveOrUnverifiedLearners = Math.max(0, learnersRaw.length - activeLearners.length);

    const learnerByEmail = new Map(
      learnersRaw
        .map((learner) => [sanitizeString(learner.email).toLowerCase(), sanitizeString(learner.status)])
        .filter(([email]) => Boolean(email))
    );

    let enrolledEmails: Set<string>;
    const hasAllAudienceCampaign = runningCampaigns.some((campaign) => campaign.users === 'all');
    if (hasAllAudienceCampaign) {
      enrolledEmails = new Set(Array.from(learnerByEmail.keys()));
    } else {
      enrolledEmails = new Set(
        runningCampaigns
          .flatMap((campaign) => (Array.isArray(campaign.users) ? campaign.users : []))
          .map((email) => sanitizeString(email).toLowerCase())
          .filter((email) => Boolean(email))
      );
    }

    const enrolledTotalLearners = enrolledEmails.size;
    const enrolledActiveLearners = Array.from(enrolledEmails).filter((email) => learnerByEmail.get(email) === 'active').length;

    const [totalEvents, clicked, reported, credentials] = await Promise.all([
      dataDb.collection('attack-simulation-events').countDocuments({ organisation }),
      dataDb.collection('attack-simulation-events').countDocuments({ organisation, clickedAt: { $ne: null } }),
      dataDb.collection('attack-simulation-events').countDocuments({ organisation, reportedAt: { $ne: null } }),
      dataDb.collection('attack-simulation-events').countDocuments({ organisation, credentialsSubmittedAt: { $ne: null } }),
    ]);

    const activeLearnerEmails = activeLearners
      .map((learner) => sanitizeString(learner.email).toLowerCase())
      .filter((email) => Boolean(email));

    const assessmentDocs = activeLearnerEmails.length > 0
      ? await dataDb.collection<AssessmentSummaryDoc>('initial-assessment-results').find(
          {
            learnerEmail: { $in: activeLearnerEmails },
          },
          {
            projection: {
              learnerEmail: 1,
              submittedAt: 1,
              overallScore: 1,
              metrics: 1,
            },
            sort: {
              submittedAt: -1,
            },
          }
        ).toArray()
      : [];

    const latestByLearner = new Map<string, AssessmentSummaryDoc>();
    for (const doc of assessmentDocs) {
      const email = sanitizeString(doc.learnerEmail).toLowerCase();
      if (!email || latestByLearner.has(email)) {
        continue;
      }
      latestByLearner.set(email, doc);
    }

    const latestAssessments = Array.from(latestByLearner.values());

    const overallScores = latestAssessments.map((doc) => Number(doc.overallScore)).filter((value) => Number.isFinite(value));
    const engagementScores = latestAssessments.map((doc) => Number(doc?.metrics?.engagement)).filter((value) => Number.isFinite(value));
    const knowledgeScores = latestAssessments.map((doc) => Number(doc?.metrics?.knowledge)).filter((value) => Number.isFinite(value));
    const compatabilityScores = latestAssessments
      .map((doc) => Number(doc?.metrics?.compatability ?? doc?.metrics?.compatibility))
      .filter((value) => Number.isFinite(value));
    const confidenceScores = latestAssessments.map((doc) => Number(doc?.metrics?.confidence)).filter((value) => Number.isFinite(value));
    const commitmentScores = latestAssessments.map((doc) => Number(doc?.metrics?.commitment)).filter((value) => Number.isFinite(value));

    const assessedLearners = latestAssessments.length;
    const pendingLearners = Math.max(0, activeLearnerEmails.length - assessedLearners);

    const trendFrame = buildTrendFrame(trendPeriod);
    const earliestTrendStart = trendFrame[0]?.start || startOfWeek(new Date());

    const trendDocs = await dataDb.collection<AssessmentSummaryDoc>('initial-assessment-results').find(
      {
        organisation,
        submittedAt: { $gte: earliestTrendStart },
      },
      {
        projection: {
          submittedAt: 1,
          overallScore: 1,
          completionDurationMs: 1,
          metrics: 1,
        },
      }
    ).toArray();

    const grouped = new Map<string, AssessmentSummaryDoc[]>();
    for (const item of trendDocs) {
      if (!item.submittedAt) {
        continue;
      }

      const key = trendBucketKey(new Date(item.submittedAt), trendPeriod);
      grouped.set(key, [...(grouped.get(key) || []), item]);
    }

    const assessmentTrends: TrendPoint[] = trendFrame.map((bucket) => {
      const docs = grouped.get(bucket.key) || [];
      const overall = docs.map((doc) => Number(doc.overallScore)).filter((value) => Number.isFinite(value));
      const engagement = docs.map((doc) => Number(doc.metrics?.engagement)).filter((value) => Number.isFinite(value));
      const knowledge = docs.map((doc) => Number(doc.metrics?.knowledge)).filter((value) => Number.isFinite(value));
      const compatability = docs
        .map((doc) => Number(doc.metrics?.compatability ?? doc.metrics?.compatibility))
        .filter((value) => Number.isFinite(value));
      const confidence = docs.map((doc) => Number(doc.metrics?.confidence)).filter((value) => Number.isFinite(value));
      const commitment = docs.map((doc) => Number(doc.metrics?.commitment)).filter((value) => Number.isFinite(value));
      const completionMinutes = docs
        .map((doc) => Number(doc.completionDurationMs || 0) / 60000)
        .filter((value) => Number.isFinite(value) && value > 0);

      return {
        key: bucket.key,
        label: bucket.label,
        submissions: docs.length,
        averageOverallScore: average(overall),
        engagement: average(engagement),
        knowledge: average(knowledge),
        compatability: average(compatability),
        confidence: average(confidence),
        commitment: average(commitment),
        averageCompletionMinutes: average(completionMinutes),
      };
    });

    return NextResponse.json({
      success: true,
      overview: {
        totalCampaigns: campaigns.length,
        runningCampaigns: runningCampaigns.length,
        learners: {
          total: learnersRaw.length,
          active: activeLearners.length,
          inactiveOrUnverified: inactiveOrUnverifiedLearners,
          enrolledActive: enrolledActiveLearners,
          enrolledTotal: enrolledTotalLearners,
        },
        phishing: {
          totalEvents,
          clicked,
          reported,
          credentials,
          clickRate: percent(clicked, totalEvents),
          reportRate: percent(reported, totalEvents),
          credentialRate: percent(credentials, totalEvents),
        },
        assessment: {
          assessedLearners,
          pendingLearners,
          averageOverallScore: average(overallScores),
          metrics: {
            engagement: average(engagementScores),
            knowledge: average(knowledgeScores),
            compatability: average(compatabilityScores),
            confidence: average(confidenceScores),
            commitment: average(commitmentScores),
          },
          trends: {
            period: trendPeriod,
            points: assessmentTrends,
          },
        },
      },
    });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load telemetry overview right now. Please try again.',
      logMessage: 'Admin telemetry overview endpoint failed',
    });
  }
}
