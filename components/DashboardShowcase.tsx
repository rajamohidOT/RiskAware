"use client";

import Image from "next/image";

export default function DashboardShowcase() {
  return (
    <section className="flex flex-col items-center gap-4">
        <Image
            src="/images/dashboard.png"
            alt="Dashboard Showcase"
            width={1200}
            height={1000}
            className="rounded-lg shadow-lg"
        />
    </section>
  );
}