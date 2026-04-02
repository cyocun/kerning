import { resolve } from 'path'
import { defineConfig } from 'vite'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'visual-kerning'
const isGithubPagesBuild = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  root: 'demo',
  base: isGithubPagesBuild ? `/${repoName}/` : '/',
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        root: resolve(__dirname, 'demo/index.html'),
        en: resolve(__dirname, 'demo/en/index.html'),
        ja: resolve(__dirname, 'demo/ja/index.html'),
      },
    },
  },
})
