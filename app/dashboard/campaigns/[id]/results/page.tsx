"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type AttackResultRecord = {
  id: string;
  learnerEmail: string;
  learnerFirstName?: string;
  templateTitle: string;
  stage: string;
  sentAt?: string;
  openedAt?: string;
  clickedAt?: string;
  reportedAt?: string;
  credentialsSubmittedAt?: string;
};

type CurrentUser = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function getStageBadgeClasses(stage: string) {
  const normalized = stage.toLowerCase();

  if (normalized.includes('reported')) {
    return 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-100';
  }

  if (normalized.includes('credentials')) {
    return 'border border-rose-500/30 bg-rose-500/20 text-rose-100';
  }

  if (normalized.includes('clicked')) {
    return 'border border-amber-500/30 bg-amber-500/20 text-amber-200';
  }

  if (normalized.includes('opened')) {
    return 'border border-sky-500/30 bg-sky-500/20 text-sky-100';
  }

  return 'border border-zinc-500/30 bg-zinc-500/20 text-zinc-200';
}

export default function AttackResultsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = typeof params?.id === "string" ? params.id : "";

  const [campaignName, setCampaignName] = useState("Attack Simulation Results");
  const [records, setRecords] = useState<AttackResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    async function loadResults() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/admin/campaigns/attack-results?campaignId=${encodeURIComponent(campaignId)}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Unable to load attack simulation results.");
        }

        setCampaignName(typeof data?.campaign?.name === "string" ? data.campaign.name : "Attack Simulation Results");
        setRecords(Array.isArray(data?.records) ? data.records : []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load attack simulation results.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    if (campaignId) {
      void loadResults();
    }
  }, [campaignId]);

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

  const currentDisplayName = useMemo(() => {
    const firstName = (currentUser?.firstName || "").trim();
    const lastName = (currentUser?.lastName || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) {
      return fullName;
    }
    return currentUser?.email || "User";
  }, [currentUser]);

  const currentInitials = useMemo(() => {
    const firstName = (currentUser?.firstName || "").trim().charAt(0);
    const lastName = (currentUser?.lastName || "").trim().charAt(0);
    if (firstName || lastName) {
      return `${firstName}${lastName}`.toUpperCase();
    }
    return (currentUser?.email || "U").charAt(0).toUpperCase();
  }, [currentUser]);

  const reportRate = useMemo(() => {
    if (records.length === 0) {
      return 0;
    }
    const reported = records.filter((record) => Boolean(record.reportedAt)).length;
    return (reported / records.length) * 100;
  }, [records]);

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
            <span className="text-sm font-medium text-white">Attack Results</span>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD12A] to-[#FF7B80] text-sm font-bold text-black">
                {currentInitials}
              </span>
              <span className="max-w-[200px] truncate text-sm font-medium text-white/90">{currentDisplayName}</span>
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
        <p className="mt-2 text-sm text-white/70">Track email unopened/opened/clicked/credentials stages with timestamps for each learner.</p>

        {!loading && !error && records.length > 0 && (
          <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-200/80">Report Rate</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-100">{reportRate.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-emerald-100/80">
              {records.filter((record) => Boolean(record.reportedAt)).length} of {records.length} recipients reported this email as suspicious.
            </p>
          </div>
        )}

        {loading && <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6 text-white/80">Loading results...</div>}
        {!loading && error && <div className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 p-6 text-red-200">{error}</div>}

        {!loading && !error && records.length === 0 && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6 text-white/80">No simulation events recorded yet.</div>
        )}

        {!loading && !error && records.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-5">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/70">
                  <th className="pb-3 pr-4">Learner</th>
                  <th className="pb-3 pr-4">Template</th>
                  <th className="pb-3 pr-4">Stage</th>
                  <th className="pb-3 pr-4">Sent</th>
                  <th className="pb-3 pr-4">Opened</th>
                  <th className="pb-3 pr-4">Clicked</th>
                  <th className="pb-3 pr-4">Reported</th>
                  <th className="pb-3 pr-4">Credentials</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-white/5">
                    <td className="py-3 pr-4">
                      <span className="block text-white">{record.learnerFirstName || record.learnerEmail}</span>
                      <span className="block text-xs text-white/55">{record.learnerEmail}</span>
                    </td>
                    <td className="py-3 pr-4">{record.templateTitle}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-1 text-xs ${getStageBadgeClasses(record.stage)}`}>
                        {record.stage}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-white/80">{formatDate(record.sentAt)}</td>
                    <td className="py-3 pr-4 text-white/80">{formatDate(record.openedAt)}</td>
                    <td className="py-3 pr-4 text-white/80">{formatDate(record.clickedAt)}</td>
                    <td className="py-3 pr-4 text-white/80">{formatDate(record.reportedAt)}</td>
                    <td className="py-3 pr-4 text-white/80">{formatDate(record.credentialsSubmittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
