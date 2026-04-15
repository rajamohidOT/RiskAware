export type AttackTemplateOption = {
  id: string;
  title: string;
  subject: string;
  description: string;
  templateFile: string;
  collectsCredentials: boolean;
};

export type TrainingModuleOption = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  questions: string[];
};

export const ATTACK_TEMPLATE_OPTIONS: AttackTemplateOption[] = [
  {
    id: 'microsoft-password-expiry',
    title: 'Microsoft Password Expiry',
    subject: 'Action Required: Your Microsoft 365 password expires today',
    description: 'Simulates a Microsoft 365 password expiry notice with urgent action prompts.',
    templateFile: 'microsoft-password-expiry.html',
    collectsCredentials: true,
  },
  {
    id: 'netflix-reset-password',
    title: 'Netflix Reset Password',
    subject: 'Netflix: Verify your account details to avoid interruption',
    description: 'Simulates an account verification email disguised as a Netflix password reset.',
    templateFile: 'netflix-reset-password.html',
    collectsCredentials: true,
  },
  {
    id: 'dhl-shipping-alert',
    title: 'DHL Shipping Alert',
    subject: 'DHL: Delivery attempt failed, schedule redelivery now',
    description: 'Simulates a fake parcel delivery failure requiring an urgent action.',
    templateFile: 'dhl-shipping-alert.html',
    collectsCredentials: false,
  },
];

export const TRAINING_MODULE_OPTIONS: TrainingModuleOption[] = [
  {
    id: 'phishing-fundamentals',
    title: 'Phishing Fundamentals',
    description: 'Learn to spot common social engineering and phishing traits.',
    videoUrl: 'https://example.com/training/phishing-fundamentals',
    questions: [
      'Which signs indicate an email could be phishing?',
      'What should you verify before clicking a link?',
      'Who should suspicious emails be reported to?',
    ],
  },
  {
    id: 'password-security',
    title: 'Password Security Essentials',
    description: 'Build stronger authentication habits and reduce account compromise risk.',
    videoUrl: 'https://example.com/training/password-security',
    questions: [
      'What makes a password strong?',
      'Why should you avoid password reuse?',
      'How does MFA reduce credential risk?',
    ],
  },
  {
    id: 'safe-browsing-data-handling',
    title: 'Safe Browsing & Data Handling',
    description: 'Practice secure browsing and safe handling of sensitive organisational data.',
    videoUrl: 'https://example.com/training/safe-browsing-data-handling',
    questions: [
      'What are warning signs of malicious websites?',
      'How should sensitive files be shared securely?',
      'What should you do if data is sent to the wrong recipient?',
    ],
  },
];

export function getAttackTemplateById(id: string) {
  return ATTACK_TEMPLATE_OPTIONS.find((option) => option.id === id);
}

export function getTrainingModuleById(id: string) {
  return TRAINING_MODULE_OPTIONS.find((option) => option.id === id);
}
