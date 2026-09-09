import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages отдаёт проект по пути /hookah-timer/, локально — из корня.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/hookah-timer/' : '/',
  plugins: [react()],
}))
