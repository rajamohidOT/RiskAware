"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";

type Learner = {
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

type Campaign = {
  _id?: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  type: "attack" | "training";
  status?: "in-progress" | "completed" | "inactive";
  enrolledUsers?: number;
  completionPercentage?: number;
  canSendReminders?: boolean;
};

type CampaignsResponse = {
  success?: boolean;
  message?: string;
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

function getStatusLabel(status: Campaign["status"]) {
  if (status === "completed") {
    return "Completed";
  }
  if (status === "inactive") {
    return "Inactive";
  }
  return "In Progress";
}

function getStatusClasses(status: Campaign["status"]) {
  if (status === "completed") {
    return "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30";
  }
  if (status === "inactive") {
    return "bg-zinc-500/20 text-zinc-200 border border-zinc-500/30";
  }
  return "bg-amber-500/20 text-amber-200 border border-amber-500/30";
}

function formatPercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export default function CampaignsPage() {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState<string | null>(null);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadCampaigns() {
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
        const message = err instanceof Error ? err.message : "Unable to load campaigns.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadCampaigns();
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

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [campaigns]
  );

  async function cancelCampaign(campaignId: string) {
    try {
      setDeletingCampaignId(campaignId);
      setError("");
      setSuccess("");
      setSettingsMenuOpen(null);

      const response = await fetch("/api/learners/campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: campaignId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to cancel campaign.");
      }

      setCampaigns((current) => current.filter((campaign) => campaign._id !== campaignId));
      setSuccess("Campaign cancelled successfully.");
      setDeleteCampaignId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to cancel campaign.";
      setError(message);
    } finally {
      setDeletingCampaignId(null);
    }
  }

  function requestDeleteCampaign(campaignId: string) {
    setSettingsMenuOpen(null);
    setDeleteCampaignId(campaignId);
  }

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

  async function sendReminders(campaignId: string) {
    try {
      setError("");
      setSuccess("");
      setSettingsMenuOpen(null);

      const response = await fetch("/api/admin/campaigns/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ campaignId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to send reminders.");
      }

      setSuccess(data?.message || "Reminders sent successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send reminders.";
      setError(message);
    }
  }

  async function resendAttackEmail(campaignId: string) {
    try {
      setError("");
      setSuccess("");
      setSettingsMenuOpen(null);

      const response = await fetch("/api/admin/campaigns/attack-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ campaignId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to resend attack simulation email.");
      }

      setSuccess(data?.message || "Attack simulation emails resent successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to resend attack simulation email.";
      setError(message);
    }
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#111111]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/images/flavio.png" alt="RiskAware logo" className="h-10 w-10 rounded-md" />
            <span className="text-lg font-semibold tracking-wide">RiskAware</span>
            <Link href="/dashboard" className="ml-4 rounded-md border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/85 hover:bg-white/10">
              Dashboard
            </Link>
            {learner?.role === "admin" && (
              <Link href="/users" className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/85 hover:bg-white/10">
                Users
              </Link>
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
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Campaigns</h1>
            <p className="mt-1 text-sm text-white/70">Manage your organisation campaigns and review activity.</p>
          </div>

          {learner?.role === "admin" && (
            <button
              type="button"
              onClick={() => setActionsOpen(true)}
              className="rounded-lg bg-[#A857FF] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#9440E6]"
            >
              Actions
            </button>
          )}
        </div>

        {loading && <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/80">Loading campaigns...</div>}
        {!loading && !error && success && <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-6 text-emerald-200">{success}</div>}
        {!loading && error && <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">{error}</div>}

        {!loading && !error && sortedCampaigns.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/80">No campaigns right now.</div>
        )}

        {!loading && !error && sortedCampaigns.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedCampaigns.map((campaign) => {
              const status = campaign.status || "in-progress";
              const completion = formatPercent(campaign.completionPercentage);

              return (
                <article
                  key={campaign._id || `${campaign.name}-${campaign.startDate}`}
                  className="relative rounded-xl border border-white/10 bg-white/5 p-5"
                >
                  {learner?.role === "admin" && campaign.type === "attack" && campaign._id && (
                    <Link
                      href={`/dashboard/campaigns/${campaign._id}/results`}
                      className="absolute inset-0 z-0 rounded-xl"
                      aria-label={`Open results for ${campaign.name}`}
                    />
                  )}

                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="relative z-10">
                      {learner?.role === "admin" && campaign.type === "attack" && campaign._id ? (
                        <Link href={`/dashboard/campaigns/${campaign._id}/results`} className="text-lg font-semibold text-white hover:text-[#FFB3B7]">
                          {campaign.name}
                        </Link>
                      ) : (
                        <h2 className="text-lg font-semibold">{campaign.name}</h2>
                      )}
                      <span
                        className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                          campaign.type === "attack"
                            ? "bg-[#FF7B80]/20 text-[#FFB3B7]"
                            : "bg-[#4FA3FF]/20 text-[#B9DCFF]"
                        }`}
                      >
                        {campaign.type}
                      </span>
                    </div>

                    {learner?.role === "admin" && campaign._id && (
                      <div className="relative z-20">
                        <button
                          type="button"
                          onClick={() => setSettingsMenuOpen((current) => (current === campaign._id ? null : campaign._id || null))}
                          aria-label="Campaign settings"
                          className="rounded-md border border-white/10 p-2 text-white/70 hover:bg-white/10"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M10.33 2.67h3.34l.5 2.2a7.98 7.98 0 0 1 1.8.74l1.92-1.2 2.36 2.36-1.2 1.92c.29.57.53 1.17.7 1.8l2.25.51v3.34l-2.25.5a8.32 8.32 0 0 1-.7 1.8l1.2 1.92-2.36 2.36-1.92-1.2a8.31 8.31 0 0 1-1.8.75l-.5 2.2h-3.34l-.5-2.2a8.33 8.33 0 0 1-1.8-.75l-1.92 1.2-2.36-2.36 1.2-1.92a8.32 8.32 0 0 1-.74-1.8l-2.2-.5v-3.34l2.2-.51c.18-.63.43-1.23.74-1.8l-1.2-1.92 2.36-2.36 1.92 1.2c.56-.3 1.16-.56 1.8-.74l.5-2.2Z" />
                            <circle cx="12" cy="12" r="3.25" />
                          </svg>
                        </button>

                        {settingsMenuOpen === campaign._id && (
                          <div className="absolute right-0 top-11 z-20 w-48 rounded-lg border border-white/10 bg-[#111111] p-1 shadow-xl">
                            <Link
                              href={`/dashboard/campaigns/${campaign._id}/edit`}
                              onClick={() => setSettingsMenuOpen(null)}
                              className="block rounded-md px-3 py-2 text-sm text-white/85 hover:bg-white/10"
                            >
                              Edit Campaign
                            </Link>

                            <button
                              type="button"
                              onClick={() => requestDeleteCampaign(campaign._id as string)}
                              className="block w-full rounded-md px-3 py-2 text-left text-sm text-rose-200 hover:bg-rose-500/20"
                            >
                              Cancel Campaign
                            </button>

                            {campaign.canSendReminders && (
                              <button
                                type="button"
                                onClick={() => void sendReminders(campaign._id as string)}
                                className="block w-full rounded-md px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
                              >
                                Send Reminders
                              </button>
                            )}

                            {campaign.type === "attack" && (
                              <button
                                type="button"
                                onClick={() => void resendAttackEmail(campaign._id as string)}
                                className="block w-full rounded-md px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
                              >
                                Resend Email
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {learner?.role === "admin" && campaign.type === "attack" && campaign._id ? (
                    <Link
                      href={`/dashboard/campaigns/${campaign._id}/results`}
                      className="relative z-10 mb-4 block line-clamp-3 text-sm text-white/75 hover:text-white"
                    >
                      {campaign.description || "No description provided."}
                    </Link>
                  ) : (
                    <p className="relative z-10 mb-4 line-clamp-3 text-sm text-white/75">{campaign.description || "No description provided."}</p>
                  )}

                  <div className="relative z-10 mb-4 flex items-center gap-4 text-xs text-white/70">
                    <span className="inline-flex items-center gap-2">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M8 3v4M16 3v4M3 10h18" />
                      </svg>
                      {new Date(campaign.startDate).toLocaleDateString()}
                    </span>

                    {learner?.role === "admin" && (
                      <span className="inline-flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <path d="M20 8v6M23 11h-6" />
                        </svg>
                        {(campaign.enrolledUsers || 0).toLocaleString()} Enrolled
                      </span>
                    )}
                  </div>

                  {learner?.role === "admin" && (
                    <div className="relative z-10 mt-5 border-t border-white/10 pt-4">
                      <div className="mb-2 text-xs text-white/65">{completion.toFixed(1)}% Completion</div>
                      <div className="h-2 w-full rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#4FA3FF] to-[#A857FF]" style={{ width: `${completion}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="relative z-10 mt-4 flex justify-end">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(status)}`}>
                      {getStatusLabel(status)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {actionsOpen && learner?.role === "admin" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Campaign Actions</h2>
                <p className="mt-1 text-sm text-white/65">Choose the kind of campaign you want to create for your organisation.</p>
              </div>
              <button
                type="button"
                onClick={() => setActionsOpen(false)}
                className="rounded-md border border-white/10 px-3 py-1 text-sm text-white/70 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Link
                href="/dashboard/create-training"
                onClick={() => setActionsOpen(false)}
                className="rounded-xl border border-[#4FA3FF]/25 bg-[#4FA3FF]/10 p-5 transition-colors hover:bg-[#4FA3FF]/15"
              >
                <span className="block text-lg font-semibold text-[#D7ECFF]">Create Training</span>
                <span className="mt-2 block text-sm text-white/70">Build a learning-focused campaign with modules, tasks, and awareness content.</span>
              </Link>

              <Link
                href="/dashboard/create-attack-simulation"
                onClick={() => setActionsOpen(false)}
                className="rounded-xl border border-[#FF7B80]/25 bg-[#FF7B80]/10 p-5 transition-colors hover:bg-[#FF7B80]/15"
              >
                <span className="block text-lg font-semibold text-[#FFD7D9]">Create Attack Simulation</span>
                <span className="mt-2 block text-sm text-white/70">Configure a phishing or social-engineering simulation for selected learners.</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteCampaignId && learner?.role === "admin")}
        title="Delete Campaign"
        message="This will permanently remove the campaign from this list. Do you want to continue?"
        confirmLabel="Delete"
        tone="danger"
        isConfirming={Boolean(deleteCampaignId) && deletingCampaignId === deleteCampaignId}
        onCancel={() => setDeleteCampaignId(null)}
        onConfirm={() => {
          if (deleteCampaignId) {
            void cancelCampaign(deleteCampaignId);
          }
        }}
      />
    </main>
  );
}
