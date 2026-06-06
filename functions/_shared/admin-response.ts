import type { ImageRecord } from './images';
import { withAdminPublicUrl } from './images';

export const responseWithAdminImageUrl = async (response: Response): Promise<Response> => {
  if (!response.ok) return response;

  const data = (await response.json()) as ImageRecord;
  if (!data || typeof data !== 'object' || typeof data.key !== 'string') {
    return Response.json(data, { status: response.status, headers: response.headers });
  }

  return Response.json(withAdminPublicUrl(data), {
    status: response.status,
    headers: response.headers,
  });
};
