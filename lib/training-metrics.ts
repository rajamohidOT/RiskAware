export type TrainingAssignmentMetrics = {
  engagement: number;
  knowledge: number;
  compatibility: number;
  compatability: number;
  confidence: number;
  commitment: number;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function durationAdjustment(completionDurationMs: number | null) {
  if (!completionDurationMs || completionDurationMs <= 0) {
    return 0;
  }

  const minutes = completionDurationMs / 60000;
  if (minutes <= 3) {
    return -3;
  }
  if (minutes <= 8) {
    return 2;
  }
  if (minutes <= 20) {
    return 5;
  }
  return 3;
}

export function buildTrainingAssignmentMetrics(params: {
  moduleId: string;
  completedOnTime: boolean;
  completionDurationMs: number | null;
}) {
  const { moduleId, completedOnTime, completionDurationMs } = params;
  const durationBonus = durationAdjustment(completionDurationMs);
  const commitmentBase = completedOnTime ? 92 : 62;

  const baseProfiles: Record<string, Omit<TrainingAssignmentMetrics, 'compatability'>> = {
    'phishing-fundamentals': {
      engagement: 84,
      knowledge: 82,
      compatibility: 76,
      confidence: 80,
      commitment: commitmentBase,
    },
    'password-security': {
      engagement: 82,
      knowledge: 84,
      compatibility: 80,
      confidence: 79,
      commitment: commitmentBase,
    },
    'safe-browsing-data-handling': {
      engagement: 83,
      knowledge: 81,
      compatibility: 83,
      confidence: 78,
      commitment: commitmentBase,
    },
    'hardware-safety': {
      engagement: 80,
      knowledge: 78,
      compatibility: 86,
      confidence: 76,
      commitment: commitmentBase,
    },
    'company-policy-acknowledgement': {
      engagement: 79,
      knowledge: 76,
      compatibility: 90,
      confidence: 82,
      commitment: commitmentBase,
    },
    'passwords-data-lifecycle': {
      engagement: 81,
      knowledge: 83,
      compatibility: 85,
      confidence: 78,
      commitment: commitmentBase,
    },
    'spot-the-scam-phish-check': {
      engagement: 85,
      knowledge: 86,
      compatibility: 80,
      confidence: 81,
      commitment: commitmentBase,
    },
  };

  const profile = baseProfiles[moduleId] || {
    engagement: 80,
    knowledge: 78,
    compatibility: 78,
    confidence: 76,
    commitment: commitmentBase,
  };

  const metrics: TrainingAssignmentMetrics = {
    engagement: clampScore(profile.engagement + durationBonus),
    knowledge: clampScore(profile.knowledge + durationBonus),
    compatibility: clampScore(profile.compatibility + durationBonus),
    compatability: clampScore(profile.compatibility + durationBonus),
    confidence: clampScore(profile.confidence + durationBonus),
    commitment: clampScore(profile.commitment),
  };

  const overallScore = clampScore(
    (metrics.engagement * 0.2)
    + (metrics.knowledge * 0.24)
    + (metrics.compatibility * 0.2)
    + (metrics.confidence * 0.18)
    + (metrics.commitment * 0.18)
  );

  return {
    metrics,
    overallScore,
  };
}