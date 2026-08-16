export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
  requestId: string;
}

function allowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function isAllowedBrowserOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || allowedOrigins().has(origin);
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(request),
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function errorResponse(
  request: Request,
  requestId: string,
  status: number,
  code: string,
  message: string,
  details: unknown[] = [],
  extraHeaders: HeadersInit = {},
): Response {
  const body: ApiErrorBody = { error: { code, message, details }, requestId };
  return jsonResponse(request, body, status, extraHeaders);
}
