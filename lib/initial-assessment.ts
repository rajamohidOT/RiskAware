export const INITIAL_ASSESSMENT_ID = 'initial-assessment-cyber-profile';

export const JOB_CONTEXT_OPTIONS = [
  'frequently-travel',
  'frequently-work-from-home',
  'use-cloud-data-transfer',
  'use-social-media-for-work',
  'work-in-bank-branch',
  'use-company-laptop-mobile',
  'copy-data-to-external-storage',
  'have-privileged-access',
  'use-personal-devices-for-work',
  'handle-payment-card-details',
  'none',
] as const;

export const SENSITIVE_DATA_OPTIONS = [
  'financial-records',
  'employee-records',
  'customer-personal-information',
  'company-confidential-information',
  'intellectual-property',
  'none',
] as const;

export const POLICY_VIEW_OPTIONS = [
  'right-policies-personal-responsibility',
  'good-policies-secure-culture',
  'policy-makes-job-hard',
  'bad-policies-work-around',
] as const;

export const POLICY_UNDERSTANDING_OPTIONS = [
  'understand-actions-impact',
  'mostly-understand-not-always-sure',
  'not-sure-follow-others',
  'do-what-i-want-systems-protect',
] as const;

export const OBSERVED_BEHAVIOR_OPTIONS = [
  'no-id-badges',
  'paperwork-left-on-desks',
  'visitors-unaccompanied',
  'confidential-info-on-whiteboards',
  'pcs-left-unlocked',
  'documents-left-on-printer',
  'passwords-written-down',
  'none',
] as const;

export const POLICY_ADHERENCE_OPTIONS = [
  'everyone-follows',
  'most-people-follow',
  'some-people-follow',
  'hardly-anyone-follows',
] as const;

export type SliderQuestionKey =
  | 'stranger-access-challenged'
  | 'malware-infection-difficult'
  | 'insider-theft-difficult'
  | 'unauthorized-cloud-difficult';

export const SLIDER_QUESTION_KEYS: SliderQuestionKey[] = [
  'stranger-access-challenged',
  'malware-infection-difficult',
  'insider-theft-difficult',
  'unauthorized-cloud-difficult',
];

export type SliderScale = 1 | 2 | 3 | 4 | 5;

export const RECOMMENDED_MODULE_IDS = {
  hardwareSafety: 'hardware-safety',
  policyAcknowledgement: 'company-policy-acknowledgement',
  passwordDataLifecycle: 'passwords-data-lifecycle',
  phishCheck: 'spot-the-scam-phish-check',
} as const;

export type InitialAssessmentResponse = {
  jobContexts: string[];
  sensitiveData: string[];
  policyView: string;
  policyUnderstanding: string;
  observedBehaviors: string[];
  policyAdherence: string;
  sliderAnswers: Partial<Record<SliderQuestionKey, number>>;
};

export type AssessmentMetrics = {
  engagement: number;
  knowledge: number;
  compatibility: number;
  compatability: number;
  confidence: number;
  commitment: number;
};

