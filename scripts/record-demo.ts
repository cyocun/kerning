/**
 * チュートリアルを録画してGIFを生成するスクリプト
 * Usage: npx playwright test scripts/record-demo.ts --config playwright.config.ts
 */
import { test } from '@playwright/test'
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'

const OUTPUT_DIR = join(process.cwd(), '.github', 'readme')
const VIDEO_PATH = join(OUTPUT_DIR, 'demo-raw.webm')
const GIF_PATH = join(OUTPUT_DIR, 'demo.gif')

test('record tutorial demo', async ({ browser }) => {
  test.setTimeout(120_000)

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

  const context = await browser.newContext({
    viewport: { width: 1024, height: 700 },
    recordVideo: { dir: OUTPUT_DIR, size: { width: 1024, height: 700 } },
  })

  const page = await context.newPage()

  // localStorage をクリアしてチュートリアル初回状態に
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  // チュートリアルが自動再生されるのを待つ
  await page.locator('.tour-caption').waitFor({ state: 'visible', timeout: 5000 })

  // Step 7 完了まで待機（リプレイボタンが出たら完了）
  await page.locator('.tour-replay-btn').waitFor({ state: 'visible', timeout: 90_000 })

  // 少し余韻
  await page.waitForTimeout(1500)

  await context.close()

  // 録画ファイルを探す（Playwrightはランダム名で保存する）
  const files = readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.webm') && f !== 'demo-raw.webm')
  if (files.length > 0) {
    renameSync(join(OUTPUT_DIR, files[files.length - 1]), VIDEO_PATH)
  }

  // ffmpeg で GIF に変換（2パス: パレット生成 → GIF生成）
  const palettePath = join(OUTPUT_DIR, 'palette.png')
  const fps = '15'
  const scale = '640'

  execFileSync('ffmpeg', [
    '-y', '-i', VIDEO_PATH,
    '-vf', `fps=${fps},scale=${scale}:-1:flags=lanczos,palettegen=stats_mode=diff`,
    palettePath,
  ], { stdio: 'inherit' })

  execFileSync('ffmpeg', [
    '-y', '-i', VIDEO_PATH, '-i', palettePath,
    '-lavfi', `fps=${fps},scale=${scale}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    GIF_PATH,
  ], { stdio: 'inherit' })

  // 中間ファイル削除
  try { unlinkSync(VIDEO_PATH) } catch {}
  try { unlinkSync(palettePath) } catch {}

  console.log(`\n✅ GIF saved to ${GIF_PATH}`)
})
