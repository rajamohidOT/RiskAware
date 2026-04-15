"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type TrackingPreview = {
  templateTitle?: string;
  collectsCredentials?: boolean;
};

export default function AttackSimulationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = typeof params?.token === "string" ? params.token : "";
  const reportedFromEmail = searchParams.get("reported") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showReveal, setShowReveal] = useState(false);
  const [preview, setPreview] = useState<TrackingPreview | null>(null);

  useEffect(() => {
    async function loadPreview() {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/campaigns/attack-results?token=${encodeURIComponent(token)}`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Invalid simulation link");
        }

        const data = await response.json().catch(() => ({}));
        if (data?.preview) {
          setPreview(data.preview);
        }
      } catch {
        setPreview(null);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      void loadPreview();
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (reportedFromEmail) {
      setSuccess("Suspicious email reported.");
      setShowReveal(true);
    }
  }, [reportedFromEmail]);

  async function submitCredentialEvent() {
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/attack/track/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit details.");
      }

      setSuccess("Credentials entered.");
      setShowReveal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit details.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCredentialEvent();
  }

  if (loading) {
    return <main className="min-h-screen bg-[#0d0d0d] text-white p-8">Loading simulation...</main>;
  }

  const collectsCredentials = preview?.collectsCredentials !== false;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0d0d0d] p-6 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141414] p-6">
        <h1 className="text-2xl font-semibold">{preview?.templateTitle || "Account Verification"}</h1>
        {!showReveal && (
          <p className="mt-2 text-sm text-white/70">
            Please verify your account details to continue.
          </p>
        )}

        {error && <p className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        {success && <p className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</p>}

        {showReveal ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-4">
              <h2 className="text-lg font-semibold text-amber-100">This was a phishing simulation</h2>
              <p className="mt-2 text-sm text-amber-50/90">
                This page was part of a RiskAware phishing awareness exercise. If this were a real phishing email,
                entered credentials could be used to compromise your account.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4 text-sm text-white/80">
              <p className="font-medium text-white">How to stay safe next time</p>
              <ul className="mt-2 space-y-1 text-white/75">
                <li>Check the sender and destination URL carefully.</li>
                <li>Do not enter credentials from email links.</li>
                <li>Report suspicious emails to your security team.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => router.push("/signin")}
              className="w-full rounded-lg bg-[#A857FF] px-4 py-3 text-sm font-medium text-white hover:bg-[#9440E6]"
            >
              Return to RiskAware
            </button>
          </div>
        ) : collectsCredentials ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm text-white/70">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-white/70">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#A857FF] px-4 py-3 text-sm font-medium text-white hover:bg-[#9440E6] disabled:opacity-70"
            >
              {submitting ? "Submitting..." : "Verify Account"}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push("/signin")}
              className="w-full rounded-lg bg-[#A857FF] px-4 py-3 text-sm font-medium text-white hover:bg-[#9440E6] disabled:opacity-70"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
