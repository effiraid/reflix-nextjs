import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const REQUIRED_R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

export function toR2ObjectKey(publicPath) {
  return publicPath.replace(/^\/+/, "");
}

export function getContentTypeForKey(key) {
  if (key.endsWith(".mp4")) return "video/mp4";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function getRequiredR2Config(env = process.env) {
  const missingKey = REQUIRED_R2_ENV_KEYS.find((key) => !env[key]?.trim());
  if (missingKey) {
    throw new Error(`Missing required R2 env var: ${missingKey}`);
  }

  return {
    accountId: env.R2_ACCOUNT_ID.trim(),
    accessKeyId: env.R2_ACCESS_KEY_ID.trim(),
    secretAccessKey: env.R2_SECRET_ACCESS_KEY.trim(),
    bucketName: env.R2_BUCKET_NAME.trim(),
  };
}

export function createR2ClientFromEnv(env = process.env) {
  const config = getRequiredR2Config(env);
  const { S3Client } = require("@aws-sdk/client-s3");

  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function uploadFile(
  { localPath, key, contentType = getContentTypeForKey(key), dryRun = false },
  { env = process.env, client = null, bucketName = null } = {}
) {
  if (dryRun) {
    return {
      key,
      localPath,
      contentType,
      dryRun: true,
      status: "planned",
    };
  }

  const resolvedBucketName = bucketName ?? getRequiredR2Config(env).bucketName;
  const resolvedClient = client ?? createR2ClientFromEnv(env);
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const body = fs.readFileSync(localPath);

  await resolvedClient.send(
    new PutObjectCommand({
      Bucket: resolvedBucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return {
    key,
    localPath,
    contentType,
    dryRun: false,
    status: "uploaded",
  };
}

export async function uploadBatch(
  entries,
  { dryRun = false, env = process.env, client = null } = {}
) {
  const bucketName = dryRun ? null : getRequiredR2Config(env).bucketName;
  const resolvedClient = dryRun ? client : client ?? createR2ClientFromEnv(env);
  const summary = {
    total: entries.length,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    entries: [],
  };

  for (const entry of entries) {
    const key = toR2ObjectKey(entry.publicPath);
    const contentType = getContentTypeForKey(key);

    if (dryRun) {
      const plannedEntry = await uploadFile(
        {
          localPath: entry.localPath,
          key,
          contentType,
          dryRun: true,
        },
        {
          env,
          client: resolvedClient,
        }
      );
      summary.skipped += 1;
      summary.entries.push(plannedEntry);
      continue;
    }

    let uploaded = false;
    let lastError = null;
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const uploadedEntry = await uploadFile(
          {
            localPath: entry.localPath,
            key,
            contentType,
          },
          {
            env,
            client: resolvedClient,
            bucketName,
          }
        );

        summary.uploaded += 1;
        summary.entries.push(uploadedEntry);
        uploaded = true;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES - 1) {
          const delay = 1000 * 2 ** attempt; // 1s, 2s, 4s
          console.warn(`  ⚠️ Upload failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${key} — retrying in ${delay / 1000}s`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (!uploaded) {
      summary.failed += 1;
      summary.entries.push({
        key,
        localPath: entry.localPath,
        contentType,
        dryRun: false,
        status: "failed",
        error: lastError.message,
      });
    }
  }

  return summary;
}
