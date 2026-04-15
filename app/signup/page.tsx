"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type InvitePayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  department?: string;
  organisation?: string;
};

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadInvite() {
      if (!token) {
        setLoadingInvite(false);
        setError("Invite token is missing. Please use the signup link from your email.");
        return;
      }

      try {
        setLoadingInvite(true);
        setError("");

        const response = await fetch(`/api/learners/signup?token=${encodeURIComponent(token)}`, {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Invite link is invalid or expired.");
        }

        setInvite(data.invite || null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load invite details.";
        setError(message);
      } finally {
        setLoadingInvite(false);
      }
    }

    loadInvite();
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/learners/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to complete signup.");
      }

      setSuccess("Your account is ready. Redirecting to sign in...");
      setTimeout(() => {
        router.push("/signin");
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to complete signup.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] p-6">
      <div className="w-full max-w-6xl rounded-2xl overflow-hidden flex shadow-[0_0_60px_rgba(168,87,255,0.08)] border border-white/10 bg-[#121212]">
        <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
          <div className="mb-8">
            <div className="w-8 h-8 bg-[#A857FF] rounded-md mb-6"></div>
            <h1 className="text-3xl font-semibold text-white">Complete your signup</h1>
            <p className="text-gray-400 mt-2">
              Set your password to activate your RiskAware account.
            </p>
          </div>

          {loadingInvite && <p className="text-sm text-gray-300 mb-6">Loading invite details...</p>}

          {!loadingInvite && error && (
            <div className="mb-6 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loadingInvite && success && (
            <div className="mb-6 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          )}

          {!loadingInvite && invite && (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <InfoField label="Email" value={invite.email} />
                <InfoField label="Organisation" value={invite.organisation || "-"} />
                <InfoField label="First Name" value={invite.firstName || "-"} />
                <InfoField label="Last Name" value={invite.lastName || "-"} />
                <InfoField label="Country" value={invite.country || "-"} />
                <InfoField label="Department" value={invite.department || "-"} />
              </div>

              <div>
                <label className="block text-sm text-gray-400">Password*</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  className="mt-2 w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#A857FF] text-white placeholder-gray-500 transition"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400">Confirm Password*</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm password"
                  className="mt-2 w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#A857FF] text-white placeholder-gray-500 transition"
                  required
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-[#A857FF] hover:bg-[#9440E6] disabled:opacity-70 disabled:cursor-not-allowed text-white font-medium transition-all duration-200 shadow-lg shadow-[#A857FF]/20"
              >
                {submitting ? "Setting up account..." : "Activate Account"}
              </button>

              <p className="text-center text-sm text-gray-500">
                Already activated?{" "}
                <Link href="/signin" className="text-[#A857FF] hover:underline">
                  Go to sign in
                </Link>
              </p>
            </form>
          )}
        </div>

        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1b0f3a] via-[#2a1457] to-[#0f0728] relative items-center justify-center">
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#A857FF] rounded-full blur-3xl opacity-20" />
          <div className="absolute top-20 right-20 w-40 h-40 bg-[#A857FF] rounded-full blur-2xl opacity-20" />
          <div className="relative z-10 px-12 text-center text-white/90">
            <h2 className="text-2xl font-semibold mb-3">Secure onboarding</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Your profile has been pre-configured by your admin. You only need to set a password to finish account setup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-gray-400 mb-1">{label}</label>
      <div className="rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 text-gray-200">{value}</div>
    </div>
  );
}
