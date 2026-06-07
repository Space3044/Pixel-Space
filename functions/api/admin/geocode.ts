import type { Env } from '../../types';
import { withRequestLogging } from '../../_shared/logger';
import { handleGeocodeGet } from '../geocode';

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/geocode', handleGeocodeGet);
