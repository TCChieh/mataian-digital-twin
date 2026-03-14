// import { defineConfig } from "vite";
// import cesium from "vite-plugin-cesium";

// export default defineConfig({
//   plugins: [cesium()],
//   server: {
//     port: 5173, // 網站埠號
//     open: true  // 啟動時自動開瀏覽器
//   }
// });
import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium'; // 👈 1. 引入 Cesium 外掛

export default defineConfig({
  base: '/mataian-digital-twin/', // 你的 GitHub 專案名稱
  plugins: [cesium()],            // 👈 2. 啟動外掛
  build: {
    outDir: 'docs'
  }
});