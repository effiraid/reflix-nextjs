import { Suspense } from "react";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { AccountClient } from "./AccountClient";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return (
    <Suspense fallback={null}>
      <AccountClient
        lang={lang as Locale}
        dict={dict}
      />
    </Suspense>
  );
}
