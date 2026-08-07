/******************************
 * 一台目用のグローバル変数
 ******************************/
let map;               // 一台目マップ
let markers = [];      // 一台目マーカー
let linePath = [];     // 一台目ポリライン用座標
let polyline;          // 一台目ポリライン
let infoWindow;        // 一台目InfoWindow

/******************************
 * 三台目用のグローバル変数
 ******************************/
let map2;
let markers2 = [];
let linePath2 = [];
let polyline2;
let infoWindow2;
/******************************
 * 二台目用のグローバル変数
 ******************************/
let map3;
let markers3 = [];
let linePath3 = [];
let polyline3;
let infoWindow3;

// ドローン追加関係
let droneCount = 1;
let droneListHTML = `<p>ドローン1 <span class="drone-menu" data-drone-id="1">⋮</span></p>`;

/****************************************
 * ページロード時のイベント設定
 ****************************************/
document.addEventListener('DOMContentLoaded', function () {
    // 1) 一台目表示
    document.getElementById('drone-button').addEventListener('click', function () {
        document.getElementById('initial-screen').style.display = 'none';
        document.getElementById('confirmation-screen').style.display = 'flex';
        initMap();      // 一台目マップ初期化
        fetchData();    // 一台目のデータを取得 & 表示
    });

    // 2) 二台目表示
    document.getElementById('drone-button2').addEventListener('click', function () {
        document.getElementById('initial-screen').style.display = 'none';
        document.getElementById('confirmation-screen2').style.display = 'flex';
        initMap2();     // 二台目マップ初期化
        fetchData2();   // 二台目のデータを取得 & 表示
    });

    // 3) 両方の表示 (例: 一台目だけ呼んでいるが、必要に応じ二台目も呼ぶ)
    document.getElementById('drone-button3').addEventListener('click', function () {
        document.getElementById('initial-screen').style.display = 'none';
        document.getElementById('confirmation-screen3').style.display = 'flex';
        initMap3();     // 両方のマップ初期化
        fetchData();    // 一台目のデータを取得 & 表示
        fetchData2();   // 二台目のデータを取得 & 表示
    });

    // 設定アイコン
    document.getElementById('settings-icon').addEventListener('click', function () {
        document.getElementById('settings-screen').style.display = 'block';
    });

    // 設定画面を閉じる
    document.getElementById('exit-button').addEventListener('click', function () {
        document.getElementById('settings-screen').style.display = 'none';
    });

    // ドローンの追加ボタン
    document.getElementById('add-drone-button').addEventListener('click', function () {
        document.getElementById('settings-details').innerHTML = `
          <h3>ドローンの追加</h3>
          <button id="add-new-drone" class="add-new-drone">新しいドローンを追加</button>
          <div id="drone-list">${droneListHTML}</div>
        `;
        document.getElementById('add-new-drone').addEventListener('click', function () {
            droneCount++;
            const newDroneHTML = `<p>ドローン${droneCount} <span class="drone-menu" data-drone-id="${droneCount}">⋮</span></p>`;
            droneListHTML += newDroneHTML;
            document.getElementById('drone-list').innerHTML = droneListHTML;
            setDroneMenuEvents();
        });
        setDroneMenuEvents();
    });
});

/****************************************
 * ドローンメニュー(⋮)クリック時の処理
 ****************************************/
function setDroneMenuEvents() {
    const droneMenus = document.querySelectorAll('.drone-menu');
    droneMenus.forEach(menu => {
        menu.addEventListener('click', function () {
            const droneId = this.getAttribute('data-drone-id');
            showPopup(droneId);
        });
    });
}

/****************************************
 * ポップアップを表示 & URL 入力
 ****************************************/
function showPopup(droneId) {
    const popupContent = `
        <h3>ドローン${droneId}のURLを入力してください</h3>
        <input type="text" id="urlInput" placeholder="URLを入力" />
        <button class="saveData" onclick="saveUrl()">保存</button>
      `;
    const popup = document.getElementById('popup');
    popup.innerHTML = popupContent;
    popup.style.display = 'block';
}

// URL保存 (localStorage)
function saveUrl() {
    const url = document.getElementById('urlInput').value;
    localStorage.setItem('saveURL', url);
    document.getElementById('popup').style.display = 'none';
}

/****************************************
 * 一台目の地図を初期化
 ****************************************/
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 35.21, lng: 135.23 },
        zoom: 8
    });
    polyline = new google.maps.Polyline({
        path: linePath,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map
    });
    infoWindow = new google.maps.InfoWindow();
}

/****************************************
 * 二台目の地図を初期化
 ****************************************/
function initMap2() {
    map2 = new google.maps.Map(document.getElementById('map2'), {
        center: { lat: 35.21, lng: 135.23 },
        zoom: 8
    });
    polyline2 = new google.maps.Polyline({
        path: linePath2,
        geodesic: true,
        strokeColor: '#0000FF', // 二台目は青線にしてみる例
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map2
    });
    infoWindow2 = new google.maps.InfoWindow();
}
/****************************************
 * 両方表示の地図を初期化
 ****************************************/
