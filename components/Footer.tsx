"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#0d0d0d] border-t border-white/10 mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Top Section */}
        <div className="flex flex-col md:flex-row justify-between gap-10">

          {/* Brand + Social */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">
              RiskAware™
            </h2>
            <p className="text-gray-400 max-w-sm mb-6">
              AI-powered risk assessment for smarter decision-making.
            </p>

            {/* Social Icons */}
            <div className="flex space-x-5">

              {/* Instagram */}
              <a href="#" className="text-gray-400 hover:text-[#A857FF] transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.75 2h8.5A5.75 5.75 0 0122 7.75v8.5A5.75 5.75 0 0116.25 22h-8.5A5.75 5.75 0 012 16.25v-8.5A5.75 5.75 0 017.75 2zm0 2A3.75 3.75 0 004 7.75v8.5A3.75 3.75 0 007.75 20h8.5A3.75 3.75 0 0020 16.25v-8.5A3.75 3.75 0 0016.25 4h-8.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm4.75-2.5a1 1 0 110 2 1 1 0 010-2z"/>
                </svg>
              </a>

              {/* X (Twitter) */}
              <a href="#" className="text-gray-400 hover:text-[#A857FF] transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.53 3H21l-7.19 8.22L22 21h-6.84l-5.36-6.6L4.3 21H1l7.7-8.8L2 3h6.97l4.86 6.02L17.53 3z"/>
                </svg>
              </a>

              {/* Facebook */}
              <a href="#" className="text-gray-400 hover:text-[#A857FF] transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12a10 10 0 10-11.5 9.87v-6.99H8v-2.88h2.5V9.41c0-2.48 1.48-3.86 3.74-3.86 1.08 0 2.21.19 2.21.19v2.43h-1.25c-1.23 0-1.62.77-1.62 1.56v1.87H16l-.4 2.88h-2.02v6.99A10 10 0 0022 12z"/>
                </svg>
              </a>

            </div>
          </div>

          {/* Useful Links */}
          <div>
            <h3 className="text-white font-medium mb-4">Useful Links</h3>
            <ul className="space-y-2 text-gray-400">
              <li><Link href="/" className="hover:text-[#A857FF] transition">Home</Link></li>
              <li><Link href="/about" className="hover:text-[#A857FF] transition">About Us</Link></li>
              <li><Link href="/privacy" className="hover:text-[#A857FF] transition">Privacy Policy</Link></li>
              <li><Link href="/cookies" className="hover:text-[#A857FF] transition">Cookie Policy</Link></li>
              <li><Link href="/terms" className="hover:text-[#A857FF] transition">Terms & Conditions</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Section */}
        <div className="border-t border-white/10 mt-12 pt-6 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} RiskAware™. All rights reserved.
        </div>

      </div>
    </footer>
  );
}