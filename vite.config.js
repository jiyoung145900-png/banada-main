import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,      // ⭐ Main은 5173 포트 사용
    open: true,      // 자동으로 브라우저 열기
    strictPort: false, // 5173 사용 중이면 다음 포트로 이동
  },
})