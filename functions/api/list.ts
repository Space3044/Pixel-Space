import type { Env } from '../types';
import { handleListImages } from '../_shared/list-images';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) =>
  handleListImages(env, request, { admin: false, logPath: '/api/list' });
