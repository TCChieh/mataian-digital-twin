import {
 Viewer,
 Ion,
 CesiumTerrainProvider,
 Cartesian3,
 UrlTemplateImageryProvider,
 SingleTileImageryProvider,
 Rectangle,
 Color,
 SceneMode,
 GeoJsonDataSource,
 HeightReference,
 createWorldTerrainAsync,
 Math as CesiumMath,
 sampleTerrainMostDetailed, 
 Cartographic,
 PolylineGlowMaterialProperty,
 ClassificationType,
 VerticalOrigin,
 HorizontalOrigin,
 LabelStyle,
 Cartesian2,
 Ellipsoid,
 Cesium3DTileset
} from "cesium";
// import * as Cesium from "cesium";
import { fromUrl } from "geotiff"; 
import "cesium/Build/Cesium/Widgets/widgets.css";
import proj4 from "proj4";




// Cesium Ion access token
Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0Y2RiMjc3Ny1iYWNlLTQzZTEtYjkyZS0zODliZmE1NWZhNDkiLCJpZCI6MzY2OTg4LCJpYXQiOjE3NjQ5MzczMjF9.8nEWxquC0GTOtAGMWdfVhiVITQ6WLJhB71lxcdoWgL0";


// 3D 地球
const viewer = new Viewer("cesiumContainer", {
//   terrainProvider: await CesiumTerrainProvider.fromIonAssetId(1), // 世界地形
 terrainProvider: await createWorldTerrainAsync(),
 baseLayerPicker: true,
 sceneMode: SceneMode.COLUMBUS_VIEW, // 3D 模式
 animation: false,
 timeline: false,
 // 🍎 專為 iOS 續命的設定：關閉對數深度緩衝
  logarithmicDepthBuffer: false,
  
  // (選用) 降低抗鋸齒級別，減輕 iPhone 晶片負擔
  msaaSamples: 1
});


//  加上底圖（OpenStreetMap）
// viewer.imageryLayers.addImageryProvider(
//   new UrlTemplateImageryProvider({
//     url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
//   })
// );


//  飛到堰塞湖地區
viewer.camera.flyTo({
 destination: Cartesian3.fromDegrees(121.408982, 23.687659, 20000.0),
});




