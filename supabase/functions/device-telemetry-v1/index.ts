import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import {
  constantTimeHexEqual,
  type DeviceCredentialCandidate,
  isUuidV7,
  type ReadingValidationError,
  sha256Hex,
  validateTelemetryReading,
  type ValidTelemetryReading,
} from "../_shared/validation.ts";

const MAX_BODY_BYTES = 256 * 1024;
const MAX_READINGS = 200;

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Supabase service configuration is missing");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();

  if (request.method !== "POST") {
    return errorResponse(
      request,
      requestId,
      405,
      "METHOD_NOT_ALLOWED",
      "Only POST is supported",
      [],
      { Allow: "POST" },
    );
  }

  const token = bearerToken(request);
  if (!token || token.length < 32 || token.length > 256) {
    return errorResponse(
      request,
      requestId,
      401,
      "UNAUTHORIZED",
      "Device authentication failed",
    );
  }

  try {
    const supabase = adminClient();
    const tokenHash = await sha256Hex(token);
    const { data: candidates, error: credentialError } = await supabase.rpc(
      "get_active_device_credentials",
    );
    if (credentialError) throw credentialError;

    let credential: DeviceCredentialCandidate | undefined;
    for (const candidate of (candidates ?? []) as DeviceCredentialCandidate[]) {
      if (constantTimeHexEqual(tokenHash, candidate.token_hash_hex)) {
        credential = candidate;
      }
    }
    if (!credential) {
      return errorResponse(
        request,
        requestId,
        401,
        "UNAUTHORIZED",
        "Device authentication failed",
      );
    }

    const { data: rateLimit, error: rateLimitError } = await supabase.rpc(
      "claim_device_request_slot",
      {
        target_device_id: credential.device_id,
      },
    );
    if (rateLimitError) throw rateLimitError;
    if (!rateLimit?.allowed) {
      const retryAfter = String(rateLimit?.retryAfter ?? 60);
      return errorResponse(
        request,
        requestId,
        429,
        "RATE_LIMITED",
        "Device request rate exceeded",
        [],
        {
          "Retry-After": retryAfter,
        },
      );
    }

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return errorResponse(
        request,
        requestId,
        413,
        "PAYLOAD_TOO_LARGE",
        "Request body exceeds 256 KiB",
      );
    }
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
      return errorResponse(
        request,
        requestId,
        413,
        "PAYLOAD_TOO_LARGE",
        "Request body exceeds 256 KiB",
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return errorResponse(
        request,
        requestId,
        400,
        "INVALID_JSON",
        "Request body must be valid JSON",
      );
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return errorResponse(
        request,
        requestId,
        400,
        "INVALID_BATCH",
        "Request body must be an object",
      );
    }
    const batch = body as Record<string, unknown>;
    if (
      batch.schemaVersion !== 1 || !isUuidV7(batch.batchId) ||
      !Array.isArray(batch.readings)
    ) {
      return errorResponse(
        request,
        requestId,
        400,
        "INVALID_BATCH",
        "schemaVersion, UUID v7 batchId, and readings are required",
      );
    }
    if ("deviceId" in batch || "device_id" in batch) {
      return errorResponse(
        request,
        requestId,
        400,
        "DEVICE_ID_NOT_ALLOWED",
        "Device identity is determined by the token",
      );
    }
    if (batch.readings.length > MAX_READINGS) {
      return errorResponse(
        request,
        requestId,
        413,
        "BATCH_TOO_LARGE",
        "A batch may contain at most 200 readings",
      );
    }

    const validReadings: ValidTelemetryReading[] = [];
    const errors: ReadingValidationError[] = [];
    const deviceCreatedAt = new Date(credential.device_created_at);
    const now = new Date();
    batch.readings.forEach((reading, index) => {
      const result = validateTelemetryReading(
        reading,
        index,
        deviceCreatedAt,
        now,
      );
      if (result.reading) validReadings.push(result.reading);
      if (result.error) errors.push(result.error);
    });

    let accepted = 0;
    let duplicate = 0;
    if (validReadings.length > 0) {
      const { data: result, error: ingestError } = await supabase.rpc(
        "ingest_telemetry_batch",
        {
          target_device_id: credential.device_id,
          target_schema_version: 1,
          readings: validReadings,
        },
      );
      if (ingestError) throw ingestError;
      accepted = result.accepted;
      duplicate = result.duplicate;
    }

    const { error: usedError } = await supabase.rpc(
      "mark_device_credential_used",
      {
        target_credential_id: credential.credential_id,
      },
    );
    if (usedError) {
      console.warn(
        JSON.stringify({
          requestId,
          deviceId: credential.device_id,
          event: "credential_usage_update_failed",
        }),
      );
    }

    console.info(JSON.stringify({
      requestId,
      deviceId: credential.device_id,
      received: batch.readings.length,
      accepted,
      duplicate,
      rejected: errors.length,
      durationMs: Math.round(performance.now() - startedAt),
    }));

    return jsonResponse(request, {
      requestId,
      batchId: batch.batchId,
      accepted,
      duplicate,
      rejected: errors.length,
      errors,
    });
  } catch {
    console.error(
      JSON.stringify({
        requestId,
        event: "device_telemetry_failure",
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
    return errorResponse(
      request,
      requestId,
      500,
      "INTERNAL_ERROR",
      "Unexpected server error",
    );
  }
});
