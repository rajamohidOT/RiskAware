"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Learner = {
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

type Campaign = {
  _id?: string;
  name?: string;
  description?: string;
  status?: "in-progress" | "completed" | "inactive";
  startDate?: string;
  endDate?: string;
  assignments?: Array<{
    id: string;
    title: string;
    description?: string;
    status?: string;
    completedAt?: string | null;
    launchUrl?: string;
  }>;
};

type CampaignsResponse = {
  success?: boolean;
  message?: string;
  campaigns?: Campaign[];
};

type TelemetryOverview = {
  totalCampaigns: number;
  runningCampaigns: number;
  learners: {
    total: number;
    active: number;
    inactiveOrUnverified: number;
    enrolledActive: number;
    enrolledTotal: number;
  };
  phishing: {
    totalEvents: number;
    clicked: number;
    reported: number;
    credentials: number;
    clickRate: number;
    reportRate: number;
    credentialRate: number;
  };
  assessment: {
    assessedLearners: number;
    pendingLearners: number;
    averageOverallScore: number;
    metrics: {
      engagement: number;
      knowledge: number;
      compatability: number;
      confidence: number;
      commitment: number;
    };
    trends: {
      period: "weekly" | "monthly" | "yearly";
      points: Array<{
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
      }>;
    };
  };
};

type TelemetryResponse = {
  success?: boolean;
  message?: string;
  overview?: TelemetryOverview;
};

type LearnerMetricsSummaryResponse = {
  success?: boolean;
  hasMetrics?: boolean;
  summary?: {
    completedAssignments?: number;
    overallScoreAverage?: number;
    metrics?: {
      engagement?: number;
      knowledge?: number;
      compatability?: number;
      confidence?: number;
      commitment?: number;
    };
  };
};

function getInitials(learner: Learner | null) {
  if (!learner) {
    return "U";
  }

  const first = learner.firstName?.trim().charAt(0) || "";
  const last = learner.lastName?.trim().charAt(0) || "";

  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }

  return learner.email.charAt(0).toUpperCase();
}

function getDisplayName(learner: Learner | null) {
  if (!learner) {
    return "User";
  }

  const fullName = `${learner.firstName || ""} ${learner.lastName || ""}`.trim();
  if (fullName) {
    return fullName;
  }

  return learner.email;
}

