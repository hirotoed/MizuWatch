const VEHICLE_HEADERS = [
  "Timestamp",
  "Vehicle ID",
  "Latitude",
  "Longitude",
  "Altitude",
  "GPS Satellites",
  "Water Temperature",
  "Air Pressure",
  "Air Temperature",
  "Humidity",
];

// WebAppのメインエントリーポイント（GET リクエスト処理）
function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : null;

    switch (action) {
      case "getAllVehicles":
        return getAllVehiclesData();

      case "getVehicle":
        const vehicleId = e.parameter.vehicleId;
        if (!vehicleId) {
          throw new Error("Vehicle ID is required");
        }
        return getVehicleData(vehicleId);

      case "getVehicleList":
        return getVehicleList();

      default:
        return createErrorResponse("Invalid action");
    }
  } catch (error) {
    Logger.log("doGet Error: " + error.toString());
    return createErrorResponse(error.toString());
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("POST body is required");
    }

    // POSTデータを取得
    const data = JSON.parse(e.postData.contents);

    // INGEST_TOKENが設定されている場合のみ書き込み認証を有効化
    const expectedToken = PropertiesService.getScriptProperties().getProperty("INGEST_TOKEN");
    if (expectedToken && data.ingest_token !== expectedToken) {
      return createErrorResponse("Unauthorized");
    }

    // スプレッドシートにデータを保存
    const result = saveToSpreadsheet(data);

    // レスポンスを返す
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        message: "Data saved successfully",
        rowNumber: result.row,
        sheetName: result.sheetName,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("Error: " + error.toString());

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function saveToSpreadsheet(data) {
  try {
    // スプレッドシートから開いた場合はgetActiveSpreadsheet()を使用
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const vehicleId = String(data.vehicle_id || "").trim();
    if (!/^[A-Za-z0-9_-]+$/.test(vehicleId)) {
      throw new Error("A valid vehicle_id is required");
    }
    if (!data.gps || !data.sensors) {
      throw new Error("gps and sensors are required");
    }

    // 端末に時計がない場合は、GASで受信した時刻を使用する
    const timestamp = data.timestamp || new Date().toISOString();

    // vehicle_idに基づいてシート名を決定
    const sheetName = `Vehicle_${vehicleId}`;

    // シートを取得または作成
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = createNewSheet(spreadsheet, sheetName);
    } else {
      ensureSheetSchema(sheet);
    }

    // データを行に変換
    const rowData = [
      timestamp,
      vehicleId,
      data.gps.latitude,
      data.gps.longitude,
      data.gps.altitude,
      data.gps.satellites,
      data.sensors.water_temperature,
      data.sensors.air_pressure,
      data.sensors.air_temperature,
      data.sensors.humidity ?? "",
    ];

    // データを追加
    sheet.appendRow(rowData);

    // 追加した行番号を取得
    const lastRow = sheet.getLastRow();

    Logger.log(`Data saved to sheet: ${sheetName}, row: ${lastRow}`);

    return {
      sheetName: sheetName,
      row: lastRow,
    };
  } catch (error) {
    Logger.log("Error in saveToSpreadsheet: " + error.toString());
    throw error;
  }
}

function createNewSheet(spreadsheet, sheetName) {
  // 新しいシートを作成
  const sheet = spreadsheet.insertSheet(sheetName);

  ensureSheetSchema(sheet);

  Logger.log(`New sheet created: ${sheetName}`);

  return sheet;
}

function ensureSheetSchema(sheet) {
  // ヘッダー行を設定
  sheet.getRange(1, 1, 1, VEHICLE_HEADERS.length).setValues([VEHICLE_HEADERS]);

  // ヘッダー行の書式設定
  const headerRange = sheet.getRange(1, 1, 1, VEHICLE_HEADERS.length);
  headerRange.setBackground("#4285f4");
  headerRange.setFontColor("white");
  headerRange.setFontWeight("bold");

  // 列幅を自動調整
  sheet.autoResizeColumns(1, VEHICLE_HEADERS.length);

  // フリーズヘッダー
  sheet.setFrozenRows(1);
}

// === WebApp API Functions ===

/**
 * 全車両データを取得
 */
