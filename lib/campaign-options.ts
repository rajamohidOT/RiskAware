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
    id: 'initial-assessment-cyber-profile',
    title: 'Initial Assessment: Cyber Risk Profile',
    description: 'Baseline assessment to measure engagement, knowledge, compatability, confidence, and commitment.',
    videoUrl: 'https://example.com/training/initial-assessment-cyber-profile',
    questions: [
      'Which of the following apply to your job?',
      'What type of sensitive data or confidential information do you handle?',
      'Which cybersecurity policy statement best applies to you?',
      'How well do you understand how your cybersecurity behavior affects risk?',
      'Which statement best describes policy adherence around you?',
      'Rate how effective current security measures are in your area.',
    ],
  },
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
    id: 'hardware-safety',
    title: 'Hardware Safety',
    description: 'Protect company and personal devices, removable media, and physical workspace controls.',
    videoUrl: 'https://example.com/training/hardware-safety',
    questions: [
      'How should you secure laptops and mobile devices in transit?',
      'What controls apply to removable storage usage?',
      'What should you do before leaving a workstation unattended?',
    ],
  },
  {
    id: 'company-policy-acknowledgement',
    title: 'General Company Policy Acknowledgement',
    description: 'Understand and acknowledge the organisation security policies and expected behaviors.',
    videoUrl: 'https://example.com/training/company-policy-acknowledgement',
    questions: [
      'What are the key policy responsibilities for your role?',
      'When should policy exceptions be escalated?',
      'How do you challenge unsafe behaviors constructively?',
    ],
  },
  {
    id: 'passwords-data-lifecycle',
    title: 'Passwords and Data Lifecycle Management',
    description: 'Apply strong authentication and handle sensitive data through its full lifecycle.',
    videoUrl: 'https://example.com/training/passwords-data-lifecycle',
    questions: [
      'How do password policies reduce account compromise risk?',
      'How should data be classified, retained, and disposed of?',
      'What are secure methods for sharing confidential data?',
    ],
  },
  {
    id: 'spot-the-scam-phish-check',
    title: 'Spot the Scam: Phish Check',
    description: 'Reinforce phishing detection with practical scam-identification exercises.',
    videoUrl: 'https://example.com/training/spot-the-scam-phish-check',
    questions: [
      'What indicators reveal a phishing message?',
      'How do you validate links and sender identity safely?',
      'What immediate actions should follow a suspicious interaction?',
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
