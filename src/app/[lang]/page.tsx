import { getDictionary } from "./dictionaries";
import type { Locale } from "@/lib/types";

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{dict.home.hero}</h1>
        <p className="mt-4 text-lg opacity-70">{dict.home.heroSub}</p>
      </div>
    </main>
  );
}
