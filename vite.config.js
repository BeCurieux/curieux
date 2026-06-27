import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Two independent apps live in this repo:
//   index.html    -> Curieux (cultural fluency)
//   skippr.html -> Skippr (charter booking & ops)
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        skippr: resolve(__dirname, 'skippr.html'),
      },
    },
  },
})
