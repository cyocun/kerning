import { test, expect } from '@playwright/test'

test.describe('tutorial tour', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage をクリアしてチュートリアル初回状態にする
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
  })

  test('tutorial starts, shows skip button, and can be skipped', async ({ page }) => {
    // チュートリアル開始でスキップボタンが出る
    const skipBtn = page.locator('.tour-skip-btn')
    await expect(skipBtn).toBeVisible({ timeout: 5000 })
    expect(await skipBtn.textContent()).toBe('Skip tour')

    // スキップする
    await skipBtn.click()

    // スキップ後: スキップボタンが消え、リプレイボタンが出る
    await expect(skipBtn).toBeHidden({ timeout: 3000 })
    const replayBtn = page.locator('.tour-replay-btn')
    await expect(replayBtn).toBeVisible({ timeout: 3000 })
    expect(await replayBtn.textContent()).toBe('Replay tour')

    // localStorage に完了フラグが立っている
    const done = await page.evaluate(() => localStorage.getItem('typespacing-tutorial-done'))
    expect(done).toBe('1')
  })

  test('tutorial can be cancelled by page click', async ({ page }) => {
    const skipBtn = page.locator('.tour-skip-btn')
    await expect(skipBtn).toBeVisible({ timeout: 5000 })

    // ページ本体をクリックしてキャンセル
    await page.mouse.click(10, 10)

    // スキップボタンが消え、リプレイボタンが出る
    await expect(skipBtn).toBeHidden({ timeout: 3000 })
    await expect(page.locator('.tour-replay-btn')).toBeVisible({ timeout: 3000 })
  })

  test('replay button restarts the tour', async ({ page }) => {
    // まずスキップ
    const skipBtn = page.locator('.tour-skip-btn')
    await expect(skipBtn).toBeVisible({ timeout: 5000 })
    await skipBtn.click()

    // リプレイボタンをクリック
    const replayBtn = page.locator('.tour-replay-btn')
    await expect(replayBtn).toBeVisible({ timeout: 3000 })
    await replayBtn.click()

    // チュートリアルが再開される（スキップボタンが再表示）
    await expect(page.locator('.tour-skip-btn')).toBeVisible({ timeout: 5000 })

    // localStorage から完了フラグが消えている
    const done = await page.evaluate(() => localStorage.getItem('typespacing-tutorial-done'))
    expect(done).toBeNull()
  })

  test('tutorial runs through steps with captions', async ({ page }) => {
    // Step 1: 中央キャプションが表示される
    const caption = page.locator('.tour-caption')
    await expect(caption).toContainText('editor palette', { timeout: 5000 })
    await expect(caption).toContainText('Step 1 / 7')

    // Step 1 完了後、エディタパネルが表示される
    await expect(page.locator('.js-panel')).toBeVisible({ timeout: 10000 })

    // Step 2 に進む: キャプションが変わる
    await expect(caption).toContainText('Step 2 / 7', { timeout: 10000 })

    // 以降のステップが進むことを確認（Step 3 まで待つ）
    await expect(caption).toContainText('Step 3 / 7', { timeout: 15000 })

    // Step 3 でキーキャップがキャプション内に表示される
    const keycaps = page.locator('.tour-keycap')
    await expect(keycaps.first()).toBeVisible({ timeout: 5000 })
    // キー操作時にハイライトされる
    await expect(page.locator('.tour-keycap-active').first()).toBeVisible({ timeout: 5000 })
  })

  test('completed tour shows replay on reload', async ({ page }) => {
    // スキップして完了状態にする
    await expect(page.locator('.tour-skip-btn')).toBeVisible({ timeout: 5000 })
    await page.locator('.tour-skip-btn').click()
    await expect(page.locator('.tour-replay-btn')).toBeVisible({ timeout: 3000 })

    // ページをリロード（IMPORTED_KEY フラグを立ててリセットを防ぐ）
    await page.evaluate(() => {
      localStorage.setItem('typespacing-editor-imported', '1')
    })
    await page.reload()

    // チュートリアルは開始せず、リプレイボタンが表示される
    await expect(page.locator('.tour-replay-btn')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.tour-skip-btn')).toBeHidden()
  })
})
