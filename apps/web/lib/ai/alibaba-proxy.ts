/**
 * Local Alibaba Proxy (AliProxy) Client
 *
 * Connects to the local AliProxy instance (default http://127.0.0.1:8080/v1)
 * providing access to:
 * - Image generation via Wanx 2.1 / Qwen 3 Pro (wanx2.1-t2i-turbo / wan2.1-t2i-turbo)
 * - Video generation via Wan 2.1 / Wan 30 (wan2.1-t2v-turbo)
 * - Chat completions via Qwen models (qwen-plus, qwen-turbo, aliproxy-demo)
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export const ALIBABA_DEFAULT_IMAGE_MODEL = "wanx2.1-t2i-turbo";
export const ALIBABA_DEFAULT_VIDEO_MODEL = "wan2.1-t2v-turbo";
export const ALIBABA_DEFAULT_CHAT_MODEL = "qwen-plus";

export interface AlibabaProxyConfig {
  baseUrl: string;
  apiKey: string;
}

export function getAlibabaProxyConfig(): AlibabaProxyConfig {
  const baseUrl = (process.env.ALIPROXY_BASE_URL || "http://127.0.0.1:8080/v1").replace(/\/+$/, "");
  const apiKey = process.env.ALIPROXY_KEY || process.env.ALIBABA_PROXY_KEY || "aliproxy-local-key";
  return { baseUrl, apiKey };
}

export interface ImageGenerationOptions {
  prompt: string;
  model?: string;
  size?: "1024*1024" | "720*1280" | "1280*720" | string;
  n?: number;
}

export interface ImageGenerationResult {
  url: string;
  b64_json?: string;
  created: number;
}

export interface VideoSubmitOptions {
  prompt: string;
  model?: string;
  parameters?: Record<string, unknown>;
}

export interface VideoSubmitResult {
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | string;
  requestId?: string;
}

export interface VideoPollResult {
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
  videoUrl?: string;
  error?: string;
  submitTime?: string;
  scheduledTime?: string;
  endTime?: string;
}

export interface AlibabaHealthResult {
  online: boolean;
  isConfigured: boolean;
  baseUrl: string;
  version?: string;
  uptimeSeconds?: number;
  error?: string;
}

/**
 * Check if the local Alibaba proxy is reachable and healthy
 */
export async function checkAlibabaProxyHealth(): Promise<AlibabaHealthResult> {
  const { baseUrl, apiKey } = getAlibabaProxyConfig();
  const isConfigured = Boolean(baseUrl && apiKey);
  // Strip /v1 to reach /health
  const hostUrl = baseUrl.replace(/\/v1\/?$/, "");
  try {
    const res = await fetch(`${hostUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { online: false, isConfigured, baseUrl, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return {
      online: true,
      isConfigured,
      baseUrl,
      version: data.proxy_version,
      uptimeSeconds: data.uptime_seconds,
    };
  } catch (err: any) {
    return {
      online: false,
      isConfigured,
      baseUrl,
      error: err?.message || "Alibaba Proxy nie je dostupné na " + baseUrl,
    };
  }
}

/**
 * Generate an image via Alibaba Proxy (Wanx 2.1 / Qwen 3 Pro)
 * POST /v1/images/generations
 */
export async function generateAlibabaImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { baseUrl, apiKey } = getAlibabaProxyConfig();
  const model = options.model || ALIBABA_DEFAULT_IMAGE_MODEL;

  const res = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      size: options.size || "1024*1024",
      n: options.n || 1,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const message =
      errorBody?.error?.message ||
      `Image generation failed with status ${res.status}`;
    throw new Error(message);
  }

  const json = await res.json();
  const first = json?.data?.[0];
  if (!first || (!first.url && !first.b64_json)) {
    throw new Error("No image data returned from Alibaba proxy");
  }

  return {
    url: first.url,
    b64_json: first.b64_json,
    created: json.created || Math.floor(Date.now() / 1000),
  };
}

/**
 * Submit an asynchronous video generation task via Alibaba Proxy (Wan 2.1 / Wan 30)
 * POST /v1/videos/generations
 */
export async function submitAlibabaVideo(
  options: VideoSubmitOptions
): Promise<VideoSubmitResult> {
  const { baseUrl, apiKey } = getAlibabaProxyConfig();
  const model = options.model || ALIBABA_DEFAULT_VIDEO_MODEL;

  const res = await fetch(`${baseUrl}/videos/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: { prompt: options.prompt },
      parameters: options.parameters,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const message =
      errorBody?.error?.message ||
      `Video submission failed with status ${res.status}`;
    throw new Error(message);
  }

  const json = await res.json();
  const taskId = json?.output?.task_id || json?.id;
  if (!taskId) {
    throw new Error("No task_id returned for video generation request");
  }

  return {
    taskId,
    status: json?.output?.task_status || "PENDING",
    requestId: json?.request_id,
  };
}

/**
 * Poll the status of an asynchronous video generation task
 * GET /v1/videos/generations/:taskId
 */
export async function pollAlibabaVideo(taskId: string): Promise<VideoPollResult> {
  const { baseUrl, apiKey } = getAlibabaProxyConfig();

  const res = await fetch(`${baseUrl}/videos/generations/${encodeURIComponent(taskId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const message =
      errorBody?.error?.message ||
      `Video polling failed with status ${res.status}`;
    throw new Error(message);
  }

  const json = await res.json();
  const output = json?.output;
  const status = output?.task_status || "UNKNOWN";
  const videoUrl = output?.video_url || output?.url;
  const error = output?.message || output?.error || (status === "FAILED" ? "Video generation failed" : undefined);

  return {
    taskId,
    status,
    videoUrl,
    error,
    submitTime: output?.submit_time,
    scheduledTime: output?.scheduled_time,
    endTime: output?.end_time,
  };
}

/**
 * Chat completion via Alibaba Proxy
 * POST /v1/chat/completions
 */
export async function generateAlibabaChat(options: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; model: string; usage?: { prompt_tokens: number; completion_tokens: number } }> {
  const { baseUrl, apiKey } = getAlibabaProxyConfig();
  const model = options.model || ALIBABA_DEFAULT_CHAT_MODEL;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const message =
      errorBody?.error?.message ||
      `Chat completion failed with status ${res.status}`;
    throw new Error(message);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content || "";

  return {
    content,
    model: json?.model || model,
    usage: json?.usage,
  };
}

/**
 * Build an AI SDK LanguageModel instance pointing to local AliProxy
 */
export function getAlibabaLanguageModel(modelId = ALIBABA_DEFAULT_CHAT_MODEL): LanguageModel {
  const { baseUrl, apiKey } = getAlibabaProxyConfig();
  const proxy = createOpenAICompatible({
    name: "aliproxy-local",
    baseURL: baseUrl,
    apiKey,
  });
  return proxy(modelId);
}
