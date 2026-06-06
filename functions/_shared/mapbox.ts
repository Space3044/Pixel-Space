import type { Env } from '../types';

export type MapboxPublicTokenError = 'mapbox_public_token_missing' | 'mapbox_public_token_invalid';

export type MapboxPublicTokenResult =
  | { token: string }
  | { error: MapboxPublicTokenError };

export const readMapboxPublicToken = (
  env: Pick<Env, 'MAPBOX_PUBLIC_TOKEN'>,
): MapboxPublicTokenResult => {
  const token = env.MAPBOX_PUBLIC_TOKEN?.trim();
  if (!token) return { error: 'mapbox_public_token_missing' };
  if (!token.startsWith('pk.')) return { error: 'mapbox_public_token_invalid' };
  return { token };
};
