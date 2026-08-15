#include <TinyGPS++.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <DallasTemperature.h>
#include <OneWire.h>
#include <WiFi.h>
#include <HTTPClient.h>

#include "arduino_secrets.h"
#include "google_root_ca.h"

const char* VEHICLE_ID = "DRONE_003";
const unsigned long SEND_INTERVAL_MS = 60000;

TinyGPSPlus gps;
Adafruit_BME280 bme;

#define ONE_WIRE_BUS 12
#define SENSOR_RESOLUTION_BITS 8

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature waterSensors(&oneWire);

float latitude = 0.0;
float longitude = 0.0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(MIZUWATCH_WIFI_SSID, MIZUWATCH_WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println(" connected");
}

String buildPayload(float waterTemperature, float airPressure,
                    float airTemperature, float humidity) {
  String payload = "{";
  payload += "\"vehicle_id\":\"" + String(VEHICLE_ID) + "\",";
  payload += "\"gps\":{";
  payload += "\"latitude\":" + String(latitude, 10) + ",";
  payload += "\"longitude\":" + String(longitude, 10) + ",";
  payload += "\"altitude\":" + String(gps.altitude.meters(), 2) + ",";
  payload += "\"satellites\":" + String(gps.satellites.value());
  payload += "},";
  payload += "\"sensors\":{";
  payload += "\"water_temperature\":" + String(waterTemperature, 2) + ",";
  payload += "\"air_pressure\":" + String(airPressure, 2) + ",";
  payload += "\"air_temperature\":" + String(airTemperature, 2) + ",";
  payload += "\"humidity\":" + String(humidity, 2);
  payload += "}}";
  return payload;
}

void sendToServer(float waterTemperature, float airPressure,
                  float airTemperature, float humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  HTTPClient https;
  https.setCACert(GOOGLE_ROOT_CA);

  if (!https.begin(MIZUWATCH_GAS_ENDPOINT)) {
    Serial.println("[HTTPS] Unable to connect");
    return;
  }

  https.addHeader("Content-Type", "application/json");
  const String payload = buildPayload(
      waterTemperature, airPressure, airTemperature, humidity);
  const int httpCode = https.POST(payload);

  if (httpCode > 0) {
    Serial.printf("[HTTPS] POST... code: %d\n", httpCode);
    Serial.println(https.getString());
  } else {
    Serial.printf("[HTTPS] POST failed: %s\n",
                  https.errorToString(httpCode).c_str());
  }

  https.end();
}

void setup() {
  Serial.begin(115200);
  Serial1.begin(9600);

  Wire.setSDA(16);
  Wire.setSCL(17);
  Wire.begin();

  if (!bme.begin(0x76)) {
    Serial.println("BME280 not found; check wiring");
    while (true) {
      delay(1000);
    }
  }

  waterSensors.begin();
  waterSensors.setResolution(SENSOR_RESOLUTION_BITS);
  connectWiFi();
}

void loop() {
  waterSensors.requestTemperatures();

  const float airTemperature = bme.readTemperature();
  const float humidity = bme.readHumidity();
  const float airPressure = bme.readPressure() / 100.0F;
  const float waterTemperature = waterSensors.getTempCByIndex(0);

  sendToServer(waterTemperature, airPressure, airTemperature, humidity);
  delay(SEND_INTERVAL_MS);
}

void loop1() {
  while (Serial1.available() > 0) {
    gps.encode(Serial1.read());
    if (gps.location.isUpdated()) {
      latitude = gps.location.lat();
      longitude = gps.location.lng();
    }
  }
}