function initMap3() {
    map3 = new google.maps.Map(document.getElementById('map3'), {
        center: { lat: 33.6, lng: 130.523 },
        zoom: 10
    });
    polyline = new google.maps.Polyline({
        path: linePath,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map3
    });
    infoWindow = new google.maps.InfoWindow();
    polyline2 = new google.maps.Polyline({
        path: linePath2,
        geodesic: true,
        strokeColor: '#0000FF', // 二台目は青線にしてみる例
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map3
    });
    infoWindow2 = new google.maps.InfoWindow();
}

/****************************************
 * 一台目のデータを取得して表示
 ****************************************/
function fetchData() {
    fetch('https://script.google.com/macros/s/AKfycbwDuuyQvnaDi7gT59z6TpYW9A4Cbh2lB2uYhqNVP1IGnC7mXOVAsFSx3h2GjKOxA8Qjiw/exec?action=getData')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const dataTable = document.getElementById('data-table');
            const tbody = dataTable.querySelector('tbody');

            // 前回表示のクリア
            tbody.innerHTML = '';
            markers = [];
            linePath = [];
            polyline.setPath(linePath);

            data.forEach((item, index) => {
                // 行を作成
                const row = document.createElement('tr');
                row.style.display = 'none'; // 初期は非表示

                // Time
                const timeCell = document.createElement('td');
                timeCell.textContent = item.time || 'N/A';
                row.appendChild(timeCell);

                // Tmp
                const tmpCell = document.createElement('td');
                tmpCell.textContent = item.tmp || 'N/A';
                row.appendChild(tmpCell);

                // Hum
                const humCell = document.createElement('td');
                humCell.textContent = item.hum || 'N/A';
                row.appendChild(humCell);

                // Prs
                const prsCell = document.createElement('td');
                prsCell.textContent = item.prs || 'N/A';
                row.appendChild(prsCell);

                // WaterTemp
                const waterTempCell = document.createElement('td');
                waterTempCell.textContent = item.waterTemp || 'N/A';
                row.appendChild(waterTempCell);

                // Lat
                const latCell = document.createElement('td');
                latCell.textContent = item.Lat || 'N/A';
                row.appendChild(latCell);

                // Lng
                const lngCell = document.createElement('td');
                lngCell.textContent = item.Lng || 'N/A';
                row.appendChild(lngCell);

                tbody.appendChild(row);

                // 緯度経度があればマーカーを追加
                if (item.Lat && item.Lng) {
                    const coord = { lat: parseFloat(item.Lat), lng: parseFloat(item.Lng) };
                    addMarker(coord, index + 1, item.time, item.tmp);
                }

                // Timeセルをクリックしたらズーム
                timeCell.addEventListener('click', function () {
                    if (item.Lat && item.Lng) {
                        const coord2 = { lat: parseFloat(item.Lat), lng: parseFloat(item.Lng) };
                        map.setCenter(coord2);
                        map.setZoom(21);
                        map3.setCenter(coord2);
                        map3.setZoom(21);
                        infoWindow.setContent(`Time: ${item.time}<br>Temp: ${item.tmp}°C`);
                        infoWindow.open(map, markers[index]);
                        infoWindow.open(map3, markers[index]);
                    }
                });
            });

            // ローディング非表示、テーブル表示
            document.getElementById('loading').style.display = 'none';
            dataTable.style.display = 'table';

            // テーブル表示/非表示を切り替えるボタン
            const toggleBtn = document.getElementById('toggle-button');
            toggleBtn.addEventListener('click', function () {
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    if (row.style.display === 'none') {
                        row.style.display = '';
                        toggleBtn.textContent = '▲';
                    } else {
                        row.style.display = 'none';
                        toggleBtn.textContent = '▼';
                    }
                });
            });

            // 最新GPSへ飛ぶ
            const nowBtn = document.getElementById('now-button');
            nowBtn.addEventListener('click', function () {
                const latestData = data[data.length - 1];
                if (latestData && latestData.Lat && latestData.Lng) {
                    const coord2 = { lat: parseFloat(latestData.Lat), lng: parseFloat(latestData.Lng) };
                    map.setCenter(coord2);
                    map.setZoom(21);
                }
            });
            const nowBtn3 = document.getElementById('now-button3');
            nowBtn.addEventListener('click', function () {
                const latestData = data[data.length - 1];
                if (latestData && latestData.Lat && latestData.Lng) {
                    const coord2 = { lat: parseFloat(latestData.Lat), lng: parseFloat(latestData.Lng) };
                    map3.setCenter(coord2);
                    map3.setZoom(21);
                }
            });
        })
        .catch(err => {
            console.error('Error fetching data:', err);
            document.getElementById('loading').textContent = 'データの読み取りに失敗しました。';
        });
}

/****************************************
 * 二台目のデータを取得して表示
 ****************************************/
