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
};

type TelemetryResponse = {
  success?: boolean;
  message?: string;
  overview?: TelemetryOverview;
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
  const [learner, setLearner] = useState<Learner | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryOverview | null>(null);
  const [learnerCampaignCount, setLearnerCampaignCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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
          const telemetryRes = await fetch("/api/admin/telemetry/overview", { method: "GET", credentials: "include" });
          const telemetryData = (await telemetryRes.json().catch(() => ({}))) as TelemetryResponse;
          if (!telemetryRes.ok || !telemetryData.success || !telemetryData.overview) {
            throw new Error(telemetryData.message || "Unable to load telemetry overview.");
          }

          setTelemetry(telemetryData.overview);
          setLearnerCampaignCount(0);
        } else {
          const campaignsRes = await fetch("/api/learners/campaigns", { method: "GET", credentials: "include" });
          const campaignsData = (await campaignsRes.json().catch(() => ({}))) as CampaignsResponse;
          if (!campaignsRes.ok || !campaignsData.success) {
            throw new Error(campaignsData.message || "Unable to load campaigns.");
          }

          setLearnerCampaignCount(Array.isArray(campaignsData.campaigns) ? campaignsData.campaigns.length : 0);
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
  }, []);

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
              <p className="mt-1 text-sm text-white/70">You currently have {learnerCampaignCount} assigned campaign(s).</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <Link href="/dashboard/campaigns" className="rounded-lg bg-[#A857FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#9440E6]">
                View Campaigns
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
