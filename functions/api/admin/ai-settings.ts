import type { Env } from '../../types';
import { badRequest, json, serverError, unauthorized } from '../../_shared/http';
import type { AiSettings } from '../../_shared/ai';
import { getAiSettings } from '../../_shared/ai';
import { resolveAdmin } from '../../_shared/auth';
import { withRequestLogging } from '../../_shared/logger';
import { parseJsonObject, stringOrEmpty } from '../../_shared/request';
import { requireSameOrigin } from '../../_shared/security';

const UPSERT_SQL = `
INSERT INTO ai_settings (id, proxy_url, model, prompt, updated_at)
VALUES (1, ?, ?, ?, datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  proxy_url = excluded.proxy_url,
  model = excluded.model,
  prompt = excluded.prompt,
  updated_at = datetime('now')
`;

const payloadFromRequest = async (request: Request): Promise<AiSettings | null> => {
  const raw = await parseJsonObject(request);
  if (!raw) return null;
  const payload = {
    proxy_url: stringOrEmpty(raw.proxy_url),
    model: stringOrEmpty(raw.model),
    prompt: stringOrEmpty(raw.prompt),
  };
  return payload.prompt ? payload : null;
};

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/ai-settings', async ({ env, request }, logger) => {
  if (!(await resolveAdmin(request, env))) return unauthorized();

  try {
    return json(await getAiSettings(env));
  } catch (error) {
    logger.error('GET /api/admin/ai-settings failed', { error });
    return serverError('ai_settings_failed');
  }
});

export const onRequestPatch: PagesFunction<Env> = withRequestLogging('/api/admin/ai-settings', async ({ request, env }, logger) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const payload = await payloadFromRequest(request);
  if (!payload) return badRequest('invalid_ai_settings_payload');

  try {
    await env.DB.prepare(UPSERT_SQL).bind(payload.proxy_url, payload.model, payload.prompt).run();
    return json(payload);
  } catch (error) {
    logger.error('PATCH /api/admin/ai-settings failed', { error });
    return serverError('ai_settings_update_failed');
  }
});
