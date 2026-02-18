"use client";

import React, { useState, useRef, useEffect } from "react";
import Dropdown from "./Dropdown";
import { useMediaQuery } from "../hooks/useMediaQuery";

const Navbar: React.FC = () => {
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (isMobile) return;

    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
    }

    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;

    closeTimeout.current = setTimeout(() => {
      setIsOpen(false);
    }, 150); // delay allows cursor to cross gap
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (closeTimeout.current) clearTimeout(closeTimeout.current);
    };
  }, []);

  return (
    <nav className="w-full h-16 flex items-center justify-between px-8 bg-transparent">
      {/* Logo */}
      <div className="flex items-center space-x-4">
        <img src="/logo.png" alt="" className="h-8 w-8" />
        <span className="text-white font-bold text-xl">RiskAware</span>
      </div>

      {/* Nav Center */}
      <div className="flex space-x-6 items-center glass-card">
        <div
          ref={dropdownRef}
          className="relative" // hover buffer
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            onClick={() => isMobile && setIsOpen((prev) => !prev)}
            className="flex items-center px-3 py-1 rounded-md text-white transition-colors duration-200 hover:bg-purple-500/20 group"
          >
            Products
            <svg
              className={`ml-2 w-4 h-4 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <Dropdown isOpen={isOpen} />
        </div>

        <button className="px-3 py-1 rounded-md text-white transition-colors duration-200 hover:bg-purple-500/20">
          Solutions
        </button>

        <button className="px-3 py-1 rounded-md text-white transition-colors duration-200 hover:bg-purple-500/20">
          Pricing
        </button>

        <button className="px-3 py-1 rounded-md text-white transition-colors duration-200 hover:bg-purple-500/20">
          Partners
        </button>

        <div className="h-5 w-px bg-white/30"></div>

        <button className="px-3 py-1 rounded-md text-white transition-colors duration-200 hover:bg-purple-500/20">
          Sign In
        </button>
      </div>

      {/* CTA */}
      <button className="glass text-white px-4 py-2">
        Get a Demo
      </button>
    </nav>
  );
};

export default Navbar;
