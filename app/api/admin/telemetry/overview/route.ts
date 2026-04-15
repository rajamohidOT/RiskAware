import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { sanitizeString } from '@/lib/security';
import { handleApiError } from '@/lib/api-error';

type CampaignDoc = {
  startDate?: string;
  endDate?: string;
  users?: 'all' | string[];
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
      },
    });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load telemetry overview right now. Please try again.',
      logMessage: 'Admin telemetry overview endpoint failed',
    });
  }
}
