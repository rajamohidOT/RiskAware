import crypto from 'crypto';

export const ATTACK_STAGE = {
  unopened: 'email unopened',
  opened: 'email opened',
  clicked: 'email clicked',
  reported: 'email reported',
  redeemed: 'email redeemed',
  credentials: 'email credentials',
} as const;

export type AttackStage = (typeof ATTACK_STAGE)[keyof typeof ATTACK_STAGE];

export function createTrackingToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashTrackingToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function deriveAttackStage(record: {
  openedAt?: Date | null;
  clickedAt?: Date | null;
  reportedAt?: Date | null;
  credentialsSubmittedAt?: Date | null;
}) {
  if (record.credentialsSubmittedAt) {
    return ATTACK_STAGE.credentials;
  }
  if (record.reportedAt && record.clickedAt) {
    return ATTACK_STAGE.redeemed;
  }
  if (record.reportedAt) {
    return ATTACK_STAGE.reported;
  }
  if (record.clickedAt) {
    return ATTACK_STAGE.clicked;
  }
  if (record.openedAt) {
    return ATTACK_STAGE.opened;
  }
  return ATTACK_STAGE.unopened;
}
