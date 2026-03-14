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
  // 關鍵 1：設定 base 路徑。請把 '你的儲存庫名稱' 換成你在 GitHub 上的 Repo 名字
  // 例如你的 Repo 叫做 mataian-twin，這裡就寫 '/mataian-twin/'
  base: '/mataian-digital-twin/', 

  build: {
    // 關鍵 2：叫 Vite 把打包後的檔案丟進 docs 資料夾，而不是預設的 dist
    outDir: 'docs' 
  }
});