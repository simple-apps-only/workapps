import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.LOCAL_DEV ? './' : '/workapps/list_creator/',
  plugins: [react(), tailwindcss()],
})
