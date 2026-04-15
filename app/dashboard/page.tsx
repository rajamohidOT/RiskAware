"use client";

import { useEffect, useMemo, useState } from "react";

type Learner = {
  email: string;
  firstName?: string;
  lastName?: string;
};

type Campaign = {
  _id?: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  type: "attack" | "training";
};

type CampaignsResponse = {
  campaigns?: Campaign[];
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

function isActiveCampaign(campaign: Campaign) {
  const now = new Date();
  const start = new Date(campaign.startDate);
  const end = new Date(campaign.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return start <= now && now <= end;
}

export default function DashboardPage() {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [learnerRes, campaignsRes] = await Promise.all([
          fetch("/api/learners", { method: "GET", credentials: "include" }),
          fetch("/api/learners/campaigns", { method: "GET", credentials: "include" }),
        ]);

        if (!learnerRes.ok) {
          const learnerErr = await learnerRes.json().catch(() => ({}));
          throw new Error(learnerErr.message || "Unable to load learner profile.");
        }

        if (!campaignsRes.ok) {
          const campaignsErr = await campaignsRes.json().catch(() => ({}));
          throw new Error(campaignsErr.message || "Unable to load campaigns.");
        }

        const learnerData = (await learnerRes.json()) as Learner;
        const campaignsData = (await campaignsRes.json()) as CampaignsResponse;

        setLearner(learnerData);
        setCampaigns(Array.isArray(campaignsData.campaigns) ? campaignsData.campaigns : []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load dashboard.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const activeCampaigns = useMemo(
    () => campaigns.filter((campaign) => isActiveCampaign(campaign)),
    [campaigns]
  );

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#111111]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/images/flavio.png" alt="RiskAware logo" className="h-10 w-10 rounded-md" />
            <span className="text-lg font-semibold tracking-wide">RiskAware</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD12A] to-[#FF7B80] text-sm font-bold text-black">
              {getInitials(learner)}
            </div>
            <span className="text-sm font-medium text-white/90">{getDisplayName(learner)}</span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Your Active Campaigns</h1>
            <p className="mt-1 text-sm text-white/70">
              Campaigns currently running and assigned to your account.
            </p>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/80">
            Loading dashboard...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && activeCampaigns.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/80">
            No active campaigns right now.
          </div>
        )}

        {!loading && !error && activeCampaigns.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {activeCampaigns.map((campaign) => (
              <article
                key={campaign._id || `${campaign.name}-${campaign.startDate}`}
                className="rounded-xl border border-white/10 bg-white/5 p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{campaign.name}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      campaign.type === "attack"
                        ? "bg-[#FF7B80]/20 text-[#FFB3B7]"
                        : "bg-[#4FA3FF]/20 text-[#B9DCFF]"
                    }`}
                  >
                    {campaign.type}
                  </span>
                </div>

                <p className="mb-4 line-clamp-3 text-sm text-white/75">
                  {campaign.description || "No description provided."}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-white/65">
                  <span>Start: {new Date(campaign.startDate).toLocaleDateString()}</span>
                  <span>End: {new Date(campaign.endDate).toLocaleDateString()}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
