import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  base: process.env.VITE_BASE_URL || "/locomm",
  server: {
    proxy: {
      '/socket.io': {
        target: 'https://127.0.0.1:3001',
        ws: true,
        secure: false,
        changeOrigin: true
      }
    }
  }
})
