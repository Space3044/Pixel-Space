import { serverError } from './http';

type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

interface LogFields {
  status?: number;
  durationMs?: number;
  error?: unknown;
  context?: LogContext;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  route: string;
  method: string;
  requestId: string;
  status: number | null;
  durationMs: number | null;
  error: SerializedError | null;
  context: unknown;
}

export interface SerializedError {
  name: string;
  message: string;
  stack: string | null;
}

export interface RequestLogger {
  requestId: string;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

type LoggedPagesHandler<
  Env,
  Params extends string = string,
  Data extends Record<string, unknown> = Record<string, unknown>,
> = (
  context: EventContext<Env, Params, Data>,
  logger: RequestLogger,
) => Response | Promise<Response>;

const REDACTED = '[redacted]';
const SENSITIVE_KEY_PATTERN = /(authorization|cookie|jwt|password|secret|token|api[_-]?key|proxy[_-]?key)/i;

const requestIdFromRequest = (request: Request): string =>
  request.headers.get('x-request-id') ??
  request.headers.get('cf-ray') ??
  crypto.randomUUID();

export const serializeError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'unknown_error',
      stack: error.stack ?? null,
    };
  }

  return {
    name: 'Error',
    message: typeof error === 'string' && error.trim() ? error : String(error),
    stack: null,
  };
};

const sanitizeLogValue = (value: unknown, key = ''): unknown => {
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (value === null || value === undefined) return value;
  if (value instanceof Error) return serializeError(value);
  if (value instanceof Request || value instanceof Response || value instanceof Headers) {
    return `[${value.constructor.name}]`;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeLogValue(item));
  if (typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeLogValue(entryValue, entryKey),
    ]),
  );
};

const writeLog = (entry: LogEntry): void => {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(line);
    return;
  }
  if (entry.level === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
};

export const createRequestLogger = (request: Request, route: string): RequestLogger => {
  const requestId = requestIdFromRequest(request);
  const base = {
    route,
    method: request.method,
    requestId,
  };

  const log = (level: LogLevel, message: string, fields: LogFields = {}): void => {
    writeLog({
      level,
      message,
      ...base,
      status: fields.status ?? null,
      durationMs: fields.durationMs ?? null,
      error: fields.error === undefined ? null : serializeError(fields.error),
      context: fields.context === undefined ? null : sanitizeLogValue(fields.context),
    });
  };

  return {
    requestId,
    info: (message, fields) => log('info', message, fields),
    warn: (message, fields) => log('warn', message, fields),
    error: (message, fields) => log('error', message, fields),
  };
};

export const withRequestLogging =
  <
    Env,
    Params extends string = string,
    Data extends Record<string, unknown> = Record<string, unknown>,
  >(
    route: string,
    handler: LoggedPagesHandler<Env, Params, Data>,
  ): PagesFunction<Env, Params, Data> =>
  async (context) => {
    const logger = createRequestLogger(context.request, route);
    const startedAt = Date.now();

    try {
      const response = await handler(context, logger);
      const fields = {
        status: response.status,
        durationMs: Date.now() - startedAt,
      };
      if (response.status >= 500) {
        logger.error('request completed', fields);
      } else {
        logger.info('request completed', fields);
      }
      return response;
    } catch (error) {
      logger.error('request failed', {
        status: 500,
        durationMs: Date.now() - startedAt,
        error,
      });
      return serverError();
    }
  };
