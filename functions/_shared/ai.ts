import type { Env } from '../types';

export interface AiSettings {
  proxy_url: string;
  model: string;
  prompt: string;
}

export interface AiPreviewResult {
  title: string;
  caption: string;
  tags: string[];
  search_content: string;
  dominant_color: string;
  palette: string[];
  composition: string;
}

interface AnalyzeImageInput {
  env: Env;
  image: File;
}

const SETTINGS_SQL = 'SELECT * FROM ai_settings WHERE id = 1';

const AI_USER_PROMPT = '请分析这张图片，直接输出符合上述 Schema 的 JSON 对象。';
const AI_PROXY_ATTEMPTS = 3;
const DEFAULT_AI_RETRY_DELAY_MS = 1000;
const RETRYABLE_AI_PROXY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

interface AiProxyRetryBody {
  parameters?: {
    retry_after?: number;
  };
}

export const getAiSettings = async (env: Pick<Env, 'DB'>): Promise<AiSettings> => {
  const row = await env.DB.prepare(SETTINGS_SQL).first<Partial<AiSettings>>();
  return {
    proxy_url: row?.proxy_url?.trim() ?? '',
    model: row?.model?.trim() ?? '',
    prompt: row?.prompt?.trim() ?? '',
  };
};

export const hasUsableAiSettings = (settings: AiSettings, proxyKey: string | undefined): boolean =>
  Boolean(settings.proxy_url && settings.model && settings.prompt && proxyKey?.trim());

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const retryAfterFromBody = (bodyText: string): number | null => {
  try {
    const data = JSON.parse(bodyText) as AiProxyRetryBody;
    const retryAfter = data.parameters?.retry_after;
    if (typeof retryAfter !== 'number' || !Number.isFinite(retryAfter) || retryAfter < 0) return null;
    return retryAfter * 1000;
  } catch {
    return null;
  }
};

const retryAfterFromHeader = (value: string | null): number | null => {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return null;
};

const retryDelayMs = (response: Response, bodyText: string): number =>
  retryAfterFromHeader(response.headers.get('Retry-After'))
  ?? retryAfterFromBody(bodyText)
  ?? DEFAULT_AI_RETRY_DELAY_MS;

const isRetryableAiProxyResponse = (response: Response): boolean =>
  RETRYABLE_AI_PROXY_STATUSES.has(response.status);

const fetchAiProxy = async (settings: AiSettings, proxyKey: string, body: string): Promise<Response> => {
  for (let attempt = 1; attempt <= AI_PROXY_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(settings.proxy_url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${proxyKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch (error) {
      if (attempt < AI_PROXY_ATTEMPTS) {
        await delay(DEFAULT_AI_RETRY_DELAY_MS);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message || 'ai_proxy_fetch_failed');
    }

    if (!response.ok) {
      const text = (await response.text()).trim();
      if (isRetryableAiProxyResponse(response) && attempt < AI_PROXY_ATTEMPTS) {
        await delay(retryDelayMs(response, text));
        continue;
      }
      throw new Error(text || `ai_proxy_http_${response.status}`);
    }

    return response;
  }

  throw new Error('ai_proxy_failed');
};

const contentToJsonText = (content: unknown): string => {
  if (typeof content !== 'string') throw new Error('ai_response_missing_content');
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
};

const stringValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeTags = (value: unknown): string[] => {
  const tags = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : typeof value === 'string'
      ? value
          .split(/[,，\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  return [...new Set(tags)];
};

const normalizePalette = (value: unknown): string[] => {
  const colors = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : typeof value === 'string'
      ? value
          .split(/[,，\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  return [...new Set(colors)];
};

const normalizeAiResult = (value: unknown): AiPreviewResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ai_response_invalid_json');
  }

  const data = value as Record<string, unknown>;
  const title = stringValue(data.title);
  const caption = stringValue(data.caption);
  const tags = normalizeTags(data.tags);
  const searchContent =
    stringValue(data.search_content) || [title, caption, ...tags].filter(Boolean).join(' ');
  const dominantColor = stringValue(data.dominant_color);
  const palette = normalizePalette(data.palette);
  const composition = stringValue(data.composition);

  return {
    title,
    caption,
    tags,
    search_content: searchContent,
    dominant_color: dominantColor,
    palette,
    composition,
  };
};

const parseAiContent = (content: unknown): AiPreviewResult => {
  const jsonText = contentToJsonText(content);
  return normalizeAiResult(JSON.parse(jsonText) as unknown);
};

export const analyzeImageWithAi = async ({ env, image }: AnalyzeImageInput): Promise<AiPreviewResult> => {
  const settings = await getAiSettings(env);
  const proxyKey = env.PROXY_KEY?.trim();
  if (!hasUsableAiSettings(settings, env.PROXY_KEY) || !proxyKey) {
    throw new Error('missing_ai_settings');
  }

  const dataUrl = `data:${image.type};base64,${arrayBufferToBase64(await image.arrayBuffer())}`;
  const response = await fetchAiProxy(settings, proxyKey, JSON.stringify({
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: settings.prompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: AI_USER_PROMPT,
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
  }));

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  return parseAiContent(data.choices?.[0]?.message?.content);
};
