// 阶段 5：所有接口共享的最小 JSON 响应工具。
// 暂时统一 no-store，等阶段 11 之后再针对稳定接口加 cache-control。

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

export function notFound(message = 'not_found'): Response {
  return json({ error: message }, 404);
}

export function badRequest(message = 'bad_request'): Response {
  return json({ error: message }, 400);
}

export function serverError(message = 'server_error'): Response {
  return json({ error: message }, 500);
}