//  讀取並顯示 DEM.tif
async function addGeoTiffLayer(url) {
 console.log("Reading GeoTIFF:", url);


 const tiff = await fromUrl(url);
 const image = await tiff.getImage();
 const raster = await image.readRasters();
 const [data] = raster;
 const width = image.getWidth();
 const height = image.getHeight();
 const bbox_raw = image.getBoundingBox(); // [minX, minY, maxX, maxY]
//   console.log("📏 DEM 尺寸:", width, "x", height);
//   console.log("📦 原始範圍 (TWD97):", bbox_raw);


 if (!data || data.length === 0) {
   console.error(" DEM 沒有資料，請確認 TIFF 是否正常。");
   return;
 }


 // =============================
 //  座標轉換：TWD97(EPSG:3826) → WGS84(EPSG:4326)
 // =============================
 proj4.defs("EPSG:3826", "+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +datum=WGS84 +units=m +no_defs");


 const [minX, minY, maxX, maxY] = bbox_raw;
 const [lon1, lat1] = proj4("EPSG:3826", "EPSG:4326", [minX, minY]);
 const [lon2, lat2] = proj4("EPSG:3826", "EPSG:4326", [maxX, maxY]);
 const bbox = [lon1, lat1, lon2, lat2];


//   console.log("轉換後範圍 (WGS84):", bbox);


 // =============================
 //  DEM 資料處理與繪製
 // =============================
 const skip = 50;
 const downW = Math.max(1, Math.floor(width / skip));
 const downH = Math.max(1, Math.floor(height / skip));


 const sampled = new Float32Array(downW * downH);
 for (let y = 0; y < downH; y++) {
   for (let x = 0; x < downW; x++) {
     const srcY = Math.min(height - 1, y * skip);
     const srcX = Math.min(width - 1, x * skip);
     const srcIdx = srcY * width + srcX;
     sampled[y * downW + x] = data[srcIdx];
   }
 }


 // 計算 min/max（排除異常值）
 let min = Infinity;
 let max = -Infinity;
 for (let i = 0; i < sampled.length; i++) {
   const v = sampled[i];
   if (!isFinite(v) || v > 1e6) continue; // 過濾無效值
   if (v < min) min = v;
   if (v > max) max = v;
 }
 console.log(` DEM 高程範圍：min=${min.toFixed(2)}  max=${max.toFixed(2)}`);


 // === 繪圖 ===
 const canvas = document.createElement("canvas");
 canvas.width = downW;
 canvas.height = downH;
 const ctx = canvas.getContext("2d");
 const imgData = ctx.createImageData(downW, downH);


//  for (let i = 0; i < sampled.length; i++) {
//    const val = sampled[i];
//    if (!isFinite(val) || val > 1e6) continue;
//    const ratio = (val - min) / (max - min);
//    const color = Color.fromHsl((1 - ratio) * 0.6, 1.0, 0.5);
//    const [r, g, b] = color.toBytes();
//    imgData.data[i * 4 + 0] = r;
//    imgData.data[i * 4 + 1] = g;
//    imgData.data[i * 4 + 2] = b;
//    imgData.data[i * 4 + 3] = 200;
//  }

 for (let i = 0; i < sampled.length; i++) {
  const val = sampled[i];
  if (!isFinite(val) || val > 1e6) continue;

  // 🔹 新增：低於海拔門檻時透明
  const threshold = 20; // 門檻（公尺），你可調成 0、10、50 等
  if (val <= threshold) {
    imgData.data[i * 4 + 3] = 0; // 完全透明
    continue;
  }

  // 🔹 正常上色（高於門檻）
  const ratio = (val - min) / (max - min);
  const color = Color.fromHsl((1 - ratio) * 0.6, 1.0, 0.5);
  const [r, g, b] = color.toBytes();
  imgData.data[i * 4 + 0] = r;
  imgData.data[i * 4 + 1] = g;
  imgData.data[i * 4 + 2] = b;

  // 讓顏色在低處漸淡，高處更實
  const alpha = Math.min(255, Math.max(0, ((val - threshold) / (max - threshold)) * 255));
  imgData.data[i * 4 + 3] = alpha;  // 根據高度變化透明度
}



 ctx.putImageData(imgData, 0, 0);
//   console.log("Canvas 建立完成:", canvas.width, "x", canvas.height);


 // === 疊加到 Cesium ===
 const provider = new SingleTileImageryProvider({
   url: canvas.toDataURL("image/png"),
   rectangle: Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]),
   tileWidth: canvas.width,
   tileHeight: canvas.height,
 });


 const layer = viewer.imageryLayers.addImageryProvider(provider);
 layer.alpha = 0.7;
//   console.log("DEM 圖層已加入 Cesium。");


 // initial view
 viewer.camera.flyTo({
   destination: Cartesian3.fromDegrees(121.408982, 23.507659, 20000.0),
   orientation: {
       heading: CesiumMath.toRadians(0),
       pitch: CesiumMath.toRadians(-45),
       roll: 0.0
   },
 });


 return layer;
}






// console.log("canvas url", canvas.toDataURL().substring(0, 100));
// 👇 執行：顯示 DEM
// addGeoTiffLayer("./data/MaTaiAn20m113.tif");


