import { test, expect } from '@playwright/test'

test('editor supports compare, collapsing, dragging, and modified highlight', async ({ page }) => {
  await page.goto('/')

  // ツアーのイントロ待ちをスキップしてエディタを即座に有効化
  await page.waitForFunction(() => (window as any).__kerningDemo)
  await page.evaluate(() => {
    ;(window as any).__kerningDemo.plugin.enabled.value = true
  })

  await expect
    .poll(async () => page.locator('.visual-kerning-overlay').evaluate((el) => getComputedStyle(el).display), { timeout: 10000 })
    .toBe('block')

  await expect(page.locator('.js-panel')).toContainText('visual kerning')

  const hero = page.locator('.hero')
  await hero.scrollIntoViewIfNeeded()
  await hero.click()

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }))
  })

  await expect(hero).toHaveClass(/visual-kerning-modified/)
  await expect
    .poll(async () => hero.evaluate((el) => getComputedStyle(el).outlineStyle))
    .not.toBe('none')

  // カーニングデータで非ゼロのmarginを持つspanを使う（indent=0のためfirstは0）
  const kernedSpan = page.locator('.hero .visual-kerning-char').nth(2)
  const before = await kernedSpan.evaluate((el) => ({
    marginRight: getComputedStyle(el).marginRight,
    marginLeft: getComputedStyle(el).marginLeft,
  }))
  expect(before.marginRight !== '0px' || before.marginLeft !== '0px').toBeTruthy()

  await page.locator('.js-compare').click()
  const compared = await kernedSpan.evaluate((el) => ({
    marginRight: getComputedStyle(el).marginRight,
    marginLeft: getComputedStyle(el).marginLeft,
  }))
  expect(compared.marginRight).toBe('0px')
  expect(compared.marginLeft).toBe('0px')

  await page.locator('.js-compare').click()
  const restored = await kernedSpan.evaluate((el) => ({
    marginRight: getComputedStyle(el).marginRight,
    marginLeft: getComputedStyle(el).marginLeft,
  }))
  expect(restored).toEqual(before)

  const panel = page.locator('.js-panel')
  const panelBody = page.locator('.js-panel-body')
  const panelBefore = await panel.boundingBox()
  if (!panelBefore) throw new Error('Panel not found')

  await page.locator('.js-collapse').click()
  await expect(panelBody).toBeHidden()
  await page.locator('.js-collapse').click()
  await expect(panelBody).toBeVisible()

  const handle = page.locator('.js-drag-handle')
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('Drag handle not found')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2 - 80, handleBox.y + handleBox.height / 2 - 60, { steps: 8 })
  await page.mouse.up()

  const panelAfter = await panel.boundingBox()
  if (!panelAfter) throw new Error('Panel not found after drag')
  expect(Math.abs(panelAfter.x - panelBefore.x) > 20 || Math.abs(panelAfter.y - panelBefore.y) > 20).toBeTruthy()

  const aside = page.locator('.aside p')
  await aside.click()
  await expect(page.locator('.aside p br')).toHaveCount(0)

  const stackedFirstChar = page.locator('.vertical-demo .visual-kerning-char').first()
  await stackedFirstChar.click()
  const beforeVerticalMove = await page.evaluate(() => window.__kerningDemo?.plugin.cursorRect.value?.y ?? null)
  await page.keyboard.press('ArrowDown')
  const afterVerticalMove = await page.evaluate(() => window.__kerningDemo?.plugin.cursorRect.value?.y ?? null)
  expect(beforeVerticalMove).not.toBeNull()
  expect(afterVerticalMove).not.toBeNull()
  expect(afterVerticalMove).not.toBe(beforeVerticalMove)

  const lineBreakCursor = await page.evaluate(() => {
    const plugin = window.__kerningDemo?.plugin
    const root = document.querySelector('.vertical-demo')
    if (!plugin || !root) return null
    const spans = Array.from(root.querySelectorAll('.visual-kerning-char'))
    const index = spans.findIndex((span, i) => {
      const next = spans[i + 1]
      if (!next) return false
      const a = span.getBoundingClientRect()
      const b = next.getBoundingClientRect()
      const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      return overlap < Math.min(a.height, b.height) * 0.5
    })
    if (index < 0) return null
    for (let i = 0; i <= index; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    }
    return {
      rect: plugin.cursorRect.value,
      charHeight: spans[index].getBoundingClientRect().height,
    }
  })
  expect(lineBreakCursor).not.toBeNull()
  expect(lineBreakCursor?.rect.h).toBeLessThan((lineBreakCursor?.charHeight ?? 0) * 1.2)

  await page.evaluate(() => {
    const plugin = window.__kerningDemo?.plugin
    const root = document.querySelector('.vertical-demo')
    if (!plugin || !root) return
    const spans = Array.from(root.querySelectorAll('.visual-kerning-char'))
    const index = spans.findIndex((span, i) => {
      const next = spans[i + 1]
      if (!next) return false
      const a = span.getBoundingClientRect()
      const b = next.getBoundingClientRect()
      const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      return overlap < Math.min(a.height, b.height) * 0.5
    })
    if (index < 0) return
    plugin.cursorGap.value = index
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }))
  })
  const secondLineMargin = await page.locator('.vertical-demo .visual-kerning-char').nth(4).evaluate((el) => getComputedStyle(el).marginLeft)
  expect(secondLineMargin).not.toBe('0px')
})
