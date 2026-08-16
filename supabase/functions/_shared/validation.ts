export interface DeviceCredentialCandidate {
  credential_id: string;
  device_id: string;
  token_hash_hex: string;
  vehicle_code: string;
  device_created_at: string;
}

export type FixStatus = "valid" | "no_fix";
export type CommunicationStatus = "online" | "buffered" | "unknown";
export type MeasurementStatus = "ok" | "stabilizing" | "partial" | "sensor_error";

export interface ValidTelemetryReading {
  message_id: string;
  observed_at: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  satellites?: number;
  gnss_timestamp?: string;
  fix_status?: FixStatus;
  hdop?: number;
  water_temperature: number;
  ph?: number;
  ec?: number;
  air_pressure: number;
  air_temperature: number;
  humidity?: number;
  battery_voltage?: number;
  communication_status?: CommunicationStatus;
  water_temperature_sensor_id?: string;
  ph_sensor_id?: string;
  ec_sensor_id?: string;
  water_temperature_calibration_id?: string;
  ph_calibration_id?: string;
  ec_calibration_id?: string;
  measurement_status?: MeasurementStatus;
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

function optionalTimestamp(
  value: Record<string, unknown>,
  key: string,
  reasons: string[],
): string | undefined {
  if (!(key in value)) return undefined;
  const candidate = value[key];
  if (typeof candidate !== "string" || !RFC_3339.test(candidate)) {
    reasons.push(`${key} must be an RFC 3339 timestamp`);
    return undefined;
  }
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    reasons.push(`${key} must be a valid RFC 3339 timestamp`);
    return undefined;
  }
  return parsed.toISOString();
}

function optionalShortString(
  value: Record<string, unknown>,
  key: string,
  reasons: string[],
): string | undefined {
  if (!(key in value)) return undefined;
  const candidate = value[key];
  if (
    typeof candidate !== "string" || candidate.length < 1 ||
    candidate.length > 64
  ) {
    reasons.push(`${key} must be a string between 1 and 64 characters`);
    return undefined;
  }
  return candidate;
}

function optionalEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  reasons: string[],
): T | undefined {
  if (!(key in value)) return undefined;
  const candidate = value[key];
  if (typeof candidate !== "string" || !allowed.includes(candidate as T)) {
    reasons.push(`${key} must be one of: ${allowed.join(", ")}`);
    return undefined;
  }
  return candidate as T;
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

  const fixStatus = optionalEnum(
    value,
    "fixStatus",
    ["valid", "no_fix"] as const,
    reasons,
  );
  const latitude = optionalNumber(value, "latitude", -90, 90, reasons);
  const longitude = optionalNumber(value, "longitude", -180, 180, reasons);
  if ((latitude === undefined) !== (longitude === undefined)) {
    reasons.push("latitude and longitude must either both be present or both be omitted");
  }
  if (fixStatus === "valid" && (latitude === undefined || longitude === undefined)) {
    reasons.push("latitude and longitude are required when fixStatus is valid");
  }
  if (fixStatus === "no_fix" && (latitude !== undefined || longitude !== undefined)) {
    reasons.push("latitude and longitude must be omitted when fixStatus is no_fix");
  }
  if (fixStatus === undefined && (latitude === undefined || longitude === undefined)) {
    reasons.push("latitude and longitude are required when fixStatus is omitted");
  }

  const altitude = optionalNumber(value, "altitude", -500, 10_000, reasons);
  const satellites = optionalNumber(value, "satellites", 0, 100, reasons, true);
  const gnssTimestamp = optionalTimestamp(value, "gnssTimestamp", reasons);
  const hdop = optionalNumber(value, "hdop", 0, 99.99, reasons);

  const waterTemperature = requiredNumber(
    value,
    "waterTemperature",
    -10,
    80,
    reasons,
  );
  const ph = optionalNumber(value, "ph", 0, 14, reasons);
  const ec = optionalNumber(value, "ec", 1, 2000, reasons);
  const airPressure = requiredNumber(value, "airPressure", 300, 1200, reasons);
  const airTemperature = requiredNumber(
    value,
    "airTemperature",
    -60,
    80,
    reasons,
  );
  const humidity = optionalNumber(value, "humidity", 0, 100, reasons);
  const batteryVoltage = optionalNumber(
    value,
    "batteryVoltage",
    0,
    20,
    reasons,
  );

  const communicationStatus = optionalEnum(
    value,
    "communicationStatus",
    ["online", "buffered", "unknown"] as const,
    reasons,
  );
  const measurementStatus = optionalEnum(
    value,
    "measurementStatus",
    ["ok", "stabilizing", "partial", "sensor_error"] as const,
    reasons,
  );

  const waterTemperatureSensorId = optionalShortString(
    value,
    "waterTemperatureSensorId",
    reasons,
  );
  const phSensorId = optionalShortString(value, "phSensorId", reasons);
  const ecSensorId = optionalShortString(value, "ecSensorId", reasons);
  const waterTemperatureCalibrationId = optionalShortString(
    value,
    "waterTemperatureCalibrationId",
    reasons,
  );
  const phCalibrationId = optionalShortString(value, "phCalibrationId", reasons);
  const ecCalibrationId = optionalShortString(value, "ecCalibrationId", reasons);

  if ("qualityFlag" in value) {
    reasons.push("qualityFlag is server-managed and must not be sent by the device");
  }

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
      ...(latitude === undefined ? {} : { latitude }),
      ...(longitude === undefined ? {} : { longitude }),
      ...(altitude === undefined ? {} : { altitude }),
      ...(satellites === undefined ? {} : { satellites }),
      ...(gnssTimestamp === undefined ? {} : { gnss_timestamp: gnssTimestamp }),
      ...(fixStatus === undefined ? {} : { fix_status: fixStatus }),
      ...(hdop === undefined ? {} : { hdop }),
      water_temperature: waterTemperature as number,
      ...(ph === undefined ? {} : { ph }),
      ...(ec === undefined ? {} : { ec }),
      air_pressure: airPressure as number,
      air_temperature: airTemperature as number,
      ...(humidity === undefined ? {} : { humidity }),
      ...(batteryVoltage === undefined
        ? {}
        : { battery_voltage: batteryVoltage }),
      ...(communicationStatus === undefined
        ? {}
        : { communication_status: communicationStatus }),
      ...(waterTemperatureSensorId === undefined
        ? {}
        : { water_temperature_sensor_id: waterTemperatureSensorId }),
      ...(phSensorId === undefined ? {} : { ph_sensor_id: phSensorId }),
      ...(ecSensorId === undefined ? {} : { ec_sensor_id: ecSensorId }),
      ...(waterTemperatureCalibrationId === undefined
        ? {}
        : { water_temperature_calibration_id: waterTemperatureCalibrationId }),
      ...(phCalibrationId === undefined
        ? {}
        : { ph_calibration_id: phCalibrationId }),
      ...(ecCalibrationId === undefined
        ? {}
        : { ec_calibration_id: ecCalibrationId }),
      ...(measurementStatus === undefined
        ? {}
        : { measurement_status: measurementStatus }),
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
