"use client";

import React from "react";

interface DropdownProps {
  isOpen: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({ isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-full left-0 mt-3 w-64 bg-black/80 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">

      {/* Purple Top Bar */}
      <div className="h-[2px] w-full bg-[#A857FF]" />

      {/* Content */}
      <div className="p-4 flex flex-col space-y-3 text-white">
        <a href="#" className="hover:text-purple-400 transition-colors">
          Email Security
        </a>
        <a href="#" className="hover:text-purple-400 transition-colors">
          Phishing Simulation
        </a>
        <a href="#" className="hover:text-purple-400 transition-colors">
          Risk Analytics
        </a>
      </div>
    </div>
  );
};

export default Dropdown;