// === loading buildings (from NCU) ===
/*
async function loadBuildings() {
  // console.log("🚀 開始載入建築數據...");

  // 1. 載入 GeoJSON (維持 clampToGround: false)
  const dataSource = await GeoJsonDataSource.load("./data/Hualien_B_Guangfu.geojson", {
    clampToGround: false 
  });

  const entities = dataSource.entities.values;
  console.log(`📦 讀取到 ${entities.length} 個圖徵，準備進行地形高度取樣...`);

  // 2. 準備取樣點：收集所有建築物的「中心點」座標
  // 我們需要把 Entity 的 Cartesian3 (XYZ) 轉成 Cartographic (經緯度) 才能查地形
  const positionsToSample = [];
  const validEntities = []; // 存下來等等要對應回去

  for (const e of entities) {
    if (e.polygon && e.polygon.hierarchy) {
      // 取得建築物多邊形的中心點 (或是第一個頂點)
      const hierarchy = e.polygon.hierarchy.getValue();
      const center = hierarchy.positions[0]; // 暫用第一個點當作參考點
      
      const cartographic = Cartographic.fromCartesian(center);
      positionsToSample.push(cartographic);
      validEntities.push(e);
    }
  }

  // 3. 呼叫 Cesium 地形服務，查詢這些座標的真實高度
  // 注意：這一步需要網路，且取決於 terrainProvider
  try {
    const terrainProvider = await createWorldTerrainAsync(); // 確保取得 provider
    const updatedPositions = await sampleTerrainMostDetailed(terrainProvider, positionsToSample);

    // 4. 將查到的高度寫回建築物
    for (let i = 0; i < validEntities.length; i++) {
      const entity = validEntities[i];
      const terrainHeight = updatedPositions[i].height; // 這是查到的地形高度

      // 讀取原始屬性的樓高
      let buildH = parseFloat(entity.properties.BUILD_H?.getValue());
      if (isNaN(buildH) || buildH <= 0) buildH = 10;

      // 不再使用 CLAMP_TO_GROUND，而是直接設定「絕對高度 (NONE)」
      // 底部高度 = 查到的地形高度
      // 頂部高度 = 地形高度 + 樓高      
      entity.polygon.heightReference = HeightReference.NONE; 
      entity.polygon.extrudedHeightReference = HeightReference.NONE;

      entity.polygon.height = terrainHeight; 
      entity.polygon.extrudedHeight = terrainHeight + buildH;

      // 視覺設定
      // entity.polygon.material = Color.SANDYBROWN.withAlpha(0.9);
      let buildingColor;
      if (buildH < 6) {
          buildingColor = Color.fromCssColorString("#fd6767ff").withAlpha(0.7); // vertical evacuate 1 floor
      } else if (buildH >= 6) {
          buildingColor = Color.fromCssColorString("#54ad60ff").withAlpha(0.8); // vertical evacuate higher than 2 floor
      } 
      // else {
      //     buildingColor = Color.fromCssColorString("#fd5343ff").withAlpha(0.8); 
      // }

      entity.polygon.material = buildingColor;
      // entity.polygon.material = Color.GHOSTWHITE.withAlpha(0.9);
      entity.polygon.outline = false;
    }

    console.log("✅ 地形高度取樣完成，建築物已定位。");

  } catch (error) {
    console.error("❌ 地形取樣失敗，改用備案高度:", error);
    // 備案：如果取樣失敗，統一設一個安全高度以免消失
    validEntities.forEach(e => {
       e.polygon.heightReference = HeightReference.NONE;
       e.polygon.height = 100; // 暫時給個高度
       e.polygon.extrudedHeight = 115;
    });
  }

  viewer.dataSources.add(dataSource);
  
  // 飛過去看
  // viewer.zoomTo(dataSource);
}
*/
// === loading buildings (from Cesium ion 3D Tiles) ===
async function loadBuildings() {
  console.log("🏙️ 開始載入雲端 3D 建築...");
  try {
    // 呼叫你剛剛熱騰騰拿到的 ID
    const tileset = await Cesium3DTileset.fromIonAssetId(4540060);
    viewer.scene.primitives.add(tileset);
    
    console.log("✅ 3D 建築載入成功！");
  } catch (error) {
    console.error("❌ 3D 建築載入失敗:", error);
  }
}

// === loading rivers (from WRA opendata ) ===
async function loadRivers() {
  console.log("🌊 開始載入水文資料...");

  // ==========================================
  // 1. 載入河川線 (LineString)
  // ==========================================
  // 假設檔名是 river_lines.geojson
  const lineDataSource = await GeoJsonDataSource.load("./data/River/GF_Tributary.geojson", {
    // 【關鍵設定】線條強制貼地，才不會被山擋住或浮在空中
    clampToGround: true 
  });

  const lineEntities = lineDataSource.entities.values;
  for (const e of lineEntities) {
    if (e.polyline) {
      // 設定河川線條樣式
      e.polyline.width = 1.5; // 線寬
      e.polyline.material = Color.NAVY.withAlpha(0.7);
      // 確保線條貼地 (雙重保險)
      e.polyline.clampToGround = true;
    }
  }
  // 加入場景
  viewer.dataSources.add(lineDataSource);
  console.log(`✅ 已載入 ${lineEntities.length} 條河川線`);


  // ==========================================
  // 2. 載入水域面 (Polygon)
  // ==========================================
  const polyDataSource = await GeoJsonDataSource.load("./data/River/GF_MainRiver.geojson", {
    clampToGround: true 
  });

  const polyEntities = polyDataSource.entities.values;
  for (const e of polyEntities) {
    if (e.polygon) {
      // 1. 設定顏色 (先調成不透明，確認有沒有顯示出來)
      // 使用 withAlpha(0.8) 避免太透被底圖吃掉
      e.polygon.material = Color.NAVY.withAlpha(0.7);
      
      // 2. 關鍵修正：設定分類類型
      // 這告訴 Cesium 把這個多邊形「畫在地形與 3D Tiles 之上」
      // e.polygon.classificationType = ClassificationType.TERRAIN; 

      // 3. 關閉邊框 (有時候邊框會干擾貼地渲染)
      e.polygon.outline = false;
    }
  }
  
  // 4. 重要：確保圖層順序
  // 雖然 DataSource 很難像 Layer 一樣調 z-index，
  // 但我們可以透過「重新加入」的方式確保它在最後被繪製
  viewer.dataSources.add(polyDataSource);

  console.log(`✅ 已載入 ${polyEntities.length} 個水域範圍`);
}

  // ==========================================
  //   載入
  // ==========================================
