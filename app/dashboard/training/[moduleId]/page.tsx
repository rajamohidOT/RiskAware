"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getTrainingModuleById } from "@/lib/campaign-options";
import { buildTrainingAssignmentMetrics } from "@/lib/training-metrics";

type CurrentUser = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

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

function toDateOrNull(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function TrainingModulePage() {
  const router = useRouter();
  const params = useParams<{ moduleId: string }>();
  const searchParams = useSearchParams();
  const moduleId = typeof params?.moduleId === "string" ? params.moduleId : "";
  const campaignId = searchParams.get("campaignId") || "";
  const itemId = searchParams.get("itemId") || moduleId;
  const dueAt = searchParams.get("dueAt") || "";

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [startedAt] = useState(() => new Date().toISOString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const trainingModule = useMemo(() => getTrainingModuleById(moduleId), [moduleId]);

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

    if (!trainingModule) {
      setError("Training module not found.");
      return;
    }

    if (!confirmed) {
      setError("Confirm that you reviewed the assignment before submitting completion.");
      return;
    }

    try {
      setSubmitting(true);

      const completedAt = new Date();
      const startedDate = toDateOrNull(startedAt);
      const completionDurationMs = startedDate ? Math.max(0, completedAt.getTime() - startedDate.getTime()) : null;
      const dueDate = toDateOrNull(dueAt);
      const completedOnTime = !dueDate || completedAt <= dueDate;
      const derived = buildTrainingAssignmentMetrics({
        moduleId,
        completedOnTime,
        completionDurationMs,
      });

      const response = await fetch("/api/learners/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          campaignId,
          type: "training",
          itemId,
          result: {
            moduleId,
            completedOnTime,
            completionDurationMs,
            startedAt,
            metrics: derived.metrics,
            overallScore: derived.overallScore,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit training assignment.");
      }

      setSuccess("Assignment completed. Your dashboard metrics have been updated.");
      window.setTimeout(() => {
        router.push("/dashboard");
      }, 600);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit training assignment.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!trainingModule) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-400/30 bg-red-500/10 p-6">
          <h1 className="text-2xl font-semibold">Assignment not found</h1>
          <p className="mt-2 text-sm text-red-100/80">This training module does not exist or is not available.</p>
          <div className="mt-4">
            <Link href="/dashboard" className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
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
            <span className="text-sm font-medium text-white">Assignment</span>
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

      <section className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold">{trainingModule.title}</h1>
          <p className="mt-2 text-sm text-white/70">{trainingModule.description}</p>
        </div>

        {error && <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">{success}</div>}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Assignment Prompts</h2>
          <p className="mt-1 text-sm text-white/65">Review the material below, then submit completion.</p>

          <ul className="mt-4 space-y-3">
            {trainingModule.questions.map((question) => (
              <li key={question} className="rounded-lg border border-white/10 bg-[#171717] px-4 py-3 text-sm text-white/85">
                {question}
              </li>
            ))}
          </ul>

          <form onSubmit={handleSubmit} className="mt-6 border-t border-white/10 pt-4">
            <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#171717] px-4 py-3 text-sm text-white/85">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1"
              />
              <span>I have reviewed this assignment and I am ready to mark it as complete.</span>
            </label>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#4FA3FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#2D8CED] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Complete Assignment"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
