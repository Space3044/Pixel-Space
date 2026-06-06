import type { Env } from '../../types';
import { analyzeImageWithAi } from '../../_shared/ai';
import { resolveAdmin } from '../../_shared/auth';
import { badRequest, json, serverError, unauthorized } from '../../_shared/http';
import { requireSameOrigin } from '../../_shared/security';

const fileFromForm = (formData: FormData, name: string): File | null => {
  const value = formData.get(name);
  return value && typeof value !== 'string' ? value : null;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!(await resolveAdmin(request, env))) return unauthorized();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest('invalid_form_data');
  }

  const image = fileFromForm(formData, 'image');
  if (!image) return badRequest('missing_image');
  if (!image.type.startsWith('image/')) return badRequest('invalid_image_mime');

  try {
    return json(await analyzeImageWithAi({ env, image }));
  } catch (error) {
    if (error instanceof Error && error.message === 'missing_ai_settings') {
      return badRequest('missing_ai_settings');
    }
    console.error('POST /api/ai/preview failed', error);
    return serverError('ai_preview_failed');
  }
};
