import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
  BACKEND_SHARED_SECRET: z.string().min(1, "BACKEND_SHARED_SECRET is required"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NOTION_API_KEY: optionalString,
  NOTION_DATABASE_ID: optionalString
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errorText = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${errorText}`);
}

export const config = parsed.data;

