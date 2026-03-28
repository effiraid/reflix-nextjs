"use client";

import { useParams } from "next/navigation";
import { PricingModal } from "./PricingModal";
import type { Locale } from "@/lib/types";

export function PricingModalHost() {
  const { lang } = useParams<{ lang: string }>();
  return <PricingModal lang={(lang ?? "ko") as Locale} />;
}
