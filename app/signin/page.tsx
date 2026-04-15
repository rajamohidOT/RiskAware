"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage("");
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toastMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setToastMessage("");

      const response = await fetch("/api/learners/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to sign in right now.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in right now.";
      setToastMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] p-6">
      {toastMessage && (
        <div className="fixed right-5 top-5 z-50 max-w-sm rounded-lg border border-red-400/40 bg-[#2a1010] px-4 py-3 text-sm text-red-100 shadow-lg shadow-black/30">
          {toastMessage}
        </div>
      )}

      <div className="w-full max-w-6xl rounded-2xl overflow-hidden flex shadow-[0_0_60px_rgba(168,87,255,0.08)] border border-white/10 bg-[#121212]">
        <div className="w-1/2 p-16 flex flex-col justify-center">
          <div className="mb-10">
            <div className="w-8 h-8 bg-[#A857FF] rounded-md mb-6"></div>
            <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
            <p className="text-gray-400 mt-2">
              Enter to access your data & information.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm text-gray-400">Email*</label>
              <input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#A857FF] text-white placeholder-gray-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400">Password*</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#A857FF] text-white placeholder-gray-500 transition"
                required
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="accent-[#A857FF]" />
                <span className="text-gray-400">Remember me</span>
              </label>

              <a href="#" className="text-[#A857FF] hover:underline">
                Forgot your password?
              </a>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-[#A857FF] hover:bg-[#9440E6] disabled:opacity-70 disabled:cursor-not-allowed text-white font-medium transition-all duration-200 shadow-lg shadow-[#A857FF]/20">
              {submitting ? "Signing in..." : "Log In"}
            </button>

            

            <p className="text-center text-sm text-gray-500">
              Don’t have an account?{" "}
              <Link href="/signup" className="text-[#A857FF] hover:underline">
                Register here
              </Link>
            </p>
          </form>
        </div>

        <div className="w-1/2 bg-gradient-to-br from-[#1b0f3a] via-[#2a1457] to-[#0f0728] relative flex items-center justify-center">
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#A857FF] rounded-full blur-3xl opacity-20" />
          <div className="absolute top-20 right-20 w-40 h-40 bg-[#A857FF] rounded-full blur-2xl opacity-20" />
        </div>
      </div>
    </div>
  );
}
