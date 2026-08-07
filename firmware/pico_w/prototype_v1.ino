#include <WiFi.h>
#include <HTTPClient.h>
#include <DallasTemperature.h>
#include <OneWire.h>
#include <SPI.h>
#include <SD.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <string.h>

#ifndef STASSID
#define STASSID "Wi-FiのID"
#define STAPSK "パスワードを入力"
#endif

const char *ssid = STASSID;
const char *pass = STAPSK;

// WiFiとHTTPS認証用の証明書
const char *jigsaw_cert = R"EOF(
//WiFiとHTTPS認証用の証明書
)EOF";

WiFiMulti WiFiMulti;

// BME280
Adafruit_BME280 bme;

// SDカードモジュール
File myFile;
const int _MISO = 4;
const int _MOSI = 7;
const int _CS = 5;
const int _SCK = 6;

// 水温センサ
#define ONE_WIRE_BUS 12  //ここだけ正しい値に変更してね!!!
#define SENSOR_BIT 8
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// millis
unsigned long timeaaa;

void setup() {
  Serial.begin(115200);

  // WiFi設定
  WiFi.mode(WIFI_STA);
  WiFiMulti.addAP(ssid, pass);
  while (WiFiMulti.run() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("WiFi connected");

  // SDカードモジュール初期化
  Serial.print("Initializing SD card...");
  SPI.setRX(_MISO);
  SPI.setTX(_MOSI);
  SPI.setSCK(_SCK);
  if (!SD.begin(_CS)) {
    Serial.println("initialization failed!");
    return;
  }
  Serial.println("initialization done.");
  delay(100);

  // BME280センサーの初期化
  Wire.setSDA(16);
  Wire.setSCL(17);
  Wire.begin();
  if (!bme.begin(0x76)) {
    Serial.println("Could not find a valid BME280 sensor, check wiring!");
    while (1)
      ;  // Hung up!
  }
  delay(100);
}

void loop() {
  // timeaaa
  timeaaa = millis();

  // BME280のデータを取得
  float tmp = bme.readTemperature();        // C
  float hum = bme.readHumidity();           // %
  float prs = bme.readPressure() / 100.0F;  // hPa

  // 水温センサのデータを取得
  sensors.requestTemperatures();
  float wtmp = sensors.getTempCByIndex(0);
  // データをSDカードに書き込み
  myFile = SD.open("test.txt", FILE_WRITE);  // ファイルを開く、なければ作成
  if (myFile) {
    // SDに書き込み
    Serial.print(timeaaa);
    myFile.print(timeaaa);
    Serial.print(",TMP,");
    myFile.print(",TMP,");
    Serial.print(tmp);
    myFile.print(tmp);
    Serial.print(",HUM,");
    myFile.print(",HUM,");
    Serial.print(hum);
    myFile.print(hum);
    Serial.print(",PRS,");
    myFile.print(",PRS,");
    Serial.print(prs);
    myFile.print(prs);
    Serial.print(",WTMP,");
    myFile.print(",WTMP,");
    Serial.print(wtmp);
    myFile.print(wtmp);
    Serial.println("");
    myFile.println("");
    myFile.close();
  } else {
    Serial.println("error opening test.txt");
  }

  // HTTPSリクエストを送信
  String urlBase = "gasのURLを入力";
  String urlFinal = urlBase + "?tmp=" + String(tmp) + "&hum=" + String(hum) + "&prs=" + String(prs) + "&wtmp=" + String(wtmp);
  Serial.println(urlFinal);

  if (WiFiMulti.run() == WL_CONNECTED) {
    HTTPClient https;
    https.setCACert(jigsaw_cert);

    Serial.print("[HTTPS] begin...\n");
    if (https.begin(urlFinal)) {
      int httpCode = https.GET();
      if (httpCode > 0) {
        Serial.printf("[HTTPS] GET... code: %d\n", httpCode);
        if (httpCode == HTTP_CODE_OK) {
          String payload = https.getString();
          Serial.println(payload);
        }
      } else {
        Serial.printf("[HTTPS] GET... failed, error: %s\n", https.errorToString(httpCode).c_str());
      }
      https.end();
    } else {
      Serial.println("[HTTPS] Unable to connect");
    }
  }

  // 10秒待機
  delay(10000);
}