// async function loadStations() {
//   console.log("📡 開始載入測站資料 (使用 observatoryname)...");

//   // 1. 直接讀取 (因為你的座標 121, 23 已經是正確的經緯度)
//   const stationUrl = "./data/River/GaugeStation.geojson"; 
  
//   try {
//     const dataSource = await GeoJsonDataSource.load(stationUrl, {
//       // 關鍵：讓點位貼合地形表面 (自動抓地形高度)
//       clampToGround: true 
//     });

//     const entities = dataSource.entities.values;

//     for (const e of entities) {
//       // 2. 修正讀取欄位：讀取 "observatoryname"
//       // 如果讀不到，備案讀取 "englishname"
//       const stationName = e.properties.observatoryname?.getValue() || 
//                           e.properties.englishname?.getValue() || 
//                           "未命名測站";

//       // 3. 設定圖示 (Billboard)
//       e.billboard = {
//         image: "https://cdn-icons-png.flaticon.com/512/684/684908.png", 
//         width: 32,
//         height: 32,
//         verticalOrigin: VerticalOrigin.BOTTOM, // 針尖對準座標
//         heightReference: HeightReference.CLAMP_TO_GROUND, // 強制貼地
//         disableDepthTestDistance: Number.POSITIVE_INFINITY // 確保永遠顯示在最上層
//       };

//       // 4. 設定文字 (Label)
//       e.label = {
//         text: stationName,
//         font: "16px Microsoft JhengHei, monospace", // 改用微軟正黑體比較好看
//         style: LabelStyle.FILL_AND_OUTLINE,
//         fillColor: Color.WHITE,
//         outlineColor: Color.BLACK,
//         outlineWidth: 2,
//         verticalOrigin: VerticalOrigin.BOTTOM,
//         pixelOffset: new Cartesian2(0, -40), // 往上推避開圖示
//         heightReference: HeightReference.CLAMP_TO_GROUND,
//         disableDepthTestDistance: Number.POSITIVE_INFINITY,
//         distanceDisplayCondition: undefined
//       };
      
//       // 清除原本的點樣式
//       e.point = undefined;
//     }

//     viewer.dataSources.add(dataSource);
//     console.log(`✅ 已載入 ${entities.length} 個測站：${entities[0].label.text}`);
    
//     // 飛過去確認
//     viewer.zoomTo(dataSource);

//   } catch (error) {
//     console.error("❌ 載入失敗:", error);
//   }
// }

// === loading rivers (from WRA opendata ) ===
async function loadOverflow() {
  console.log("🌊 開始載入overflow資料...");

  // ==========================================
  // loadOverflow (Polygon)
  // ==========================================
  const polyDataSource = await GeoJsonDataSource.load("./data/Mataian_overflow_area.geojson", {
    clampToGround: true 
  });

  const polyEntities = polyDataSource.entities.values;
  for (const e of polyEntities) {
    if (e.polygon) {
      // 1. 設定顏色 (先調成不透明，確認有沒有顯示出來)
      // 使用 withAlpha(0.8) 避免太透被底圖吃掉
      // e.polygon.material = Color.NAVY.withAlpha(0.6);
      e.polygon.material = Color.fromCssColorString("#94bae0").withAlpha(0.7);
      
      // 2. 關鍵修正：設定分類類型
      // 這告訴 Cesium 把這個多邊形「畫在地形與 3D Tiles 之上」
      e.polygon.classificationType = ClassificationType.TERRAIN; 

      // 3. 關閉邊框 (有時候邊框會干擾貼地渲染)
      e.polygon.outline = false;
    }
  }
  
  // 重要：確保圖層順序
  // 雖然 DataSource 很難像 Layer 一樣調 z-index，
  // 但我們可以透過「重新加入」的方式確保它在最後被繪製
  viewer.dataSources.add(polyDataSource);

  console.log(`✅ 已載入 loadOverflow範圍`);
}

