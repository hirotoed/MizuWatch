import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import {
  corsHeaders,
  errorResponse,
  isAllowedBrowserOrigin,
  jsonResponse,
} from "../_shared/http.ts";

const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 10_000;
const PAGE_SIZE = 1_000;

interface DeviceRow {
  id: string;
  vehicle_code: string;
}

interface TelemetryRow {
  id: number;
  device_id: string;
  observed_at: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  satellites: number | null;
  water_temperature: number;
  air_pressure: number;
  air_temperature: number;
  humidity: number | null;
}

function publicConfiguration(): { url: string; publishableKey: string } {
  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("MIZUWATCH_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !publishableKey) {
    throw new Error("Supabase public configuration is missing");
  }
  return { url, publishableKey };
}

function userClient(request: Request) {
  const { url, publishableKey } = publicConfiguration();
  return createClient(url, publishableKey, {
    global: {
      headers: { Authorization: request.headers.get("authorization") ?? "" },
    },
    auth: { persistSession: false },
  });
}

function parseTimestamp(value: string | null, fallback: Date): Date | null {
  if (value === null) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();

  if (request.method === "OPTIONS") {
    if (!isAllowedBrowserOrigin(request)) {
      return errorResponse(
        request,
        requestId,
        403,
        "ORIGIN_NOT_ALLOWED",
        "Origin is not allowed",
      );
    }
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "GET") {
    return errorResponse(
      request,
      requestId,
      405,
      "METHOD_NOT_ALLOWED",
      "Only GET is supported",
      [],
      { Allow: "GET, OPTIONS" },
    );
  }
  if (!isAllowedBrowserOrigin(request)) {
    return errorResponse(
      request,
      requestId,
      403,
      "ORIGIN_NOT_ALLOWED",
      "Origin is not allowed",
    );
  }

  try {
    const authorization = request.headers.get("authorization");
    const apiKey = request.headers.get("apikey");
    if (
      !authorization?.match(/^Bearer\s+\S+$/i) ||
      apiKey !== publicConfiguration().publishableKey
    ) {
      return errorResponse(
        request,
        requestId,
        401,
        "UNAUTHORIZED",
        "A user access token and publishable key are required",
      );
    }

    const supabase = userClient(request);
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await supabase.auth.getUser(
      accessToken,
    );
    if (authError || !authData.user) {
      return errorResponse(
        request,
        requestId,
        401,
        "UNAUTHORIZED",
        "User authentication failed",
      );
    }

    const url = new URL(request.url);
    const now = new Date();
    const to = parseTimestamp(url.searchParams.get("to"), now);
    const from = parseTimestamp(
      url.searchParams.get("from"),
      new Date(now.getTime() - DEFAULT_RANGE_MS),
    );
    if (!from || !to || from >= to) {
      return errorResponse(
        request,
        requestId,
        400,
        "INVALID_RANGE",
        "from and to must define a valid RFC 3339 range",
      );
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      return errorResponse(
        request,
        requestId,
        422,
        "RANGE_TOO_LARGE",
        "The requested range may not exceed seven days",
      );
    }

    const requestedCodes = [
      ...new Set(url.searchParams.getAll("vehicleId").filter(Boolean)),
    ];
    let deviceQuery = supabase.from("devices").select("id, vehicle_code").eq(
      "is_active",
      true,
    ).order("vehicle_code");
    if (requestedCodes.length > 0) {
      deviceQuery = deviceQuery.in("vehicle_code", requestedCodes);
    }
    const { data: deviceData, error: deviceError } = await deviceQuery;
    if (deviceError) throw deviceError;
    const devices = (deviceData ?? []) as DeviceRow[];
    if (requestedCodes.length > 0 && devices.length !== requestedCodes.length) {
      return errorResponse(
        request,
        requestId,
        404,
        "VEHICLE_NOT_FOUND",
        "One or more vehicles were not found",
      );
    }

    const tracks: Record<string, unknown[]> = Object.fromEntries(
      devices.map((device) => [device.vehicle_code, []]),
    );
    if (devices.length === 0) {
      return jsonResponse(request, { data: tracks, requestId });
    }

    const codeByDeviceId = new Map(
      devices.map((device) => [device.id, device.vehicle_code]),
    );
    const rows: TelemetryRow[] = [];
    for (let offset = 0; offset <= MAX_ROWS; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("telemetry_readings")
        .select(
          "id, device_id, observed_at, latitude, longitude, altitude, satellites, water_temperature, air_pressure, air_temperature, humidity",
        )
        .in("device_id", devices.map((device) => device.id))
        .gte("observed_at", from.toISOString())
        .lte("observed_at", to.toISOString())
        .order("observed_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as TelemetryRow[];
      rows.push(...page);
      if (rows.length > MAX_ROWS) {
        return errorResponse(
          request,
          requestId,
          422,
          "RANGE_TOO_LARGE",
          "The requested range contains more than 10,000 readings",
        );
      }
      if (page.length < PAGE_SIZE) break;
    }

    for (const row of rows) {
      const vehicleCode = codeByDeviceId.get(row.device_id);
      if (!vehicleCode) continue;
      tracks[vehicleCode].push({
        timestamp: new Date(row.observed_at).toISOString(),
        vehicleId: vehicleCode,
        latitude: row.latitude,
        longitude: row.longitude,
        ...(row.altitude === null ? {} : { altitude: row.altitude }),
        ...(row.satellites === null ? {} : { satellites: row.satellites }),
        waterTemperature: row.water_temperature,
        airPressure: row.air_pressure,
        airTemperature: row.air_temperature,
        ...(row.humidity === null ? {} : { humidity: row.humidity }),
      });
    }

    console.info(JSON.stringify({
      requestId,
      userId: authData.user.id,
      vehicles: devices.length,
      rows: rows.length,
      durationMs: Math.round(performance.now() - startedAt),
    }));
    return jsonResponse(request, { data: tracks, requestId });
  } catch {
    console.error(
      JSON.stringify({
        requestId,
        event: "tracks_failure",
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
