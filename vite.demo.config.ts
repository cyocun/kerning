import { defineConfig } from 'vite'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'typespacing'
const isGithubPagesBuild = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  root: 'demo',
  base: isGithubPagesBuild ? `/${repoName}/` : '/',
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
  },
})