// === loading roads (from OSM ) ===
async function loadRoads() {
  console.log("開始載入road資料...");

  const lineDataSource = await GeoJsonDataSource.load("./data/osm_road.geojson", {
    clampToGround: true 
  });

  const lineEntities = lineDataSource.entities.values;
  for (const e of lineEntities) {
    if (e.polyline) {
      e.polyline.width = 1.5; // 線寬
      e.polyline.material = Color.LIGHTGRAY.withAlpha(0.5);
      e.polyline.clampToGround = true;
    }
  }
  // 加入場景
  viewer.dataSources.add(lineDataSource);
  console.log(`✅ 已載入 ${lineEntities.length} 條roads`);

}

// // === loading facilities (from google map POI ) ===
async function loadFacilities() {
  console.log("📍 開始載入點位資料...");

  const dataSource = await GeoJsonDataSource.load("./data/MaTaiAn_POI_2.geojson", {
    clampToGround: false
  });
  for (const e of dataSource.entities.values) {
    e.label = undefined;         // 🔹 關閉文字標籤
    e.billboard = undefined;     // 🔹 若不想要 icon，也可關閉
  }
  const entities = dataSource.entities.values;
  const positionsToSample = [];
  const validEntities = [];

  for (const e of entities) {
    if (e.position) {
      const carto = Cartographic.fromCartesian(e.position.getValue());
      positionsToSample.push(carto);
      validEntities.push(e);
    }
  }

  const terrainProvider = await createWorldTerrainAsync();
  const updatedPositions = await sampleTerrainMostDetailed(terrainProvider, positionsToSample);

  for (let i = 0; i < validEntities.length; i++) {
    const e = validEntities[i];
    const pos = updatedPositions[i];
    const terrainHeight = pos.height + 20; // 提高一點，避免陷地

    const carto = new Cartographic(pos.longitude, pos.latitude, terrainHeight);
    const cart3 = Ellipsoid.WGS84.cartographicToCartesian(carto);
    e.position = cart3;

    const cls = e.properties.Classification?.getValue();
    const shelter = e.properties.Notes?.getValue();
    let color = Color.GRAY;
    if (cls === "Medical") color = Color.RED;
    else if (cls === "Infrastructure") color = Color.BLUE;
    else if (cls === "Religious") color = Color.GOLD;
    else if (cls === "Transportation") color = Color.NAVY;
    else if (cls === "Education") color = Color.PURPLE;
    if (shelter === "shelter") color = Color.LIGHTGREEN;

    e.point = {
      pixelSize: 12,
      color: color.withAlpha(0.9),
      outlineColor: Color.WHITE,
      outlineWidth: 2,
      heightReference: HeightReference.NONE, // ✅ 絕對高度
      disableDepthTestDistance: Number.POSITIVE_INFINITY, // ✅ 防止被地形或建築遮擋
    };
  }

  viewer.dataSources.add(dataSource);
  // viewer.flyTo(dataSource);
}


// ====== 專為 iOS Safari 續命的效能優化 ======

// 判斷如果是手機螢幕 (寬度小於 800px)
if (window.innerWidth < 800) {
  
  // 1. 殺手鐧：強制把渲染解析度砍半。這會大幅減少記憶體消耗！
  // 雖然畫面會稍微糊一點點，但保證不會閃退。
  viewer.resolutionScale = 0.5; 

  // 2. 降低地形的精細度要求 (預設是 2，調高代表放寬標準，少載入一些地形圖塊)
  viewer.scene.globe.maximumScreenSpaceError = 4;

  // 3. 關閉吃效能的抗鋸齒特效
  viewer.scene.postProcessStages.fxaa.enabled = false;
  if (viewer.scene.msaaSamples) {
    viewer.scene.msaaSamples = 1; 
  }

  // 4. (選用) 如果妳的河川 GeoJSON 還是很大，暫時不要讓它貼合地形 (超耗 GPU)
  // 如果之前有設定 clampToGround，建議在手機版先關掉
}



// 執行
// didn't work, I guess the point was unvisible because of terrain
// loadFacilities(); 
// loadBuildings();
// loadRivers();
// loadOverflow();
// loadRoads();

// loadStations();




