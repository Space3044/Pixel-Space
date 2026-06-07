import { json, serverError } from '../_shared/http';
import { withRequestLogging } from '../_shared/logger';
import type { Env } from '../types';

interface AmapConfigResponse {
  key: string;
  securityJsCode: string;
}

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/amap-config', async ({ env }) => {
  const key = env.AMAP_JS_KEY?.trim();
  if (!key) return serverError('amap_js_key_missing');

  const payload: AmapConfigResponse = {
    key,
    securityJsCode: env.AMAP_SECURITY_JS_CODE?.trim() ?? '',
  };

  return json(payload);
});
