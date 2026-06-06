import type { Env } from '../../types';
import { responseWithAdminImageUrl } from '../../_shared/admin-response';
import { onRequestGet as checkHashGet } from '../check-hash';

export const onRequestGet: PagesFunction<Env> = async (context) =>
  responseWithAdminImageUrl(await checkHashGet(context));
