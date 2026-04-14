"use client";

import Hero from '@/components/Hero';
import Navbar from '@/components/Navbar';
import Partners from '@/components/Partners';
import Footer from "@/components/Footer";
import DashboardShowcase from "@/components/DashboardShowcase";
import DarkVeil from '@/components/DarkVeil';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">

      <div className="absolute inset-0 -z-10">
        <DarkVeil
          hueShift={0}
          noiseIntensity={0.05}
          scanlineIntensity={0}
          speed={0.4}
          scanlineFrequency={0}
          warpAmount={0.1}
        />
      </div>

      <Navbar />
      <Hero />
      <Partners />
      <DashboardShowcase />
      <Footer />
    </main>
  );
}