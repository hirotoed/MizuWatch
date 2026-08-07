/* 
   ライブラリは以下のgithubより入手(v1.0.3aを使用)
   https://github.com/mikalhart/TinyGPSPlus/releases
   ======================
   接続
   RXD<->D11
   TXD<->D10
   5V<->5V
   GND<->GND
*/

#include <TinyGPS++.h>
#include <SoftwareSerial.h>

SoftwareSerial mygps(14, 15); // RX=14ピン, TX=15ピン
TinyGPSPlus gps;

int daysInMonth[12] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};

// 閏年かどうかを判定する関数
bool isLeapYear(int year) {
    return (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
}

void setup() {
    Serial.begin(9600);
    while (!Serial) {
        // シリアル通信の初期化が完了するまで待機
        ;
    }
    Serial.println("GPS Console Complete!");

    mygps.begin(9600);
    mygps.println("Hello World!");
}

void loop() {
    while (mygps.available()) {
        gps.encode(mygps.read()); // GPSから取得したデータをエンコード
    }

    //if (gps.location.isUpdated()) {
        // 時刻の修正（UTC -> JST）
        int year = gps.date.year();
        int month = gps.date.month();
        int day = gps.date.day();
        int hour = gps.time.hour() + 9;

        // 時刻が24を超える場合の処理
        if (hour >= 24) {
            hour -= 24;
            day += 1;
        }

        // 月の日数を考慮して日付を修正
        if (day > daysInMonth[month - 1]) {
            if (!(month == 2 && day == 29 && isLeapYear(year))) {
                day = 1;
                month += 1;
            }
        }

        // 月が12を超える場合の処理
        if (month > 12) {
            month = 1;
            year += 1;
        }

        // 年月日時分秒を表示
        Serial.print(year);
        Serial.print("/");
        Serial.print(month);
        Serial.print("/");
        Serial.print(day);
        Serial.print(" ");
        Serial.print(hour);
        Serial.print(":");
        Serial.print(gps.time.minute());
        Serial.print(":");
        Serial.println(gps.time.second());

        // 緯度経度を表示
        Serial.print(gps.location.lat(), 6);
        Serial.print(",");
        Serial.println(gps.location.lng(), 6);

        // 高度を表示
        Serial.print("Altitude: ");
        Serial.println(gps.altitude.meters());

        // 速度を表示
        Serial.print("Speed: ");
        Serial.println(gps.speed.kmph());

        // 受信している衛星の数を表示
        Serial.print("Satellites: ");
        Serial.println(gps.satellites.value());

        Serial.println("===============");
    //}
    delay(1000);
}
