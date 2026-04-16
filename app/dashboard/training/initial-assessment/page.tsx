"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  JOB_CONTEXT_OPTIONS,
  OBSERVED_BEHAVIOR_OPTIONS,
  POLICY_ADHERENCE_OPTIONS,
  POLICY_UNDERSTANDING_OPTIONS,
  POLICY_VIEW_OPTIONS,
  SLIDER_QUESTION_KEYS,
  SENSITIVE_DATA_OPTIONS,
  type SliderQuestionKey,
} from "@/lib/initial-assessment";

type CurrentUser = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

const jobContextLabels: Record<(typeof JOB_CONTEXT_OPTIONS)[number], string> = {
  "frequently-travel": "I frequently travel for work",
  "frequently-work-from-home": "I frequently work from home",
  "use-cloud-data-transfer": "I use the cloud to process or transfer data",
  "use-social-media-for-work": "I use social media for my work",
  "work-in-bank-branch": "I work in a branch of a bank",
  "use-company-laptop-mobile": "I use a company laptop or mobile phone",
  "copy-data-to-external-storage": "I have to copy data/information onto external storage devices",
  "have-privileged-access": "I have administrator/privileged access to systems, such as IT, Finance or HR systems",
  "use-personal-devices-for-work": "I use my personal devices for work",
  "handle-payment-card-details": "I handle payment card details",
  none: "None of these apply",
};

const sensitiveDataLabels: Record<(typeof SENSITIVE_DATA_OPTIONS)[number], string> = {
  "financial-records": "Financial Records",
  "employee-records": "Employee Records",
  "customer-personal-information": "Customer Personal Information",
  "company-confidential-information": "Company confidential information",
  "intellectual-property": "Intellectual Property",
  none: "None of these apply",
};

const policyViewLabels: Record<(typeof POLICY_VIEW_OPTIONS)[number], string> = {
  "right-policies-personal-responsibility": "My organisation has the right policies in place, and I believe security is also my personal responsibility",
  "good-policies-secure-culture": "My organisation has good policies and I do see those around me behave securely",
  "policy-makes-job-hard": "My organisation's security policy makes it hard for me to do my job",
  "bad-policies-work-around": "My organisation has bad security policies, but I can work around them",
};

const policyUnderstandingLabels: Record<(typeof POLICY_UNDERSTANDING_OPTIONS)[number], string> = {
  "understand-actions-impact": "I understand how my actions can lead to cybercriminals accessing my company's data and infrastructure",
  "mostly-understand-not-always-sure": "I think I understand how my company wants me to behave when it comes to cybersecurity, but I am not always sure how that makes a difference",
  "not-sure-follow-others": "I'm not sure what exactly my company's security policies are and I just follow what others do",
  "do-what-i-want-systems-protect": "I usually behave how I want online and expect my company's security systems to prevent me from doing anything wrong",
};

const observedBehaviorLabels: Record<(typeof OBSERVED_BEHAVIOR_OPTIONS)[number], string> = {
  "no-id-badges": "Do not wear their ID badges",
  "paperwork-left-on-desks": "Leave paperwork on their desks",
  "visitors-unaccompanied": "Allow visitors to move freely unaccompanied in the office",
  "confidential-info-on-whiteboards": "Leave confidential information written on white boards",
  "pcs-left-unlocked": "Do not lock their PCs when leaving them unattended",
  "documents-left-on-printer": "Leave documents on the printer",
  "passwords-written-down": "Write down usernames and passwords",
  none: "None of these answers apply",
};

const adherenceLabels: Record<(typeof POLICY_ADHERENCE_OPTIONS)[number], string> = {
  "everyone-follows": "Everyone follows our information security policies",
  "most-people-follow": "Most people follow our information security policies",
  "some-people-follow": "Some people follow our information security policies",
  "hardly-anyone-follows": "Hardly anyone follows our information security policies",
};

const sliderLabels: Record<SliderQuestionKey, string> = {
  "stranger-access-challenged": "It would be difficult for a stranger to follow me into the building without being challenged",
  "malware-infection-difficult": "It would be difficult for malware to infect our computers",
  "insider-theft-difficult": "It would be difficult for someone in the company to steal confidential information",
  "unauthorized-cloud-difficult": "It would be difficult to use cloud storage/services that have not been authorised by my company",
};

const TOTAL_STEPS = 7;

function getInitials(user: CurrentUser | null) {
  if (!user) {
    return "U";
  }

  const first = (user.firstName || "").trim().charAt(0);
  const last = (user.lastName || "").trim().charAt(0);
  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }

  return (user.email || "U").charAt(0).toUpperCase();
}

