#!/usr/bin/env node

const dotenv = require("dotenv");
const { Client: MinioClient } = require("minio");

dotenv.config();

const checks = [];

function pass(label, detail) {
  checks.push({ ok: true, label, detail });
}

function fail(label, detail) {
  checks.push({ ok: false, label, detail });
}

function env(name, fallback) {
  return process.env[name] ?? fallback;
}

async function main() {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && openAiKey.trim()) {
    pass("OPENAI_API_KEY", "present and non-empty");
  } else {
    fail("OPENAI_API_KEY", "missing or empty in .env");
  }

  const minioConfig = {
    endPoint: env("MINIO_ENDPOINT", "127.0.0.1"),
    port: Number(env("MINIO_PORT", "9000")),
    useSSL: env("MINIO_USE_SSL", "false") === "true",
    accessKey: env("MINIO_ACCESS_KEY", "minioadmin"),
    secretKey: env("MINIO_SECRET_KEY", "minioadmin"),
  };
  const bucketName = env("MINIO_BUCKET", "surge-assets");

  const endpoint = `${minioConfig.useSSL ? "https" : "http"}://${minioConfig.endPoint}:${minioConfig.port}`;

  const minio = new MinioClient(minioConfig);

  try {
    const exists = await minio.bucketExists(bucketName);
    if (exists) {
      pass("MinIO S3 connection", `reachable at ${endpoint}`);
      pass("MinIO bucket", `${bucketName} exists`);
    } else {
      await minio.makeBucket(bucketName, "us-east-1");
      pass("MinIO S3 connection", `reachable at ${endpoint}`);
      pass("MinIO bucket", `${bucketName} was missing and has been created`);
    }
  } catch (error) {
    fail(
      "MinIO S3 connection",
      `unable to reach ${endpoint} with bucket ${bucketName}: ${error.message}`,
    );
    fail(
      "MinIO bucket",
      "not verified; start MinIO and confirm MINIO_* credentials before live tests",
    );
  }

  console.log("\nAI Creative Live Test Preflight");
  console.log("--------------------------------");
  for (const check of checks) {
    console.log(`${check.ok ? "[OK]" : "[MISSING]"} ${check.label}: ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.log("\nDiagnostic checklist before running live tests:");
    console.log("- Ensure .env contains a non-empty OPENAI_API_KEY.");
    console.log(
      `- Start a local MinIO server reachable at ${endpoint}, or set MINIO_ENDPOINT/MINIO_PORT/MINIO_USE_SSL.`,
    );
    console.log("- Confirm MINIO_ACCESS_KEY and MINIO_SECRET_KEY match the running MinIO service.");
    console.log(`- Ensure bucket ${bucketName} exists, or rerun this preflight after MinIO is online.`);
    process.exitCode = 1;
    return;
  }

  console.log("\nPreflight passed. Live AI creative E2E infrastructure is ready.");
}

main().catch((error) => {
  console.error("Preflight crashed:", error.message);
  process.exitCode = 1;
});
