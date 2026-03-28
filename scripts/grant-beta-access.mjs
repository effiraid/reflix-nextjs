import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_SOURCES = new Set(["manual", "invite", "campaign"]);

export function parseArgs(argv) {
  const args = { source: "manual", note: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === "--email") args.email = value;
    if (token === "--days") args.days = Number.parseInt(value, 10);
    if (token === "--source") args.source = value;
    if (token === "--note") args.note = value;
  }

  if (!args.email || !args.days) {
    throw new Error(
      "Usage: --email <email> --days <days> [--source manual|invite|campaign] [--note text]"
    );
  }

  if (!Number.isInteger(args.days) || args.days <= 0) {
    throw new Error("--days must be a positive integer");
  }

  if (!ALLOWED_SOURCES.has(args.source)) {
    throw new Error("--source must be one of: manual, invite, campaign");
  }

  return args;
}

async function main() {
  const { email, days, source, note } = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase admin credentials not configured");
  }

  const supabase = createClient(url, key);
  const { data: users, error: listUsersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listUsersError) {
    throw listUsersError;
  }

  const user = users.users.find((entry) => entry.email === email);

  if (!user) {
    throw new Error(`No auth user found for ${email}`);
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("beta_access_grants").insert({
    user_id: user.id,
    source,
    starts_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    note: note || null,
  });

  if (error) throw error;

  console.log(
    JSON.stringify({
      email,
      userId: user.id,
      source,
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
