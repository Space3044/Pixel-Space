import type { Env } from '../../types';
import { badRequest, json, serverError, unauthorized } from '../../_shared/http';
import type { AiSettings } from '../../_shared/ai';
import { getAiSettings } from '../../_shared/ai';
import { resolveAdmin } from '../../_shared/auth';

const UPSERT_SQL = `
INSERT INTO ai_settings (id, proxy_url, model, prompt, updated_at)
VALUES (1, ?, ?, ?, datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  proxy_url = excluded.proxy_url,
  model = excluded.model,
  prompt = excluded.prompt,
  updated_at = datetime('now')
`;

const stringOrEmpty = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const payloadFromRequest = async (request: Request): Promise<AiSettings | null> => {
  try {
    const data = (await request.json()) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const raw = data as Record<string, unknown>;
    return {
      proxy_url: stringOrEmpty(raw.proxy_url),
      model: stringOrEmpty(raw.model),
      prompt: stringOrEmpty(raw.prompt),
    };
  } catch {
    return null;
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  try {
    return json(await getAiSettings(env));
  } catch (error) {
    console.error('GET /api/admin/ai-settings failed', error);
    return serverError('ai_settings_failed');
  }
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const payload = await payloadFromRequest(request);
  if (!payload) return badRequest('invalid_ai_settings_payload');

  try {
    await env.DB.prepare(UPSERT_SQL).bind(payload.proxy_url, payload.model, payload.prompt).run();
    return json(payload);
  } catch (error) {
    console.error('PATCH /api/admin/ai-settings failed', error);
    return serverError('ai_settings_update_failed');
  }
};
