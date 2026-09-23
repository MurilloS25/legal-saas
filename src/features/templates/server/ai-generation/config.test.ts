import { describe, expect, it } from "vitest";
import { readAiTemplateConfig } from "./config";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
};

describe("readAiTemplateConfig", () => {
  it("is disabled when AI_PROVIDER is not set", () => {
    expect(readAiTemplateConfig({ ...base })).toEqual({ available: false, reason: "disabled" });
  });

  it("requires both the OpenAI key and an explicit model (no hardcoded default)", () => {
    expect(readAiTemplateConfig({ ...base, AI_PROVIDER: "openai", OPENAI_API_KEY: "k" })).toEqual({
      available: false,
      reason: "missing_credentials",
    });
    expect(readAiTemplateConfig({ ...base, AI_PROVIDER: "openai", OPENAI_MODEL: "m" })).toEqual({
      available: false,
      reason: "missing_credentials",
    });
  });

  it("builds the OpenAI configuration with defaults", () => {
    const result = readAiTemplateConfig({
      ...base,
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "k",
      OPENAI_MODEL: "model-from-env",
    });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.config).toMatchObject({
      provider: "openai",
      model: "model-from-env",
      maxFileBytes: 10_000_000,
      maxPages: 5,
      dailyLimitPerUser: 2,
    });
  });

  it("accepts stricter numeric overrides and rejects out-of-range ones", () => {
    const env = { ...base, AI_PROVIDER: "openai", OPENAI_API_KEY: "k", OPENAI_MODEL: "m" };
    const strict = readAiTemplateConfig({
      ...env,
      AI_TEMPLATE_MAX_PAGES: "3",
      AI_TEMPLATE_DAILY_LIMIT: "5",
      AI_TEMPLATE_TIMEOUT_MS: "60000",
      AI_TEMPLATE_MAX_FILE_BYTES: "2000000",
    });
    expect(strict.available && strict.config).toMatchObject({
      maxPages: 3,
      maxExtractedChars: 12_000,
      dailyLimitPerUser: 5,
      providerTimeoutMs: 60_000,
      maxFileBytes: 2_000_000,
    });
    expect(readAiTemplateConfig({ ...env, AI_TEMPLATE_MAX_PAGES: "50" }).available).toBe(false);
    expect(readAiTemplateConfig({ ...env, AI_TEMPLATE_MAX_FILE_BYTES: "50000000" }).available).toBe(false);
    expect(readAiTemplateConfig({ ...env, AI_TEMPLATE_DAILY_LIMIT: "-1" }).available).toBe(false);
  });

  it("is unavailable without the service role (quota cannot be enforced)", () => {
    expect(
      readAiTemplateConfig({
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "k",
        OPENAI_MODEL: "m",
        NEXT_PUBLIC_SUPABASE_URL: "http://x",
      }),
    ).toEqual({ available: false, reason: "missing_credentials" });
  });

  it("never enables the fake provider in production builds", () => {
    expect(readAiTemplateConfig({ ...base, AI_PROVIDER: "fake", NODE_ENV: "production" })).toEqual({
      available: false,
      reason: "invalid",
    });
    expect(readAiTemplateConfig({ ...base, AI_PROVIDER: "fake", NODE_ENV: "development" }).available).toBe(true);
  });

  it("rejects unknown providers", () => {
    expect(readAiTemplateConfig({ ...base, AI_PROVIDER: "gemini" })).toEqual({
      available: false,
      reason: "invalid",
    });
  });

  it("builds the Anthropic configuration from its own variables only", () => {
    const result = readAiTemplateConfig({
      ...base,
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "a",
      ANTHROPIC_MODEL: "anthropic-model-from-env",
      OPENAI_API_KEY: "o",
      OPENAI_MODEL: "openai-model",
    });
    expect(result.available && result.config).toMatchObject({
      provider: "anthropic",
      apiKey: "a",
      model: "anthropic-model-from-env",
      dailyLimitPerUser: 2,
      providerTimeoutMs: 120_000,
    });
  });

  it("reads the optional ANTHROPIC_WORKSPACE_ID and rejects malformed values", () => {
    const env = { ...base, AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a", ANTHROPIC_MODEL: "m" };
    const none = readAiTemplateConfig(env);
    expect(none.available && none.config.workspaceId).toBeNull();
    const withId = readAiTemplateConfig({ ...env, ANTHROPIC_WORKSPACE_ID: "wrkspc_01abc" });
    expect(withId.available && withId.config.workspaceId).toBe("wrkspc_01abc");
    expect(readAiTemplateConfig({ ...env, ANTHROPIC_WORKSPACE_ID: "bad id!" }).available).toBe(false);
  });

  it("defaults ANTHROPIC_EFFORT to low, accepts valid levels and off, rejects others", () => {
    const env = { ...base, AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a", ANTHROPIC_MODEL: "m" };
    const byDefault = readAiTemplateConfig(env);
    expect(byDefault.available && byDefault.config.anthropicEffort).toBe("low");
    const high = readAiTemplateConfig({ ...env, ANTHROPIC_EFFORT: "HIGH" });
    expect(high.available && high.config.anthropicEffort).toBe("high");
    const off = readAiTemplateConfig({ ...env, ANTHROPIC_EFFORT: "off" });
    expect(off.available && off.config.anthropicEffort).toBeNull();
    expect(readAiTemplateConfig({ ...env, ANTHROPIC_EFFORT: "turbo" }).available).toBe(false);
  });

  it("requires ANTHROPIC_API_KEY and ANTHROPIC_MODEL (no hardcoded default)", () => {
    expect(
      readAiTemplateConfig({ ...base, AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a" }),
    ).toEqual({ available: false, reason: "missing_credentials" });
    expect(
      readAiTemplateConfig({
        ...base,
        AI_PROVIDER: "anthropic",
        ANTHROPIC_MODEL: "m",
        OPENAI_API_KEY: "o",
      }),
    ).toEqual({ available: false, reason: "missing_credentials" });
  });
});