export type AssessmentEvaluation = {
  metrics: AssessmentMetrics;
  overallScore: number;
  recommendedModules: string[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sanitizeMultiChoice<T extends readonly string[]>(
  input: unknown,
  allowed: T
) {
  if (!Array.isArray(input)) {
    return [] as T[number][];
  }

  const allowedSet = new Set<string>(allowed);
  const unique = Array.from(new Set(input.map((value) => String(value || '').trim()).filter(Boolean)));

  if (unique.includes('none')) {
    return ['none'] as T[number][];
  }

  return unique.filter((value): value is T[number] => allowedSet.has(value as T[number]));
}

function sanitizeSingleChoice<T extends readonly string[]>(
  input: unknown,
  allowed: T
) {
  const value = String(input || '').trim();
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : null;
}

function sanitizeSliderAnswers(input: unknown) {
  const answerMap = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  const sanitized: Partial<Record<SliderQuestionKey, SliderScale>> = {};

  for (const key of SLIDER_QUESTION_KEYS) {
    const raw = Number(answerMap[key]);
    if (Number.isFinite(raw) && raw >= 1 && raw <= 5) {
      sanitized[key] = Math.round(raw) as SliderScale;
    }
  }

  return sanitized;
}

export function normalizeInitialAssessmentResponse(input: unknown): InitialAssessmentResponse | null {
  const record = typeof input === 'object' && input ? (input as Record<string, unknown>) : null;
  if (!record) {
    return null;
  }

  const jobContexts = sanitizeMultiChoice(record.jobContexts, JOB_CONTEXT_OPTIONS);
  const sensitiveData = sanitizeMultiChoice(record.sensitiveData, SENSITIVE_DATA_OPTIONS);
  const policyView = sanitizeSingleChoice(record.policyView, POLICY_VIEW_OPTIONS);
  const policyUnderstanding = sanitizeSingleChoice(record.policyUnderstanding, POLICY_UNDERSTANDING_OPTIONS);
  const observedBehaviors = sanitizeMultiChoice(record.observedBehaviors, OBSERVED_BEHAVIOR_OPTIONS);
  const policyAdherence = sanitizeSingleChoice(record.policyAdherence, POLICY_ADHERENCE_OPTIONS);
  const sliderAnswers = sanitizeSliderAnswers(record.sliderAnswers);

  if (!policyView || !policyUnderstanding || !policyAdherence) {
    return null;
  }

  if (jobContexts.length === 0 || sensitiveData.length === 0 || observedBehaviors.length === 0) {
    return null;
  }

  if (SLIDER_QUESTION_KEYS.some((key) => !sliderAnswers[key])) {
    return null;
  }

  return {
    jobContexts,
    sensitiveData,
    policyView,
    policyUnderstanding,
    observedBehaviors,
    policyAdherence,
    sliderAnswers,
  };
}

export function evaluateInitialAssessment(params: {
  response: InitialAssessmentResponse;
  completedOnTime: boolean;
  attackSimulationFailed: boolean;
}) : AssessmentEvaluation {
  const { response, completedOnTime, attackSimulationFailed } = params;

  const policyViewScores: Record<(typeof POLICY_VIEW_OPTIONS)[number], number> = {
    'right-policies-personal-responsibility': 95,
    'good-policies-secure-culture': 88,
    'policy-makes-job-hard': 45,
    'bad-policies-work-around': 25,
  };

  const policyUnderstandingScores: Record<(typeof POLICY_UNDERSTANDING_OPTIONS)[number], number> = {
    'understand-actions-impact': 95,
    'mostly-understand-not-always-sure': 68,
    'not-sure-follow-others': 40,
    'do-what-i-want-systems-protect': 20,
  };

  const policyAdherenceScores: Record<(typeof POLICY_ADHERENCE_OPTIONS)[number], number> = {
    'everyone-follows': 96,
    'most-people-follow': 76,
    'some-people-follow': 48,
    'hardly-anyone-follows': 24,
  };

  const sliderValues = SLIDER_QUESTION_KEYS.map((key) => response.sliderAnswers[key] || 1);
  const sliderAverage = sliderValues.reduce((sum, value) => sum + value, 0) / sliderValues.length;
  const sliderScore = sliderAverage * 20;

  const observedRiskCount = response.observedBehaviors.includes('none') ? 0 : response.observedBehaviors.length;
  const environmentPenalty = Math.min(55, observedRiskCount * 11);

  const policyViewScore = policyViewScores[response.policyView as (typeof POLICY_VIEW_OPTIONS)[number]];
  const policyUnderstandingScore = policyUnderstandingScores[response.policyUnderstanding as (typeof POLICY_UNDERSTANDING_OPTIONS)[number]];
  const policyAdherenceScore = policyAdherenceScores[response.policyAdherence as (typeof POLICY_ADHERENCE_OPTIONS)[number]];

  const knowledge = clampScore((policyUnderstandingScore * 0.55) + (sliderScore * 0.45));
  const compatibility = clampScore((policyViewScore * 0.5) + (policyAdherenceScore * 0.35) + ((100 - environmentPenalty) * 0.15));
  const confidence = clampScore((policyViewScore * 0.45) + (policyAdherenceScore * 0.3) + (sliderScore * 0.25));

  const answeredEverything =
    response.jobContexts.length > 0
    && response.sensitiveData.length > 0
    && response.observedBehaviors.length > 0
    && SLIDER_QUESTION_KEYS.every((key) => Boolean(response.sliderAnswers[key]));

  const engagement = clampScore((answeredEverything ? 85 : 45) + (confidence * 0.15));
  const commitmentBase = completedOnTime ? 92 : 52;
  const commitment = clampScore((commitmentBase * 0.7) + (engagement * 0.15) + (confidence * 0.15));

  const recommendations = new Set<string>();

  const operationalRiskSignals = [
    'frequently-travel',
    'frequently-work-from-home',
    'use-company-laptop-mobile',
    'use-personal-devices-for-work',
    'copy-data-to-external-storage',
  ];

  const hasOperationalRisk = response.jobContexts.some((value) => operationalRiskSignals.includes(value));
  const handlesSensitiveOrPayment = response.sensitiveData.some((value) => value !== 'none') || response.jobContexts.includes('handle-payment-card-details');

  if (compatibility < 70 || hasOperationalRisk) {
    recommendations.add(RECOMMENDED_MODULE_IDS.hardwareSafety);
  }

  if (
    confidence < 70
    || policyViewScore < 70
    || policyUnderstandingScore < 60
    || policyAdherenceScore < 60
  ) {
    recommendations.add(RECOMMENDED_MODULE_IDS.policyAcknowledgement);
  }

  if (knowledge < 75 || handlesSensitiveOrPayment || response.jobContexts.includes('use-cloud-data-transfer')) {
    recommendations.add(RECOMMENDED_MODULE_IDS.passwordDataLifecycle);
  }

  if (attackSimulationFailed) {
    recommendations.add(RECOMMENDED_MODULE_IDS.phishCheck);
  }

  const overallScore = clampScore(
    (engagement * 0.2) + (knowledge * 0.24) + (compatibility * 0.2) + (confidence * 0.18) + (commitment * 0.18)
  );

  return {
    metrics: {
      engagement,
      knowledge,
      compatibility,
      compatability: compatibility,
      confidence,
      commitment,
    },
    overallScore,
    recommendedModules: Array.from(recommendations),
  };
}