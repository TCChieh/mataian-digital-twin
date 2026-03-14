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

export default defineConfig({
  // 告訴 Vite：我的網站是放在這個子目錄底下，請把所有路徑都加上這個前綴
  base: '/mataian-digital-twin/', 

  build: {
    outDir: 'docs' // 確保打包輸出到 docs 資料夾
  }
});