function getDisplayName(user: CurrentUser | null) {
  if (!user) {
    return "User";
  }

  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return fullName || user.email || "User";
}

function stepTitle(step: number) {
  switch (step) {
    case 1:
      return "Question 1";
    case 2:
      return "Question 2";
    case 3:
      return "Question 3";
    case 4:
      return "Question 4";
    case 5:
      return "Question 5";
    case 6:
      return "Question 6";
    case 7:
      return "Question 7";
    default:
      return "Initial Assessment";
  }
}

export default function InitialAssessmentPage() {
  const router = useRouter();
  const params = useSearchParams();
  const campaignId = params.get("campaignId") || "";
  const itemId = params.get("itemId") || "";
  const dueAt = params.get("dueAt") || "";

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(1);
  const [startedAt] = useState(() => new Date().toISOString());

  const [jobContexts, setJobContexts] = useState<string[]>([]);
  const [sensitiveData, setSensitiveData] = useState<string[]>([]);
  const [policyView, setPolicyView] = useState("");
  const [policyUnderstanding, setPolicyUnderstanding] = useState("");
  const [observedBehaviors, setObservedBehaviors] = useState<string[]>([]);
  const [policyAdherence, setPolicyAdherence] = useState("");
  const [sliderAnswers, setSliderAnswers] = useState<Record<SliderQuestionKey, number>>({
    "stranger-access-challenged": 3,
    "malware-infection-difficult": 3,
    "insider-theft-difficult": 3,
    "unauthorized-cloud-difficult": 3,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/learners", { method: "GET", credentials: "include" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json().catch(() => ({}))) as CurrentUser;
        setCurrentUser(data);
      } catch {
        setCurrentUser(null);
      }
    }

    void loadCurrentUser();
  }, []);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  function toggleMultiChoice(value: string, current: string[], setCurrent: (next: string[]) => void) {
    if (value === "none") {
      setCurrent(["none"]);
      return;
    }

    const withoutNone = current.filter((item) => item !== "none");
    if (withoutNone.includes(value)) {
      setCurrent(withoutNone.filter((item) => item !== value));
      return;
    }

    setCurrent([...withoutNone, value]);
  }

  function validateStep(currentStep: number) {
    if (currentStep === 1) {
      return jobContexts.length > 0;
    }
    if (currentStep === 2) {
      return sensitiveData.length > 0;
    }
    if (currentStep === 3) {
      return Boolean(policyView);
    }
    if (currentStep === 4) {
      return Boolean(policyUnderstanding);
    }
    if (currentStep === 5) {
      return observedBehaviors.length > 0;
    }
    if (currentStep === 6) {
      return Boolean(policyAdherence);
    }
    if (currentStep === 7) {
      return SLIDER_QUESTION_KEYS.every((key) => Number(sliderAnswers[key]) >= 1 && Number(sliderAnswers[key]) <= 5);
    }
    return false;
  }

  function onNext() {
    setError("");
    if (!validateStep(step)) {
      setError("Please complete this question before continuing.");
      return;
    }

    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  }

  function onPrevious() {
    setError("");
    setStep((current) => Math.max(1, current - 1));
  }

  async function onLogout() {
    try {
      await fetch("/api/learners/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/signin";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!validateStep(7)) {
      setError("Please complete all slider values before submitting.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/learners/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          campaignId: campaignId || undefined,
          itemId: itemId || undefined,
          dueAt: dueAt || undefined,
          startedAt,
          response: {
            jobContexts,
            sensitiveData,
            policyView,
            policyUnderstanding,
            observedBehaviors,
            policyAdherence,
            sliderAnswers,
          },
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to submit assessment.");
      }

      setSuccess("Initial assessment completed. Your updated average score is now available on your dashboard.");
      window.setTimeout(() => {
        router.push("/dashboard");
      }, 600);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit assessment.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#111111]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-5">
            <img src="/images/flavio.png" alt="RiskAware logo" className="h-10 w-10 rounded-md" />
            <span className="text-lg font-semibold tracking-wide">RiskAware</span>
            <Link href="/dashboard" className="text-sm text-white/80 hover:text-white">
              Dashboard
            </Link>
            <span className="text-sm text-white/50">/</span>
            <span className="text-sm font-medium text-white">Initial Assessment</span>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD12A] to-[#FF7B80] text-sm font-bold text-black">
                {getInitials(currentUser)}
              </span>
              <span className="max-w-[200px] truncate text-sm font-medium text-white/90">{getDisplayName(currentUser)}</span>
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-lg border border-white/15 bg-[#151515] p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-red-200 hover:bg-red-500/20"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold">Initial Assessment Training Module</h1>
          <p className="mt-2 text-sm text-white/70">
            Complete this baseline one question at a time to calculate Engagement, Knowledge, Compatability,
            Confidence, and Commitment and update your dashboard average score.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-white/70">
            <span>{stepTitle(step)}</span>
            <span>{step} of {TOTAL_STEPS}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[#4FA3FF] to-[#46D6A8]" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">{success}</div>}

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6"
        >
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold">Question 1: Which of the following apply to your job?</h2>
              <div className="mt-3 grid gap-2">
                {JOB_CONTEXT_OPTIONS.map((option) => (
                  <label key={option} className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#171717] px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={jobContexts.includes(option)}
                      onChange={() => toggleMultiChoice(option, jobContexts, setJobContexts)}
                      className="mt-1"
                    />
                    <span>{jobContextLabels[option]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold">Question 2: What type of sensitive data or confidential information do you handle at work?</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SENSITIVE_DATA_OPTIONS.map((option) => (
                  <label key={option} className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#171717] px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sensitiveData.includes(option)}
                      onChange={() => toggleMultiChoice(option, sensitiveData, setSensitiveData)}
                      className="mt-1"
                    />
                    <span>{sensitiveDataLabels[option]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold">Question 3: Thinking about cybersecurity in your company, which statement best applies to you?</h2>
              <div className="mt-3 grid gap-2">
                {POLICY_VIEW_OPTIONS.map((option) => (
                  <label key={option} className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#171717] px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="policyView"
                      value={option}
                      checked={policyView === option}
                      onChange={(event) => setPolicyView(event.target.value)}
                      className="mt-1"
                    />
                    <span>{policyViewLabels[option]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold">Question 4: Following on from the previous question, which statement best applies to you?</h2>
              <div className="mt-3 grid gap-2">
                {POLICY_UNDERSTANDING_OPTIONS.map((option) => (
                  <label key={option} className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#171717] px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="policyUnderstanding"
                      value={option}
                      checked={policyUnderstanding === option}
                      onChange={(event) => setPolicyUnderstanding(event.target.value)}
                      className="mt-1"
                    />
                    <span>{policyUnderstandingLabels[option]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-lg font-semibold">Question 5: Which statement best describes what you see around you?</h2>
              <p className="mt-1 text-sm text-white/65">The people around me:</p>
              <div className="mt-3 grid gap-2">
                {OBSERVED_BEHAVIOR_OPTIONS.map((option) => (
                  <label key={option} className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#171717] px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={observedBehaviors.includes(option)}
                      onChange={() => toggleMultiChoice(option, observedBehaviors, setObservedBehaviors)}
                      className="mt-1"
                    />
                    <span>{observedBehaviorLabels[option]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h2 className="text-lg font-semibold">Question 6: Which statement best describes policy adherence around you?</h2>
              <div className="mt-3 grid gap-2">
                {POLICY_ADHERENCE_OPTIONS.map((option) => (
                  <label key={option} className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#171717] px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="policyAdherence"
                      value={option}
                      checked={policyAdherence === option}
                      onChange={(event) => setPolicyAdherence(event.target.value)}
                      className="mt-1"
                    />
                    <span>{adherenceLabels[option]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 7 && (
            <div>
              <h2 className="text-lg font-semibold">Question 7: Slider questions (Strongly Disagree to Strongly Agree)</h2>
              <p className="mt-1 text-sm text-white/65">Considering your organisation&apos;s security measures, and specifically your area of the business.</p>
              <div className="mt-4 space-y-4">
                {SLIDER_QUESTION_KEYS.map((key) => (
                  <div key={key} className="rounded-lg border border-white/10 bg-[#171717] px-4 py-3">
                    <label className="block text-sm text-white/90">{sliderLabels[key]}</label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={sliderAnswers[key]}
                      onChange={(event) => setSliderAnswers((current) => ({ ...current, [key]: Number(event.target.value) }))}
                      className="mt-3 w-full"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                      <span>Strongly Disagree</span>
                      <span className="rounded-md border border-white/15 px-2 py-0.5 text-white/80">{sliderAnswers[key]}</span>
                      <span>Strongly Agree</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onPrevious}
              disabled={step === 1 || submitting}
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <p className="text-xs text-white/60">Complete each question before moving to the next page.</p>

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={onNext}
                disabled={submitting}
                className="rounded-lg bg-[#4FA3FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#2D8CED] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#4FA3FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#2D8CED] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Assessment"}
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
