"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type CurrentUser = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

type TrainingSummary = {
  assignedLearners: number;
  startedLearners: number;
  completedLearners: number;
  notStartedLearners: number;
  startRate: number;
  completionRate: number;
  averageCompletionMinutes: number;
  averageMetrics: {
    overallScore: number;
    engagement: number;
    knowledge: number;
    compatability: number;
    confidence: number;
    commitment: number;
  };
};

type TrainingRecommendation = {
  moduleId: string;
  title: string;
  learners: number;
  percentage: number;
};

type LearnerMetricsRow = {
  learnerEmail: string;
  learnerName: string;
  status: "not-started" | "in-progress" | "completed";
  completedOnTime: boolean;
  submittedAt: string | null;
  completionDurationMs: number | null;
  overallScore: number | null;
  metrics: {
    engagement: number;
    knowledge: number;
    compatability: number;
    confidence: number;
    commitment: number;
  } | null;
};

type TrainingMetricsResponse = {
  success?: boolean;
  message?: string;
  campaign?: {
    id: string;
    name: string;
  };
  summary?: TrainingSummary;
  recommendations?: TrainingRecommendation[];
  learners?: LearnerMetricsRow[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "-";
  }

  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder.toFixed(0)}m`;
}

function getStatusClasses(status: LearnerMetricsRow["status"]) {
  if (status === "completed") {
    return "border border-emerald-500/30 bg-emerald-500/20 text-emerald-100";
  }

  if (status === "in-progress") {
    return "border border-amber-500/30 bg-amber-500/20 text-amber-100";
  }

  return "border border-zinc-500/30 bg-zinc-500/20 text-zinc-200";
}

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

export default function TrainingResultsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = typeof params?.id === "string" ? params.id : "";

  const [campaignName, setCampaignName] = useState("Training Campaign Metrics");
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [recommendations, setRecommendations] = useState<TrainingRecommendation[]>([]);
  const [learners, setLearners] = useState<LearnerMetricsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/learners", {
          method: "GET",
          credentials: "include",
        });

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
    async function loadTrainingMetrics() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/admin/campaigns/training-results?campaignId=${encodeURIComponent(campaignId)}`, {
          method: "GET",
          credentials: "include",
        });
        const data = (await response.json().catch(() => ({}))) as TrainingMetricsResponse;

        if (!response.ok || !data.success || !data.summary) {
          throw new Error(data.message || "Unable to load training campaign metrics.");
        }

        setCampaignName(data.campaign?.name || "Training Campaign Metrics");
        setSummary(data.summary);
        setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
        setLearners(Array.isArray(data.learners) ? data.learners : []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load training campaign metrics.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    if (campaignId) {
      void loadTrainingMetrics();
    }
  }, [campaignId]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
    };
  }, []);

  const completeOnTimeCount = useMemo(
    () => learners.filter((learner) => learner.status === "completed" && learner.completedOnTime).length,
    [learners]
  );

  async function onLogout() {
    try {
      await fetch("/api/learners/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/signin";
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
            <Link href="/dashboard/campaigns" className="text-sm text-white/80 hover:text-white">
              Campaigns
            </Link>
            <span className="text-sm text-white/50">/</span>
            <span className="text-sm font-medium text-white">Training Metrics</span>
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

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">{campaignName}</h1>
        <p className="mt-2 text-sm text-white/70">Organisation-level metric trends, recommendations, and learner-by-learner training status.</p>

        {loading && <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6 text-white/80">Loading training metrics...</div>}
        {!loading && error && <div className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">{error}</div>}

        {!loading && !error && summary && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-wide text-white/65">Completion Rate</p>
                <p className="mt-2 text-2xl font-semibold">{summary.completionRate.toFixed(1)}%</p>
                <p className="mt-1 text-xs text-white/60">{summary.completedLearners} of {summary.assignedLearners} learners completed</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-wide text-white/65">Not Started</p>
                <p className="mt-2 text-2xl font-semibold">{summary.notStartedLearners}</p>
                <p className="mt-1 text-xs text-white/60">Learners not started yet</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-wide text-white/65">Started</p>
                <p className="mt-2 text-2xl font-semibold">{summary.startRate.toFixed(1)}%</p>
                <p className="mt-1 text-xs text-white/60">{summary.startedLearners} started</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-wide text-white/65">Completed On Time</p>
                <p className="mt-2 text-2xl font-semibold">{completeOnTimeCount}</p>
                <p className="mt-1 text-xs text-white/60">From completed learners</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-wide text-white/65">Avg Completion Time</p>
                <p className="mt-2 text-2xl font-semibold">{formatDuration(summary.averageCompletionMinutes)}</p>
                <p className="mt-1 text-xs text-white/60">Assessment submission duration</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#4FA3FF]/20 bg-[#4FA3FF]/10 p-5">
              <h2 className="text-lg font-semibold text-[#D7ECFF]">Average Campaign Metrics</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                  <p className="text-xs uppercase tracking-wide text-white/70">Overall</p>
                  <p className="mt-1 text-xl font-semibold text-white">{summary.averageMetrics.overallScore.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                  <p className="text-xs uppercase tracking-wide text-white/70">Engagement</p>
                  <p className="mt-1 text-xl font-semibold text-white">{summary.averageMetrics.engagement.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                  <p className="text-xs uppercase tracking-wide text-white/70">Knowledge</p>
                  <p className="mt-1 text-xl font-semibold text-white">{summary.averageMetrics.knowledge.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                  <p className="text-xs uppercase tracking-wide text-white/70">Compatability</p>
                  <p className="mt-1 text-xl font-semibold text-white">{summary.averageMetrics.compatability.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                  <p className="text-xs uppercase tracking-wide text-white/70">Confidence</p>
                  <p className="mt-1 text-xl font-semibold text-white">{summary.averageMetrics.confidence.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                  <p className="text-xs uppercase tracking-wide text-white/70">Commitment</p>
                  <p className="mt-1 text-xl font-semibold text-white">{summary.averageMetrics.commitment.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">Organisation Recommendation Signals</h2>
              <p className="mt-1 text-sm text-white/70">Recommended follow-up modules based on campaign results across all learners.</p>
              {recommendations.length === 0 ? (
                <p className="mt-3 text-sm text-white/70">No recommendation signals yet. Complete assessments to generate suggestions.</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {recommendations.map((recommendation) => (
                    <div key={recommendation.moduleId} className="rounded-lg border border-white/10 bg-[#141414] p-3">
                      <p className="text-sm font-semibold text-white">{recommendation.title}</p>
                      <p className="mt-1 text-xs text-white/70">
                        {recommendation.learners} learners ({recommendation.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-lg font-semibold">Learner Breakdown</h2>
              <table className="w-full min-w-[1280px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/70">
                    <th className="pb-3 pr-4">Learner</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Overall</th>
                    <th className="pb-3 pr-4">Engagement</th>
                    <th className="pb-3 pr-4">Knowledge</th>
                    <th className="pb-3 pr-4">Compatability</th>
                    <th className="pb-3 pr-4">Confidence</th>
                    <th className="pb-3 pr-4">Commitment</th>
                    <th className="pb-3 pr-4">Duration</th>
                    <th className="pb-3 pr-4">On Time</th>
                    <th className="pb-3 pr-4">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((learner) => (
                    <tr key={learner.learnerEmail} className="border-b border-white/5">
                      <td className="py-3 pr-4">
                        <span className="block text-white">{learner.learnerName}</span>
                        <span className="block text-xs text-white/55">{learner.learnerEmail}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-1 text-xs ${getStatusClasses(learner.status)}`}>
                          {learner.status === "not-started" ? "Not Started" : learner.status === "in-progress" ? "In Progress" : "Completed"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-white/85">{learner.overallScore !== null ? `${learner.overallScore.toFixed(1)}%` : "-"}</td>
                      <td className="py-3 pr-4 text-white/85">{learner.metrics ? `${learner.metrics.engagement.toFixed(1)}%` : "-"}</td>
                      <td className="py-3 pr-4 text-white/85">{learner.metrics ? `${learner.metrics.knowledge.toFixed(1)}%` : "-"}</td>
                      <td className="py-3 pr-4 text-white/85">{learner.metrics ? `${learner.metrics.compatability.toFixed(1)}%` : "-"}</td>
                      <td className="py-3 pr-4 text-white/85">{learner.metrics ? `${learner.metrics.confidence.toFixed(1)}%` : "-"}</td>
                      <td className="py-3 pr-4 text-white/85">{learner.metrics ? `${learner.metrics.commitment.toFixed(1)}%` : "-"}</td>
                      <td className="py-3 pr-4 text-white/85">{learner.completionDurationMs ? formatDuration(learner.completionDurationMs / 60000) : "-"}</td>
                      <td className="py-3 pr-4 text-white/85">{learner.status === "completed" ? (learner.completedOnTime ? "Yes" : "No") : "-"}</td>
                      <td className="py-3 pr-4 text-white/85">{formatDate(learner.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
