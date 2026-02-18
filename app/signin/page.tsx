"use client";

import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] p-6">
      {/* Card */}
      <div className="w-full max-w-6xl rounded-2xl overflow-hidden flex shadow-[0_0_60px_rgba(168,87,255,0.08)] border border-white/10 bg-[#121212]">
        {/* LEFT SIDE */}
        <div className="w-1/2 p-16 flex flex-col justify-center">
          {/* Logo */}
          <div className="mb-10">
            <div className="w-8 h-8 bg-[#A857FF] rounded-md mb-6"></div>
            <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
            <p className="text-gray-400 mt-2">
              Enter to get unlimited access to data & information.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6">
            <div>
              <label className="block text-sm text-gray-400">Email*</label>
              <input
                type="email"
                placeholder="Enter your email address"
                className="mt-2 w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#A857FF] text-white placeholder-gray-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400">Password*</label>
              <input
                type="password"
                placeholder="Enter password"
                className="mt-2 w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#A857FF] text-white placeholder-gray-500 transition"
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
              className="w-full py-3 rounded-lg bg-[#A857FF] hover:bg-[#9440E6] text-white font-medium transition-all duration-200 shadow-lg shadow-[#A857FF]/20">
              Log In
            </button>

            {/* Divider */}
            <div className="flex items-center space-x-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-sm text-gray-500">Or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              className="w-full py-3 rounded-lg border border-white/10 flex items-center justify-center space-x-3 bg-[#1a1a1a] hover:bg-[#222] transition">
              <div className="grid grid-cols-2 gap-[2px] w-5 h-5">
                <div className="bg-[#F25022]"></div>
                <div className="bg-[#7FBA00]"></div>
                <div className="bg-[#00A4EF]"></div>
                <div className="bg-[#FFB900]"></div>
              </div>

              <span className="text-gray-300">Sign in with Microsoft</span>
            </button>

            <p className="text-center text-sm text-gray-500">
              Don’t have an account?{" "}
              <Link href="/signup" className="text-[#A857FF] hover:underline">
                Register here
              </Link>
            </p>
          </form>
        </div>

        {/* RIGHT SIDE */}
        <div className="w-1/2 bg-gradient-to-br from-[#1b0f3a] via-[#2a1457] to-[#0f0728] relative flex items-center justify-center">
          {/* Glow Effects */}
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#A857FF] rounded-full blur-3xl opacity-20" />
          <div className="absolute top-20 right-20 w-40 h-40 bg-[#A857FF] rounded-full blur-2xl opacity-20" />
        </div>
      </div>
    </div>
  );
}