export default function DashboardPage() {
  const PAGE_SIZE = 10;
  const [learner, setLearner] = useState<Learner | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryOverview | null>(null);
  const [learnerCampaigns, setLearnerCampaigns] = useState<Campaign[]>([]);
  const [learnerMetricSummary, setLearnerMetricSummary] = useState<{
    completedAssignments: number;
    overallScoreAverage: number;
    metrics: {
      engagement: number;
      knowledge: number;
      compatability: number;
      confidence: number;
      commitment: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [sortDateField, setSortDateField] = useState<"startDate" | "endDate">("startDate");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [campaignPage, setCampaignPage] = useState(1);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const learnerRes = await fetch("/api/learners", { method: "GET", credentials: "include" });
        if (!learnerRes.ok) {
          const learnerErr = await learnerRes.json().catch(() => ({}));
          throw new Error(learnerErr.message || "Unable to load learner profile.");
        }

        const learnerData = (await learnerRes.json()) as Learner;
        setLearner(learnerData);

        if (learnerData.role === "admin") {
          const telemetryRes = await fetch(`/api/admin/telemetry/overview?period=${encodeURIComponent(trendPeriod)}`, { method: "GET", credentials: "include" });
          const telemetryData = (await telemetryRes.json().catch(() => ({}))) as TelemetryResponse;
          if (!telemetryRes.ok || !telemetryData.success || !telemetryData.overview) {
            throw new Error(telemetryData.message || "Unable to load telemetry overview.");
          }

          setTelemetry(telemetryData.overview);
        } else {
          const [campaignsRes, metricsRes] = await Promise.all([
            fetch("/api/learners/campaigns", { method: "GET", credentials: "include" }),
            fetch("/api/learners/training-metrics", { method: "GET", credentials: "include" }),
          ]);

          const campaignsData = (await campaignsRes.json().catch(() => ({}))) as CampaignsResponse;
          if (!campaignsRes.ok || !campaignsData.success) {
            throw new Error(campaignsData.message || "Unable to load campaigns.");
          }

          setLearnerCampaigns(Array.isArray(campaignsData.campaigns) ? campaignsData.campaigns : []);

          const metricsData = (await metricsRes.json().catch(() => ({}))) as LearnerMetricsSummaryResponse;
          if (metricsRes.ok && metricsData.success && metricsData.hasMetrics && metricsData.summary?.metrics) {
            setLearnerMetricSummary({
              completedAssignments: Number(metricsData.summary.completedAssignments || 0),
              overallScoreAverage: Number(metricsData.summary.overallScoreAverage || 0),
              metrics: {
                engagement: Number(metricsData.summary.metrics.engagement || 0),
                knowledge: Number(metricsData.summary.metrics.knowledge || 0),
                compatability: Number(metricsData.summary.metrics.compatability || 0),
                confidence: Number(metricsData.summary.metrics.confidence || 0),
                commitment: Number(metricsData.summary.metrics.commitment || 0),
              },
            });
          } else {
            setLearnerMetricSummary(null);
          }

          setTelemetry(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load dashboard.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [trendPeriod]);

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

  const enrollmentLabel = useMemo(() => {
    if (!telemetry) {
      return "";
    }
    return `${telemetry.learners.enrolledActive} active of ${telemetry.learners.enrolledTotal} enrolled`;
  }, [telemetry]);

  const filteredAndSortedLearnerCampaigns = useMemo(() => {
    const query = campaignSearch.trim().toLowerCase();

    const filtered = query
      ? learnerCampaigns.filter((campaign) => {
          const name = (campaign.name || "").toLowerCase();
          const description = (campaign.description || "").toLowerCase();
          const status = (campaign.status || "").toLowerCase();
          return name.includes(query) || description.includes(query) || status.includes(query);
        })
      : learnerCampaigns;

    return [...filtered].sort((a, b) => {
      const startA = new Date(a.startDate || "").getTime();
      const startB = new Date(b.startDate || "").getTime();
      const safeStartA = Number.isFinite(startA) ? startA : 0;
      const safeStartB = Number.isFinite(startB) ? startB : 0;
      const endA = new Date(a.endDate || "").getTime();
      const endB = new Date(b.endDate || "").getTime();
      const safeEndA = Number.isFinite(endA) ? endA : 0;
      const safeEndB = Number.isFinite(endB) ? endB : 0;

      const primaryA = sortDateField === "startDate" ? safeStartA : safeEndA;
      const primaryB = sortDateField === "startDate" ? safeStartB : safeEndB;
      if (primaryA !== primaryB) {
        return sortDirection === "asc" ? primaryA - primaryB : primaryB - primaryA;
      }

      const secondaryA = sortDateField === "startDate" ? safeEndA : safeStartA;
      const secondaryB = sortDateField === "startDate" ? safeEndB : safeStartB;
      if (secondaryA !== secondaryB) {
        return sortDirection === "asc" ? secondaryA - secondaryB : secondaryB - secondaryA;
      }

      return (a.name || "").localeCompare(b.name || "");
    });
  }, [campaignSearch, learnerCampaigns, sortDateField, sortDirection]);

  const totalCampaignPages = Math.max(1, Math.ceil(filteredAndSortedLearnerCampaigns.length / PAGE_SIZE));

  const paginatedLearnerCampaigns = useMemo(() => {
    const start = (campaignPage - 1) * PAGE_SIZE;
    return filteredAndSortedLearnerCampaigns.slice(start, start + PAGE_SIZE);
  }, [campaignPage, filteredAndSortedLearnerCampaigns]);

  useEffect(() => {
    setCampaignPage(1);
  }, [campaignSearch, sortDateField, sortDirection]);

  useEffect(() => {
    if (campaignPage > totalCampaignPages) {
      setCampaignPage(totalCampaignPages);
    }
  }, [campaignPage, totalCampaignPages]);

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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/images/flavio.png" alt="RiskAware logo" className="h-10 w-10 rounded-md" />
            <span className="text-lg font-semibold tracking-wide">RiskAware</span>
            {learner?.role === "admin" && (
              <>
                <Link href="/dashboard/campaigns" className="ml-4 rounded-md border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/85 hover:bg-white/10">
                  Campaigns
                </Link>
                <Link href="/users" className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/85 hover:bg-white/10">
                  Users
                </Link>
              </>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD12A] to-[#FF7B80] text-sm font-bold text-black">
                {getInitials(learner)}
              </div>
              <span className="text-sm font-medium text-white/90">{getDisplayName(learner)}</span>
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

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {learner?.role === "admin" ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">Organisation Telemetry</h1>
              <p className="mt-1 text-sm text-white/70">Monitor campaign activity, learner enrollment, and phishing trends.</p>
            </div>

            {loading && <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/80">Loading telemetry...</div>}
            {!loading && error && <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">{error}</div>}

            {!loading && !error && telemetry && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-wide text-white/65">Running Campaigns</p>
                    <p className="mt-2 text-2xl font-semibold">{telemetry.runningCampaigns}</p>
                    <p className="mt-1 text-xs text-white/60">{telemetry.totalCampaigns} total campaigns</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-wide text-white/65">Enrolled Learners</p>
                    <p className="mt-2 text-2xl font-semibold">{telemetry.learners.enrolledTotal}</p>
                    <p className="mt-1 text-xs text-white/60">{enrollmentLabel}</p>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5">
                    <p className="text-xs uppercase tracking-wide text-amber-100/80">Clicked Trend</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-100">{telemetry.phishing.clickRate.toFixed(1)}%</p>
                    <p className="mt-1 text-xs text-amber-100/80">{telemetry.phishing.clicked} of {telemetry.phishing.totalEvents} emails clicked</p>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                    <p className="text-xs uppercase tracking-wide text-emerald-100/80">Reported Trend</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-100">{telemetry.phishing.reportRate.toFixed(1)}%</p>
                    <p className="mt-1 text-xs text-emerald-100/80">{telemetry.phishing.reported} of {telemetry.phishing.totalEvents} emails reported</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#4FA3FF]/20 bg-[#4FA3FF]/10 p-5">
                  <h2 className="text-lg font-semibold text-[#D7ECFF]">Assessment Metrics (Organisation)</h2>
                  <p className="mt-1 text-sm text-[#D7ECFF]/75">
                    {telemetry.assessment.assessedLearners} assessed learners, {telemetry.assessment.pendingLearners} pending.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                      <p className="text-xs uppercase tracking-wide text-white/70">Overall Average</p>
                      <p className="mt-1 text-xl font-semibold text-white">{telemetry.assessment.averageOverallScore.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                      <p className="text-xs uppercase tracking-wide text-white/70">Engagement</p>
                      <p className="mt-1 text-xl font-semibold text-white">{telemetry.assessment.metrics.engagement.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                      <p className="text-xs uppercase tracking-wide text-white/70">Knowledge</p>
                      <p className="mt-1 text-xl font-semibold text-white">{telemetry.assessment.metrics.knowledge.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                      <p className="text-xs uppercase tracking-wide text-white/70">Compatability</p>
                      <p className="mt-1 text-xl font-semibold text-white">{telemetry.assessment.metrics.compatability.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                      <p className="text-xs uppercase tracking-wide text-white/70">Confidence</p>
                      <p className="mt-1 text-xl font-semibold text-white">{telemetry.assessment.metrics.confidence.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#102235] p-3">
                      <p className="text-xs uppercase tracking-wide text-white/70">Commitment</p>
                      <p className="mt-1 text-xl font-semibold text-white">{telemetry.assessment.metrics.commitment.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Assessment Trend View</h2>
                      <p className="mt-1 text-sm text-white/70">Review metric movement by week, month, or year.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTrendPeriod("weekly")}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${trendPeriod === "weekly" ? "bg-[#4FA3FF] text-white" : "border border-white/20 bg-white/5 text-white/75"}`}
                      >
                        Weekly
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrendPeriod("monthly")}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${trendPeriod === "monthly" ? "bg-[#4FA3FF] text-white" : "border border-white/20 bg-white/5 text-white/75"}`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrendPeriod("yearly")}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${trendPeriod === "yearly" ? "bg-[#4FA3FF] text-white" : "border border-white/20 bg-white/5 text-white/75"}`}
                      >
                        Yearly
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[960px] text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-white/65">
                          <th className="pb-3 pr-4">Period</th>
                          <th className="pb-3 pr-4">Submissions</th>
                          <th className="pb-3 pr-4">Overall</th>
                          <th className="pb-3 pr-4">Engagement</th>
                          <th className="pb-3 pr-4">Knowledge</th>
                          <th className="pb-3 pr-4">Compatability</th>
                          <th className="pb-3 pr-4">Confidence</th>
                          <th className="pb-3 pr-4">Commitment</th>
                          <th className="pb-3 pr-4">Avg Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {telemetry.assessment.trends.points.map((point) => (
                          <tr key={point.key} className="border-b border-white/5">
                            <td className="py-2 pr-4 text-white/85">{point.label}</td>
                            <td className="py-2 pr-4 text-white/85">{point.submissions}</td>
                            <td className="py-2 pr-4 text-white/85">{point.averageOverallScore.toFixed(1)}%</td>
                            <td className="py-2 pr-4 text-white/85">{point.engagement.toFixed(1)}%</td>
                            <td className="py-2 pr-4 text-white/85">{point.knowledge.toFixed(1)}%</td>
                            <td className="py-2 pr-4 text-white/85">{point.compatability.toFixed(1)}%</td>
                            <td className="py-2 pr-4 text-white/85">{point.confidence.toFixed(1)}%</td>
                            <td className="py-2 pr-4 text-white/85">{point.commitment.toFixed(1)}%</td>
                            <td className="py-2 pr-4 text-white/85">{point.averageCompletionMinutes > 0 ? `${point.averageCompletionMinutes.toFixed(1)} min` : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold">Learner Verification Snapshot</h2>
                  <p className="mt-2 text-sm text-white/70">
                    Active learners: {telemetry.learners.active} / {telemetry.learners.total}
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    Inactive or not verified yet: {telemetry.learners.inactiveOrUnverified}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="/dashboard/campaigns" className="rounded-lg bg-[#A857FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#9440E6]">
                    View Campaigns
                  </Link>
                  <Link href="/dashboard/create-attack-simulation" className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/85 hover:bg-white/10">
                    Create Attack Simulation
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">Welcome Back</h1>
              <p className="mt-1 text-sm text-white/70">Your assignments are grouped by campaign below.</p>
            </div>

            {learnerMetricSummary && (
              <div className="mb-6 space-y-4 rounded-2xl border border-[#46D6A8]/20 bg-[#46D6A8]/10 p-6">
                <div>
                  <h2 className="text-lg font-semibold text-[#D6FFE8]">Your Average Training Metrics</h2>
                  <p className="mt-1 text-sm text-white/75">
                    Based on {learnerMetricSummary.completedAssignments} completed assignment(s). Overall average: {learnerMetricSummary.overallScoreAverage.toFixed(1)}%
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-white/10 bg-[#10211b] p-4">
                    <p className="text-xs uppercase tracking-wide text-white/65">Engagement</p>
                    <p className="mt-1 text-xl font-semibold">{learnerMetricSummary.metrics.engagement.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#10211b] p-4">
                    <p className="text-xs uppercase tracking-wide text-white/65">Knowledge</p>
                    <p className="mt-1 text-xl font-semibold">{learnerMetricSummary.metrics.knowledge.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#10211b] p-4">
                    <p className="text-xs uppercase tracking-wide text-white/65">Compatability</p>
                    <p className="mt-1 text-xl font-semibold">{learnerMetricSummary.metrics.compatability.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#10211b] p-4">
                    <p className="text-xs uppercase tracking-wide text-white/65">Confidence</p>
                    <p className="mt-1 text-xl font-semibold">{learnerMetricSummary.metrics.confidence.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#10211b] p-4">
                    <p className="text-xs uppercase tracking-wide text-white/65">Commitment</p>
                    <p className="mt-1 text-xl font-semibold">{learnerMetricSummary.metrics.commitment.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                placeholder="Search campaigns"
                className="w-56 rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-[#4FA3FF]"
              />
              <select
                value={sortDateField}
                onChange={(event) => setSortDateField(event.target.value as "startDate" | "endDate")}
                className="rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#4FA3FF]"
              >
                <option value="startDate">Start Date</option>
                <option value="endDate">End Date</option>
              </select>
              <select
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value as "desc" | "asc")}
                className="rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#4FA3FF]"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>

            {filteredAndSortedLearnerCampaigns.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/80">No assigned training campaigns right now.</div>
            ) : (
              <div className="space-y-5">
                {paginatedLearnerCampaigns.map((campaign) => (
                  <section key={campaign._id || campaign.name} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold text-white">{campaign.name || "Training Campaign"}</h2>
                        <p className="mt-1 text-sm text-white/70">{campaign.description || "No description provided."}</p>
                      </div>
                      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                        {campaign.status === "completed" ? "Completed" : campaign.status === "inactive" ? "Inactive" : "In Progress"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {Array.isArray(campaign.assignments) && campaign.assignments.map((assignment) => {
                        const assignmentStatus = assignment.status || "not-started";
                        const isExpired = assignmentStatus === "expired";
                        const badgeClasses = assignmentStatus === "completed"
                          ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-100"
                          : isExpired
                            ? "border-zinc-500/40 bg-zinc-700/40 text-zinc-200"
                          : assignmentStatus === "in-progress"
                            ? "border-amber-500/30 bg-amber-500/20 text-amber-100"
                            : "border-zinc-500/30 bg-zinc-500/20 text-zinc-200";

                        return (
                          <article key={assignment.id} className={`rounded-xl border p-4 ${isExpired ? "border-zinc-600/40 bg-zinc-900/40 opacity-70" : "border-white/10 bg-[#151515]"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-base font-semibold text-white">{assignment.title}</h3>
                                <p className="mt-1 text-sm text-white/65">{assignment.description || "Assigned as part of this campaign."}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeClasses}`}>
                                {assignmentStatus === "completed" ? "Completed" : assignmentStatus === "expired" ? "Expired" : assignmentStatus === "in-progress" ? "In Progress" : "Not Started"}
                              </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                              <div className="text-xs text-white/55">
                                {campaign.endDate ? `Due ${new Date(campaign.endDate).toLocaleDateString()}` : "No due date"}
                              </div>
                              {assignmentStatus !== "completed" && assignmentStatus !== "expired" ? (
                                assignment.launchUrl ? (
                                <Link href={assignment.launchUrl} className="rounded-lg bg-[#4FA3FF] px-3 py-2 text-sm font-medium text-white hover:bg-[#2D8CED]">
                                  Open Assignment
                                </Link>
                                ) : (
                                  <span className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/70">Unavailable</span>
                                )
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <p className="text-xs text-white/65">
                    Showing {(campaignPage - 1) * PAGE_SIZE + 1}-{Math.min(campaignPage * PAGE_SIZE, filteredAndSortedLearnerCampaigns.length)} of {filteredAndSortedLearnerCampaigns.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCampaignPage((prev) => Math.max(1, prev - 1))}
                      disabled={campaignPage === 1}
                      className="rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-white/70">Page {campaignPage} of {totalCampaignPages}</span>
                    <button
                      type="button"
                      onClick={() => setCampaignPage((prev) => Math.min(totalCampaignPages, prev + 1))}
                      disabled={campaignPage === totalCampaignPages}
                      className="rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
