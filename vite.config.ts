import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base: the build works from any path (GitHub Pages, a subfolder, a phone's home screen).
export default defineConfig({ base: './', plugins: [react()] })