function fetchData2() {
    // 例として同じURLを使う
    fetch('https://script.google.com/macros/s/AKfycbyI3S91xKRMIV1m5Z5tEo5aYrLuLEsNDwS8ReQvxEnXLwuY8dWbpeVMuFL4MRlrQ_a6/exec?action=getData')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const dataTable2 = document.getElementById('data-table2');
            const tbody2 = dataTable2.querySelector('tbody');

            // 前回表示をクリア
            tbody2.innerHTML = '';
            markers2 = [];
            linePath2 = [];
            polyline2.setPath(linePath2);

            data.forEach((item, index) => {
                const row = document.createElement('tr');
                row.style.display = 'none';

                // Time
                const timeCell = document.createElement('td');
                timeCell.textContent = item.time || 'N/A';
                row.appendChild(timeCell);

                // Tmp
                const tmpCell = document.createElement('td');
                tmpCell.textContent = item.tmp || 'N/A';
                row.appendChild(tmpCell);

                // Hum
                const humCell = document.createElement('td');
                humCell.textContent = item.hum || 'N/A';
                row.appendChild(humCell);

                // Prs
                const prsCell = document.createElement('td');
                prsCell.textContent = item.prs || 'N/A';
                row.appendChild(prsCell);

                // Wtmp
                const wtmpCell = document.createElement('td');
                wtmpCell.textContent = item.wtmp || 'N/A';
                row.appendChild(wtmpCell);

                // Lat
                const latCell = document.createElement('td');
                latCell.textContent = item.Lat || 'N/A';
                row.appendChild(latCell);

                // Lng
                const lngCell = document.createElement('td');
                lngCell.textContent = item.Lng || 'N/A';
                row.appendChild(lngCell);

                tbody2.appendChild(row);

                // 緯度経度があればマーカー追加
                if (item.Lat && item.Lng) {
                    const coord = { lat: parseFloat(item.Lat), lng: parseFloat(item.Lng) };
                    addMarker2(coord, index + 1, item.time, item.tmp);
                }

                // Timeセルをクリック → ズーム
                timeCell.addEventListener('click', function () {
                    if (item.Lat && item.Lng) {
                        const coord2 = { lat: parseFloat(item.Lat), lng: parseFloat(item.Lng) };
                        map2.setCenter(coord2);
                        map3.setCenter(coord2);
                        map2.setZoom(21);
                        map3.setZoom(21);
                        infoWindow2.setContent(`Time: ${item.time}<br>Temp: ${item.tmp}°C`);
                        infoWindow2.open(map2, markers2[index]);
                        infoWindow2.open(map3, markers2[index]);
                    }
                });
            });

            // ローディング非表示
            document.getElementById('loading2').style.display = 'none';
            dataTable2.style.display = 'table';

            // トグルボタン (▼/▲)
            const toggleBtn2 = document.getElementById('toggle-button2');
            toggleBtn2.addEventListener('click', function () {
                const rows = tbody2.querySelectorAll('tr');
                rows.forEach(row => {
                    if (row.style.display === 'none') {
                        row.style.display = '';
                        toggleBtn2.textContent = '▲';
                    } else {
                        row.style.display = 'none';
                        toggleBtn2.textContent = '▼';
                    }
                });
            });

            // 最新GPSへ飛ぶ
            const nowBtn2 = document.getElementById('now-button2');
            nowBtn2.addEventListener('click', function () {
                const latestData = data[data.length - 1];
                if (latestData && latestData.Lat && latestData.Lng) {
                    const coord2 = { lat: parseFloat(latestData.Lat), lng: parseFloat(latestData.Lng) };
                    map2.setCenter(coord2);
                    map2.setZoom(21);
                }
            });
        })
        .catch(err => {
            console.error('Error fetching data2:', err);
            document.getElementById('loading2').textContent = 'データの読み取りに失敗しました。';
        });
}

/****************************************
 * 一台目: マーカー追加
 ****************************************/
function addMarker(location, label, time, temp) {
    const tempColor = getTempColor(temp);

    const marker = new google.maps.Marker({
        position: location,
        map: map||map3,
        label: label.toString(),
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: tempColor,
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#000'
        }
    });

    markers.push(marker);
    linePath.push(location);
    polyline.setPath(linePath);
    marker.addListener('click', function () {
        infoWindow.setContent('device 1' + '<br>Time: ' + time + '<br>Temp: ' + temp + '°C');
        infoWindow.open(map, marker);
        infoWindow.open(map3, marker);
    });
}

/****************************************
 * 二台目: マーカー追加
 ****************************************/
function addMarker2(location, label, time, temp) {
    const tempColor = getTempColor(temp);

    const marker = new google.maps.Marker({
        position: location,
        map: map2||map3,
        label: label.toString(),
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: tempColor,
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#000'
        }
    });

    markers2.push(marker);
    linePath2.push(location);
    polyline2.setPath(linePath2);

    marker.addListener('click', function () {
        infoWindow2.setContent('device 2' + '<br>Time: ' + time + '<br>Temp: ' + temp + '°C');
        infoWindow2.open(map2, marker);
        infoWindow2.open(map3, marker);
    });
}

/****************************************
 * 温度によるカラー設定 (共通)
 ****************************************/
function getTempColor(temp) {
    const parsedTemp = parseFloat(temp) || 0;
    // 0℃ → 青(240), 40℃ → 赤(0)
    const hue = Math.max(240 - (parsedTemp * 6), 0);
    return `hsl(${hue}, 100%, 50%)`;
}