function getAllVehiclesData() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = spreadsheet.getSheets();
    const vehicles = [];

    // 各シートを処理（Vehicle_で始まるシートのみ）
    sheets.forEach((sheet) => {
      const sheetName = sheet.getName();
      if (sheetName.startsWith("Vehicle_")) {
        const vehicleId = sheetName.replace("Vehicle_", "");
        const vehicleData = getVehicleDataFromSheet(sheet);

        if (vehicleData.length > 0) {
          vehicles.push({
            vehicleId: vehicleId,
            data: vehicleData,
          });
        }
      }
    });

    return createSuccessResponse({
      vehicles: vehicles,
      totalVehicles: vehicles.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.log("getAllVehiclesData Error: " + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * 特定車両のデータを取得
 */
function getVehicleData(vehicleId) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = `Vehicle_${vehicleId}`;
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    const vehicleData = getVehicleDataFromSheet(sheet);

    return createSuccessResponse({
      vehicleId: vehicleId,
      data: vehicleData,
      dataCount: vehicleData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.log("getVehicleData Error: " + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * 車両リストを取得
 */
function getVehicleList() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = spreadsheet.getSheets();
    const vehicleList = [];

    sheets.forEach((sheet) => {
      const sheetName = sheet.getName();
      if (sheetName.startsWith("Vehicle_")) {
        const vehicleId = sheetName.replace("Vehicle_", "");
        const lastRow = sheet.getLastRow();
        const dataCount = lastRow > 1 ? lastRow - 1 : 0; // ヘッダー行を除く

        vehicleList.push({
          vehicleId: vehicleId,
          sheetName: sheetName,
          dataCount: dataCount,
          lastUpdate: dataCount > 0 ? getLastUpdateTime(sheet) : null,
        });
      }
    });

    return createSuccessResponse({
      vehicles: vehicleList,
      totalVehicles: vehicleList.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.log("getVehicleList Error: " + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * シートから車両データを取得
 */
function getVehicleDataFromSheet(sheet) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return []; // ヘッダーのみまたは空のシート
    }

    // データ範囲を取得（ヘッダー行を除く）
    const dataRange = sheet.getRange(2, 1, lastRow - 1, VEHICLE_HEADERS.length);
    const values = dataRange.getValues();

    const vehicleData = [];

    values.forEach((row) => {
      // 空の行をスキップ
      if (row[0] && row[1]) {
        const dataPoint = {
          timestamp: formatTimestamp(row[0]),
          vehicleId: row[1],
          latitude: parseFloat(row[2]) || 0,
          longitude: parseFloat(row[3]) || 0,
          altitude: parseFloat(row[4]) || 0,
          satellites: parseInt(row[5]) || 0,
          waterTemperature: parseFloat(row[6]) || 0,
          airPressure: parseFloat(row[7]) || 0,
          airTemperature: parseFloat(row[8]) || 0,
        };

        const humidity = parseFloat(row[9]);
        if (!isNaN(humidity)) {
          dataPoint.humidity = humidity;
        }

        vehicleData.push(dataPoint);
      }
    });

    // 時系列でソート
    vehicleData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return vehicleData;
  } catch (error) {
    Logger.log("getVehicleDataFromSheet Error: " + error.toString());
    throw error;
  }
}

/**
 * 最終更新時刻を取得
 */
function getLastUpdateTime(sheet) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return null;
    }

    const timestampCell = sheet.getRange(lastRow, 1);
    const timestamp = timestampCell.getValue();

    return formatTimestamp(timestamp);
  } catch (error) {
    Logger.log("getLastUpdateTime Error: " + error.toString());
    return null;
  }
}

/**
 * タイムスタンプのフォーマット
 */
function formatTimestamp(timestamp) {
  try {
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    } else if (typeof timestamp === "string") {
      // 既にISO形式の場合はそのまま返す
      if (timestamp.includes("T") && timestamp.includes("Z")) {
        return timestamp;
      }
      // 日付文字列の場合はDateオブジェクトに変換
      const date = new Date(timestamp);
      return date.toISOString();
    } else {
      // その他の場合は現在時刻を返す
      return new Date().toISOString();
    }
  } catch (error) {
    Logger.log("formatTimestamp Error: " + error.toString());
    return new Date().toISOString();
  }
}

/**
 * 成功レスポンスを作成
 */
function createSuccessResponse(data) {
  const response = {
    status: "success",
    ...data,
  };

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * エラーレスポンスを作成
 */
function createErrorResponse(message) {
  const response = {
    status: "error",
    message: message,
    timestamp: new Date().toISOString(),
  };

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// === Legacy data migration ===

/**
 * Script Propertiesに設定された旧GAS URLから、2台分の履歴を安全に移行します。
 * 必須プロパティ: LEGACY_DRONE_001_URL, LEGACY_DRONE_002_URL
 * 同じ車両ID・タイムスタンプの行は再実行時に追加しません。
 */
function migrateLegacyData() {
  const properties = PropertiesService.getScriptProperties();
  const sources = [
    { vehicleId: "DRONE_001", url: properties.getProperty("LEGACY_DRONE_001_URL") },
    { vehicleId: "DRONE_002", url: properties.getProperty("LEGACY_DRONE_002_URL") },
  ];
  const missingProperties = sources
    .filter((source) => !source.url)
    .map((source) => `LEGACY_${source.vehicleId}_URL`);

  if (missingProperties.length > 0) {
    throw new Error(`Missing Script Properties: ${missingProperties.join(", ")}`);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const summary = sources.map((source) =>
    migrateLegacySource(spreadsheet, source.vehicleId, source.url)
  );

  Logger.log("Migration summary: " + JSON.stringify(summary));
  return summary;
}

function migrateLegacySource(spreadsheet, vehicleId, endpoint) {
  const separator = endpoint.includes("?") ? "&" : "?";
  const response = UrlFetchApp.fetch(`${endpoint}${separator}action=getData`, {
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`${vehicleId}: legacy API returned HTTP ${response.getResponseCode()}`);
  }

  const legacyData = JSON.parse(response.getContentText());
  if (!Array.isArray(legacyData)) {
    throw new Error(`${vehicleId}: legacy API did not return an array`);
  }

  const sheetName = `Vehicle_${vehicleId}`;
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = createNewSheet(spreadsheet, sheetName);
  } else {
    ensureSheetSchema(sheet);
  }

  const existingTimestamps = new Set();
  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getValues()
      .forEach((row) => existingTimestamps.add(formatTimestamp(row[0])));
  }

  const rowsToAppend = [];
  let skippedInvalid = 0;
  let skippedDuplicate = 0;

  legacyData.forEach((item) => {
    const latitude = parseFloat(item.Lat);
    const longitude = parseFloat(item.Lng);
    const hasValidCoordinates =
      isFinite(latitude) &&
      isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !(latitude === 0 && longitude === 0);

    if (!hasValidCoordinates) {
      skippedInvalid++;
      return;
    }

    const timestamp = formatTimestamp(item.time);
    if (existingTimestamps.has(timestamp)) {
      skippedDuplicate++;
      return;
    }

    rowsToAppend.push([
      timestamp,
      vehicleId,
      latitude,
      longitude,
      "",
      "",
      numberOrBlank(item.wtmp ?? item.waterTemp),
      numberOrBlank(item.prs),
      numberOrBlank(item.tmp),
      numberOrBlank(item.hum),
    ]);
    existingTimestamps.add(timestamp);
  });

  if (rowsToAppend.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, VEHICLE_HEADERS.length)
      .setValues(rowsToAppend);
  }

  return {
    vehicleId: vehicleId,
    fetched: legacyData.length,
    added: rowsToAppend.length,
    skippedInvalid: skippedInvalid,
    skippedDuplicate: skippedDuplicate,
  };
}

function numberOrBlank(value) {
  const parsed = parseFloat(value);
  return isFinite(parsed) ? parsed : "";
}

// === Test Functions ===

/**
 * テスト用関数（手動実行用）
 */
function testFunction() {
  const testData = {
    timestamp: "2025-06-15T10:30:00.000Z",
    vehicle_id: "DRONE_001",
    gps: {
      latitude: 35.6993556342842,
      longitude: 139.76980698942927,
      altitude: 120.5,
      satellites: 8,
    },
    sensors: {
      water_temperature: 18.5,
      air_pressure: 1013.25,
      air_temperature: 22.3,
      humidity: 55.0,
    },
  };

  const result = saveToSpreadsheet(testData);
  Logger.log("Test result: " + JSON.stringify(result));
}

/**
 * WebApp APIのテスト用関数
 */
function testWebAppAPI() {
  try {
    console.log("=== WebApp API Test ===");

    // 全車両データ取得のテスト
    console.log("Testing getAllVehiclesData...");
    const allVehiclesResult = getAllVehiclesData();
    const allVehiclesData = JSON.parse(allVehiclesResult.getContent());
    console.log("All vehicles result:", allVehiclesData);

    // 車両リスト取得のテスト
    console.log("Testing getVehicleList...");
    const vehicleListResult = getVehicleList();
    const vehicleListData = JSON.parse(vehicleListResult.getContent());
    console.log("Vehicle list result:", vehicleListData);

    // 特定車両データ取得のテスト
    if (
      allVehiclesData.status === "success" &&
      allVehiclesData.vehicles.length > 0
    ) {
      const firstVehicleId = allVehiclesData.vehicles[0].vehicleId;
      console.log(`Testing getVehicleData for ${firstVehicleId}...`);
      const vehicleResult = getVehicleData(firstVehicleId);
      const vehicleData = JSON.parse(vehicleResult.getContent());
      console.log("Single vehicle result:", vehicleData);
    }

    console.log("=== Test Completed ===");
  } catch (error) {
    console.error("Test Error:", error.toString());
  }
}
