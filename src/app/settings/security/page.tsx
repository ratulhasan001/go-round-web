"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Devices } from "@/components/security/Devices";

export default function SecurityPage() {
  return (
    <div className="animate-fade-up">
      <Link href="/settings" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Settings
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-deep text-lime shadow-lg shadow-deep/20">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Login & security</h1>
          <p className="text-sm text-muted">Who can get into this admin panel, and how.</p>
        </div>
      </div>

      <div className="grid gap-5">
        <Devices />
      </div>
    </div>
  );
}
