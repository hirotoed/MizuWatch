export interface DeviceCredentialCandidate {
  credential_id: string;
  device_id: string;
  token_hash_hex: string;
  vehicle_code: string;
  device_created_at: string;
}

export interface ValidTelemetryReading {
  message_id: string;
  observed_at: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  satellites?: number;
  water_temperature: number;
  air_pressure: number;
  air_temperature: number;
  humidity?: number;
  battery_voltage?: number;
}

export interface ReadingValidationError {
  index: number;
  messageId?: string;
  reasons: string[];
}

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC_3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredNumber(
  value: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  reasons: string[],
): number | undefined {
  const candidate = value[key];
  if (
    typeof candidate !== "number" || !Number.isFinite(candidate) ||
    candidate < min || candidate > max
  ) {
    reasons.push(`${key} must be a finite number between ${min} and ${max}`);
    return undefined;
  }
  return candidate;
}

function optionalNumber(
  value: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  reasons: string[],
  integer = false,
): number | undefined {
  if (!(key in value)) return undefined;
  const candidate = value[key];
  if (
    typeof candidate !== "number" ||
    !Number.isFinite(candidate) ||
    candidate < min ||
    candidate > max ||
    (integer && !Number.isInteger(candidate))
  ) {
    reasons.push(
      `${key} must be ${
        integer ? "an integer" : "a finite number"
      } between ${min} and ${max}`,
    );
    return undefined;
  }
  return candidate;
}

export function isUuidV7(value: unknown): value is string {
  return typeof value === "string" && UUID_V7.test(value);
}

export function validateTelemetryReading(
  value: unknown,
  index: number,
  deviceCreatedAt: Date,
  now = new Date(),
): { reading?: ValidTelemetryReading; error?: ReadingValidationError } {
  if (!isRecord(value)) {
    return { error: { index, reasons: ["reading must be an object"] } };
  }

  const reasons: string[] = [];
  const messageId = value.messageId;
  if (!isUuidV7(messageId)) reasons.push("messageId must be a UUID v7");

  const observedAt = value.observedAt;
  const observedDate =
    typeof observedAt === "string" && RFC_3339.test(observedAt)
      ? new Date(observedAt)
      : new Date(Number.NaN);
  if (
    !(typeof observedAt === "string") || Number.isNaN(observedDate.getTime())
  ) {
    reasons.push("observedAt must be an RFC 3339 timestamp");
  } else if (observedDate < deviceCreatedAt) {
    reasons.push("observedAt is before the device registration time");
  } else if (observedDate.getTime() > now.getTime() + 5 * 60_000) {
    reasons.push("observedAt is more than five minutes in the future");
  }

  const latitude = requiredNumber(value, "latitude", -90, 90, reasons);
  const longitude = requiredNumber(value, "longitude", -180, 180, reasons);
  const waterTemperature = requiredNumber(
    value,
    "waterTemperature",
    -10,
    80,
    reasons,
  );
  const airPressure = requiredNumber(value, "airPressure", 300, 1200, reasons);
  const airTemperature = requiredNumber(
    value,
    "airTemperature",
    -60,
    80,
    reasons,
  );
  const altitude = optionalNumber(value, "altitude", -500, 10_000, reasons);
  const satellites = optionalNumber(value, "satellites", 0, 100, reasons, true);
  const humidity = optionalNumber(value, "humidity", 0, 100, reasons);
  const batteryVoltage = optionalNumber(
    value,
    "batteryVoltage",
    0,
    20,
    reasons,
  );

  if (reasons.length > 0) {
    return {
      error: {
        index,
        ...(typeof messageId === "string" ? { messageId } : {}),
        reasons,
      },
    };
  }

  return {
    reading: {
      message_id: messageId as string,
      observed_at: observedDate.toISOString(),
      latitude: latitude as number,
      longitude: longitude as number,
      ...(altitude === undefined ? {} : { altitude }),
      ...(satellites === undefined ? {} : { satellites }),
      water_temperature: waterTemperature as number,
      air_pressure: airPressure as number,
      air_temperature: airTemperature as number,
      ...(humidity === undefined ? {} : { humidity }),
      ...(batteryVoltage === undefined
        ? {}
        : { battery_voltage: batteryVoltage }),
    },
  };
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function constantTimeHexEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
