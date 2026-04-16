import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { handleApiError } from '@/lib/api-error';
import { sanitizeString } from '@/lib/security';

type ProgressResultDoc = {
  overallScore?: number;
  metrics?: {
    engagement?: number;
    knowledge?: number;
    compatibility?: number;
    compatability?: number;
    confidence?: number;
    commitment?: number;
  };
};

type ProgressDoc = {
  result?: ProgressResultDoc;
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(1));
}

export async function GET(req: NextRequest) {
  try {
    const learnerEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!learnerEmail) {
      return NextResponse.json({ success: false, message: 'Please sign in to continue.' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('data');
    const progressDocs = await db.collection<ProgressDoc>('learner-progress').find(
      {
        learnerEmail,
        type: 'training',
        status: 'completed',
      },
      {
        projection: {
          result: 1,
        },
      }
    ).toArray();

    const scoredDocs = progressDocs.filter((doc) => doc.result && doc.result.metrics);
    if (scoredDocs.length === 0) {
      return NextResponse.json({ success: true, hasMetrics: false });
    }

    const overallScores = scoredDocs
      .map((doc) => Number(doc.result?.overallScore))
      .filter((value) => Number.isFinite(value));
    const engagementScores = scoredDocs
      .map((doc) => Number(doc.result?.metrics?.engagement))
      .filter((value) => Number.isFinite(value));
    const knowledgeScores = scoredDocs
      .map((doc) => Number(doc.result?.metrics?.knowledge))
      .filter((value) => Number.isFinite(value));
    const compatabilityScores = scoredDocs
      .map((doc) => Number(doc.result?.metrics?.compatability ?? doc.result?.metrics?.compatibility))
      .filter((value) => Number.isFinite(value));
    const confidenceScores = scoredDocs
      .map((doc) => Number(doc.result?.metrics?.confidence))
      .filter((value) => Number.isFinite(value));
    const commitmentScores = scoredDocs
      .map((doc) => Number(doc.result?.metrics?.commitment))
      .filter((value) => Number.isFinite(value));

    return NextResponse.json({
      success: true,
      hasMetrics: true,
      summary: {
        completedAssignments: scoredDocs.length,
        overallScoreAverage: average(overallScores),
        metrics: {
          engagement: average(engagementScores),
          knowledge: average(knowledgeScores),
          compatability: average(compatabilityScores),
          confidence: average(confidenceScores),
          commitment: average(commitmentScores),
        },
      },
    });
  } catch (error) {
    return handleApiError(req, error, {
      publicMessage: 'Unable to load learner metrics right now. Please try again.',
      logMessage: 'Learner training metrics endpoint failed',
    });
  }
}
