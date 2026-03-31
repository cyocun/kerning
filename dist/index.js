// src/validation.ts
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isFontInfo(value) {
  if (!isRecord(value)) return false;
  return typeof value.family === "string" && typeof value.weight === "string" && typeof value.size === "string";
}
function isKerningArray(value) {
  return Array.isArray(value) && value.every(isFiniteNumber);
}
function isKerningArea(value) {
  if (!isRecord(value)) return false;
  return typeof value.selector === "string" && typeof value.text === "string" && isFontInfo(value.font) && (value.indent === void 0 || isFiniteNumber(value.indent)) && isKerningArray(value.kerning);
}
function isKerningExport(value) {
  if (!isRecord(value)) return false;
  return (value.version === void 0 || isFiniteNumber(value.version)) && typeof value.exported === "string" && typeof value.page === "string" && Array.isArray(value.areas) && value.areas.every(isKerningArea);
}
function assertValidKerningExport(value) {
  if (!isKerningExport(value)) {
    throw new TypeError("[typespacing] Invalid kerning export payload.");
  }
}
function isPersistedKerningArea(value) {
  if (!isRecord(value)) return false;
  return typeof value.text === "string" && isKerningArray(value.kerning) && (value.indent === void 0 || isFiniteNumber(value.indent)) && isFontInfo(value.font);
}
function sanitizePersistedKerningData(value) {
  if (!isRecord(value)) return null;
  const data = {};
  const droppedSelectors = [];
  for (const [selector, area] of Object.entries(value)) {
    if (isPersistedKerningArea(area)) {
      data[selector] = {
        text: area.text,
        kerning: [...area.kerning],
        indent: area.indent,
        font: { ...area.font }
      };
      continue;
    }
    droppedSelectors.push(selector);
  }
  return { data, droppedSelectors };
}

// src/applyKerning.ts
var KERNING_FORMAT_VERSION = 1;
function readKerningLength(value) {
  const raw = value?.trim();
  if (!raw) return null;
  if (!raw.startsWith("calc(")) {
    if (!raw.endsWith("em")) return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? Math.round(parsed * 1e3) : null;
  }
  const inner = raw.slice(5, -1).replace(/\s+/g, "");
  let total = 0;
  let found = false;
  for (const match of inner.matchAll(/([+-]?\d*\.?\d+)em/g)) {
    total += Number.parseFloat(match[1]);
    found = true;
  }
  return found ? Math.round(total * 1e3) : null;
}
function getKerningCharCount(text) {
  let count = 0;
  for (const char of text) {
    if (char !== "\n") count++;
  }
  return count;
}
function normalizeKerning(kerning, charCount) {
  if (kerning.length === charCount) return [...kerning];
  const normalized = kerning.slice(0, charCount);
  while (normalized.length < charCount) normalized.push(0);
  return normalized;
}
function normalizeKerningForText(kerning, text) {
  return normalizeKerning(kerning, getKerningCharCount(text));
}
function warnKerningLengthMismatch(selector, expected, actual) {
  console.warn(
    `[typespacing] Kerning length mismatch for ${selector}: expected ${expected}, got ${actual}. Padding/truncating to match visible characters.`
  );
}
function createKerningSpan(char, spanClassName) {
  const span = document.createElement("span");
  if (spanClassName) span.className = spanClassName;
  span.textContent = char;
  return span;
}
function appendKerningSpan(container, char, spans, spanClassName) {
  const span = createKerningSpan(char, spanClassName);
  container.appendChild(span);
  spans.push(span);
}
function applyKerningToSpans(spans, kerning, indent = 0) {
  const parentEl = spans[0]?.parentElement;
  const inheritedLS = parentEl ? getComputedStyle(parentEl).letterSpacing : "0px";
  const inheritedPx = inheritedLS === "normal" ? 0 : parseFloat(inheritedLS) || 0;
  spans.forEach((span, i) => {
    span.style.letterSpacing = "0em";
    span.style.removeProperty("margin-right");
    const gap = i === 0 ? indent : kerning[i - 1] ?? 0;
    const lsMargin = i > 0 ? inheritedPx : 0;
    if (gap !== 0 || lsMargin !== 0) {
      span.style.marginLeft = lsMargin !== 0 ? `calc(${gap / 1e3}em + ${lsMargin}px)` : `${gap / 1e3}em`;
    } else {
      span.style.removeProperty("margin-left");
    }
  });
}
function getSingleCharSpans(el) {
  const spans = [];
  function visit(node) {
    for (const childNode of Array.from(node.childNodes)) {
      if (childNode.nodeType === Node.TEXT_NODE) {
        if ((childNode.textContent?.trim() ?? "") !== "") return false;
        continue;
      }
      if (childNode.nodeType !== Node.ELEMENT_NODE) continue;
      const child = childNode;
      if (child.tagName === "BR") continue;
      if (child.tagName === "SPAN" && child.children.length === 0 && (child.textContent?.length ?? 0) === 1) {
        spans.push(child);
        continue;
      }
      if (!visit(child)) return false;
    }
    return true;
  }
  if (!visit(el)) return null;
  return spans.length >= 2 ? spans : null;
}
function extractKerningFromWrapped(el) {
  const spans = getSingleCharSpans(el);
  if (!spans) return null;
  const text = spans.map((s) => s.textContent).join("");
  const kerning = spans.map((span, i) => {
    const next = spans[i + 1];
    const marginLeft = readKerningLength(next?.style.marginLeft);
    if (marginLeft !== null) return marginLeft;
    const marginRight = readKerningLength(span.style.marginRight);
    if (marginRight !== null) return marginRight;
    const letterSpacing = readKerningLength(span.style.letterSpacing);
    if (letterSpacing !== null) return letterSpacing;
    return 0;
  });
  const indent = readKerningLength(spans[0]?.style.marginLeft) ?? 0;
  return { text, kerning, indent };
}
function wrapElementWithKerning(el, kerning, options = {}) {
  const { indent = 0, spanClassName } = options;
  const spans = [];
  const brPositions = [];
  let pendingSpace = false;
  let hasVisibleChar = false;
  function insertPendingSpaceBefore(nextNode) {
    if (!pendingSpace || !hasVisibleChar) return;
    const span = createKerningSpan(" ", spanClassName);
    nextNode.parentNode?.insertBefore(span, nextNode);
    spans.push(span);
    pendingSpace = false;
  }
  function flushPendingSpace(container) {
    if (!pendingSpace || !hasVisibleChar) return;
    appendKerningSpan(container, " ", spans, spanClassName);
    pendingSpace = false;
  }
  function wrapChildren(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const original = child.textContent ?? "";
        const fragment = document.createDocumentFragment();
        for (const rawChar of original) {
          if (/\s/.test(rawChar)) {
            pendingSpace = hasVisibleChar || pendingSpace;
            continue;
          }
          flushPendingSpace(fragment);
          appendKerningSpan(fragment, rawChar, spans, spanClassName);
          hasVisibleChar = true;
        }
        child.replaceWith(fragment);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const childEl = child;
      if (childEl.tagName === "BR") {
        pendingSpace = false;
        if (hasVisibleChar) brPositions.push(spans.length);
        continue;
      }
      insertPendingSpaceBefore(childEl);
      wrapChildren(childEl);
    }
  }
  wrapChildren(el);
  applyKerningToSpans(spans, normalizeKerning(kerning, spans.length), indent);
  return { spans, brPositions };
}
function collectKerningText(node) {
  const BREAK_TOKEN = "\0";
  function walk(current) {
    if (current.nodeType === Node.TEXT_NODE) {
      return (current.textContent ?? "").replace(/\s+/g, " ");
    }
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current;
      if (el.tagName === "BR") return BREAK_TOKEN;
      return Array.from(el.childNodes).map(walk).join("");
    }
    return "";
  }
  return walk(node).replace(/ {2,}/g, " ").replace(new RegExp(` *${BREAK_TOKEN} *`, "g"), "\n").trim();
}
function applyKerning(data, options = {}) {
  assertValidKerningExport(data);
  const { warnMissing = true } = options;
  if (warnMissing && data.version !== void 0 && data.version > KERNING_FORMAT_VERSION) {
    console.warn(
      `[typespacing] Data format version ${data.version} is newer than supported version ${KERNING_FORMAT_VERSION}. Some features may not work correctly.`
    );
  }
  for (const area of data.areas) {
    const el = document.querySelector(area.selector);
    if (!el) {
      if (warnMissing) console.warn(`[typespacing] Element not found: ${area.selector}`);
      continue;
    }
    if (warnMissing && el.tagName === "SPAN") {
      console.warn(
        `[typespacing] Target element is a <span>: "${area.selector}". Wrapping may produce nested spans. Consider using a block-level element (e.g. <p>, <div>, <h1>) as the kerning target.`
      );
    }
    const wrappedSpans = getSingleCharSpans(el);
    if (wrappedSpans) {
      if (warnMissing && area.kerning.length !== wrappedSpans.length) {
        warnKerningLengthMismatch(area.selector, wrappedSpans.length, area.kerning.length);
      }
      applyKerningToSpans(
        wrappedSpans,
        normalizeKerning(area.kerning, wrappedSpans.length),
        area.indent ?? 0
      );
    } else {
      const text = collectKerningText(el);
      if (text !== area.text && warnMissing) {
        console.warn(`[typespacing] Text mismatch for ${area.selector}: expected "${area.text}", got "${text}"`);
      }
      const normalizedKerning = normalizeKerningForText(area.kerning, text);
      if (warnMissing && area.kerning.length !== normalizedKerning.length) {
        warnKerningLengthMismatch(area.selector, normalizedKerning.length, area.kerning.length);
      }
      wrapElementWithKerning(el, normalizedKerning, { indent: area.indent ?? 0 });
    }
  }
}

// src/editorMessages.ts
var baseMessages = {
  en: {
    export: "Export",
    reset: "Reset",
    compare: "Before/After",
    copied: "Downloaded",
    confirmReset: "Reset all kerning?",
    collapse: "Collapse palette",
    expand: "Expand palette",
    guides: "Guides"
  },
  ja: {
    export: "\u66F8\u304D\u51FA\u3057",
    reset: "\u30EA\u30BB\u30C3\u30C8",
    compare: "\u6BD4\u8F03",
    copied: "\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3057\u307E\u3057\u305F",
    confirmReset: "\u30AB\u30FC\u30CB\u30F3\u30B0\u3092\u3059\u3079\u3066\u30EA\u30BB\u30C3\u30C8\u3057\u307E\u3059\u304B\uFF1F",
    collapse: "\u30D1\u30EC\u30C3\u30C8\u3092\u6298\u308A\u305F\u305F\u3080",
    expand: "\u30D1\u30EC\u30C3\u30C8\u3092\u5C55\u958B\u3059\u308B",
    guides: "\u30AC\u30A4\u30C9"
  }
};
var editorMessages = {
  en: {
    ...baseMessages.en,
    helpText: "Click text, use Alt + \u2190/\u2192 to adjust. Drag the header to move the palette, and use \u2212 / + to collapse or expand it.",
    warnSpanTarget: "<span> detected as target. Use a block element (<p>, <div>, <h1>) to avoid nested spans."
  },
  ja: {
    ...baseMessages.ja,
    helpText: "\u30C6\u30AD\u30B9\u30C8\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3001Alt + \u2190/\u2192 \u3067\u8ABF\u6574\u3002\u30D8\u30C3\u30C0\u30FC\u306F\u30C9\u30E9\u30C3\u30B0\u3067\u79FB\u52D5\u3001\u2212 / + \u3067\u6298\u308A\u305F\u305F\u307F\u30FB\u5C55\u958B\u3067\u304D\u307E\u3059\u3002",
    warnSpanTarget: "\u5BFE\u8C61\u304C <span> \u3067\u3059\u3002\u30CD\u30B9\u30C8\u3092\u907F\u3051\u308B\u305F\u3081\u30D6\u30ED\u30C3\u30AF\u8981\u7D20\uFF08<p>, <div>, <h1>\uFF09\u306E\u4F7F\u7528\u3092\u63A8\u5968\u3057\u307E\u3059\u3002"
  }
};

// src/kerningEditor.ts
function valueBox(initial) {
  return { value: initial };
}
function watchedValueBox(initial, onChange) {
  let _v = initial;
  return {
    get value() {
      return _v;
    },
    set value(v) {
      _v = v;
      onChange();
    }
  };
}
function createEventEmitter() {
  const listeners = /* @__PURE__ */ new Map();
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, /* @__PURE__ */ new Set());
      listeners.get(event).add(handler);
      return () => {
        listeners.get(event)?.delete(handler);
      };
    },
    emit(event, detail) {
      listeners.get(event)?.forEach((fn) => fn(detail));
    }
  };
}
var TOOL_NAME = "typespacing";
var LOG_PREFIX = `[${TOOL_NAME}]`;
var STORAGE_KEY = "typespacing-editor-data";
var OVERLAY_CLASS = "typespacing-overlay";
var CHAR_CLASS = "typespacing-char";
var ACTIVE_CLASS = "typespacing-active";
var MODIFIED_CLASS = "typespacing-modified";
function isAreaModified(area) {
  return area.indent !== 0 || area.kerning.some((k) => k !== 0);
}
function toPersistedData(areas) {
  const data = {};
  areas.forEach((area, selector) => {
    if (isAreaModified(area)) {
      data[selector] = {
        text: area.text,
        kerning: [...area.kerning],
        indent: area.indent,
        font: area.font
      };
    }
  });
  return data;
}
function loadPersistedData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const sanitized = sanitizePersistedKerningData(parsed);
    if (!sanitized) {
      console.warn(`${LOG_PREFIX} Ignoring invalid localStorage data shape.`);
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    if (sanitized.droppedSelectors.length > 0) {
      console.warn(
        `${LOG_PREFIX} Ignoring invalid stored areas: ${sanitized.droppedSelectors.join(", ")}`
      );
      if (Object.keys(sanitized.data).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized.data));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return sanitized.data;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to parse localStorage data.`, error);
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}
function savePersistedData(areas) {
  const data = toPersistedData(areas);
  if (Object.keys(data).length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
function getFontInfo(el) {
  const cs = getComputedStyle(el);
  return {
    family: cs.fontFamily,
    weight: cs.fontWeight,
    size: cs.fontSize
  };
}
function getCharSpans(el) {
  return Array.from(el.querySelectorAll(`.${CHAR_CLASS}`));
}
function wrapText(el, kerning, indent = 0) {
  const { brPositions } = wrapElementWithKerning(el, kerning, {
    indent,
    spanClassName: CHAR_CLASS
  });
  return { brPositions };
}
function collectBreakPositions(el) {
  const brPositions = [];
  let spanIndex = 0;
  function walk(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const childEl = child;
      if (childEl.tagName === "BR") {
        brPositions.push(spanIndex);
        continue;
      }
      if (childEl.tagName === "SPAN" && childEl.classList.contains(CHAR_CLASS)) {
        spanIndex++;
      }
      walk(childEl);
    }
  }
  walk(el);
  return brPositions;
}
function restoreOriginalText(el, originalHTML) {
  el.innerHTML = originalHTML;
}
var INLINE_TAGS = /* @__PURE__ */ new Set([
  "A",
  "SPAN",
  "EM",
  "STRONG",
  "B",
  "I",
  "SMALL",
  "MARK",
  "ABBR",
  "CODE",
  "TIME",
  "SUB",
  "SUP"
]);
function isInlineContent(el) {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (tag === "BR") continue;
      if (INLINE_TAGS.has(tag) && isInlineContent(node)) continue;
      return false;
    }
  }
  return true;
}
function isTextLeaf(el) {
  const text = el.textContent || "";
  if (text.trim().length < 2) return false;
  return isInlineContent(el);
}
function isOurWrapped(el) {
  const wrapped = getSingleCharSpans(el);
  if (!wrapped) return false;
  return wrapped.every((span) => span.classList.contains(CHAR_CLASS));
}
function generateSelector(el) {
  const parts = [];
  let current = el;
  while (current && current !== document.documentElement) {
    if (current === document.body) {
      parts.unshift("body");
      break;
    }
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }
    let part = current.tagName.toLowerCase();
    const classes = Array.from(current.classList).filter((c) => !c.startsWith("typespacing-"));
    if (classes.length) {
      part += classes.map((c) => `.${CSS.escape(c)}`).join("");
    }
    if (current.parentElement) {
      const sameTag = Array.from(current.parentElement.children).filter((s) => s.tagName === current.tagName);
      if (sameTag.length > 1) {
        const idx = Array.from(current.parentElement.children).indexOf(current) + 1;
        part += `:nth-child(${idx})`;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  const full = parts.join(" > ");
  for (let i = parts.length - 1; i >= 0; i--) {
    const short = parts.slice(i).join(" > ");
    try {
      if (document.querySelectorAll(short).length === 1) return short;
    } catch {
    }
  }
  return full;
}
function isLineBreakBetween(left, right) {
  const verticalOverlap = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
  return verticalOverlap < Math.min(left.height, right.height) * 0.5;
}
function getSpanRect(spans, index) {
  const span = spans[index];
  if (!span) return null;
  return span.getBoundingClientRect();
}
function findGapIndex(spans, clientX, clientY) {
  if (spans.length < 1) return -1;
  const rects = spans.map((span) => span.getBoundingClientRect());
  if (rects.length === 0) return -1;
  let bestLineY = Infinity;
  let bestLineDist = Infinity;
  for (const r of rects) {
    const midY = (r.top + r.bottom) / 2;
    const dist = Math.abs(clientY - midY);
    if (dist < bestLineDist) {
      bestLineDist = dist;
      bestLineY = midY;
    }
  }
  const lineThreshold = (rects[0]?.height ?? 0) * 0.5;
  const onLine = (r) => Math.abs((r.top + r.bottom) / 2 - bestLineY) < lineThreshold;
  let closest = -1;
  let minDist = Infinity;
  for (let i = 0; i < spans.length; i++) {
    const rect = rects[i];
    if (!rect) continue;
    if (onLine(rect)) {
      const dist = Math.abs(clientX - rect.left);
      if (dist < minDist) {
        minDist = dist;
        closest = i - 1;
      }
      break;
    }
  }
  for (let i = 0; i < spans.length - 1; i++) {
    const currentRect = rects[i];
    const nextRect = rects[i + 1];
    if (!currentRect || !nextRect || !onLine(currentRect)) continue;
    if (!onLine(nextRect)) {
      const dist2 = Math.abs(clientX - currentRect.right);
      if (dist2 < minDist) {
        minDist = dist2;
        closest = i;
      }
      continue;
    }
    const gapX = (currentRect.right + nextRect.left) / 2;
    const dist = Math.abs(clientX - gapX);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  const lastIdx = spans.length - 1;
  const lastRect = rects[lastIdx];
  if (lastRect && onLine(lastRect)) {
    const dist = Math.abs(clientX - lastRect.right);
    if (dist < minDist) closest = lastIdx;
  }
  return closest;
}
function getGapRect(spans, gapIndex) {
  if (spans.length === 0) return null;
  if (gapIndex === -1) {
    const r = getSpanRect(spans, 0);
    if (!r) return null;
    return { x: r.left, y: r.top, h: r.height };
  }
  if (gapIndex === spans.length - 1) {
    const r = getSpanRect(spans, spans.length - 1);
    if (!r) return null;
    return { x: r.right, y: r.top, h: r.height };
  }
  const left = getSpanRect(spans, gapIndex);
  const right = getSpanRect(spans, gapIndex + 1);
  if (!left || !right) return null;
  if (isLineBreakBetween(left, right)) {
    return { x: right.left, y: right.top, h: right.height };
  }
  return {
    x: (left.right + right.left) / 2,
    y: Math.min(left.top, right.top),
    h: Math.max(left.bottom, right.bottom) - Math.min(left.top, right.top)
  };
}
function getGapPositions(spans) {
  const positions = [];
  for (let gapIndex = -1; gapIndex < spans.length; gapIndex++) {
    const rect = getGapRect(spans, gapIndex);
    if (!rect) continue;
    positions.push({ gapIndex, x: rect.x, y: rect.y });
  }
  return positions;
}
function moveCursorVertically(spans, currentGap, direction) {
  const positions = getGapPositions(spans);
  const current = positions.find((pos) => pos.gapIndex === currentGap);
  if (!current) return currentGap;
  const lineThreshold = 4;
  const directional = positions.filter(
    (pos) => direction === "up" ? pos.y < current.y - lineThreshold : pos.y > current.y + lineThreshold
  );
  if (directional.length === 0) return currentGap;
  const nearestLineY = direction === "up" ? Math.max(...directional.map((pos) => pos.y)) : Math.min(...directional.map((pos) => pos.y));
  const lineCandidates = directional.filter((pos) => Math.abs(pos.y - nearestLineY) <= lineThreshold);
  return lineCandidates.reduce((best, pos) => {
    const bestDist = Math.abs(best.x - current.x);
    const nextDist = Math.abs(pos.x - current.x);
    return nextDist < bestDist ? pos : best;
  }).gapIndex;
}
function createKerningPlugin() {
  const emitter = createEventEmitter();
  let loadTimerId = 0;
  const enabled = valueBox(false);
  const compareMode = valueBox(false);
  const showGapMarkers = watchedValueBox(false, () => updateGapMarkers());
  const areas = valueBox(/* @__PURE__ */ new Map());
  const activeSelector = valueBox(null);
  const cursorGap = valueBox(-2);
  const cursorGapEnd = valueBox(null);
  const cursorRect = valueBox(null);
  const selectionRange = valueBox(null);
  const cursorValue = valueBox(0);
  const gapMarkers = valueBox([]);
  const modifiedCount = {
    get value() {
      return Array.from(areas.value.values()).filter((area) => isAreaModified(area)).length;
    },
    set value(_) {
    }
  };
  function hasSelection() {
    return cursorGapEnd.value !== null && cursorGapEnd.value !== cursorGap.value;
  }
  function getSelectionBounds() {
    if (cursorGapEnd.value === null) return null;
    const a = cursorGap.value, b = cursorGapEnd.value;
    return a <= b ? [a, b] : [b, a];
  }
  function collapseSelection(side) {
    if (!hasSelection()) return;
    const bounds = getSelectionBounds();
    if (!bounds) return;
    cursorGap.value = side === "start" ? bounds[0] : bounds[1];
    cursorGapEnd.value = null;
  }
  function deactivate() {
    if (activeSelector.value) {
      const area = areas.value.get(activeSelector.value);
      if (area) area.el.classList.remove(ACTIVE_CLASS);
    }
    activeSelector.value = null;
    cursorGap.value = -2;
    cursorGapEnd.value = null;
    cursorRect.value = null;
    selectionRange.value = null;
    cursorValue.value = 0;
    updateGapMarkers();
  }
  function updateCursor() {
    const selector = activeSelector.value;
    const gap = cursorGap.value;
    if (!selector || gap < -1) {
      cursorRect.value = null;
      selectionRange.value = null;
      cursorValue.value = 0;
      return;
    }
    const area = areas.value.get(selector);
    if (!area) return;
    const spans = getCharSpans(area.el);
    if (hasSelection()) {
      const bounds = getSelectionBounds();
      const rects = [];
      for (let i = bounds[0]; i <= bounds[1]; i++) {
        const r = getGapRect(spans, i);
        if (r) rects.push(r);
      }
      selectionRange.value = rects.length > 0 ? { rects } : null;
      cursorRect.value = null;
      let sum = 0;
      let count = 0;
      for (let i = bounds[0]; i <= bounds[1]; i++) {
        sum += i === -1 ? area.indent : area.kerning[i] ?? 0;
        count++;
      }
      cursorValue.value = count > 0 ? Math.round(sum / count) : 0;
    } else {
      selectionRange.value = null;
      cursorRect.value = getGapRect(spans, gap);
      cursorValue.value = gap === -1 ? area.indent : area.kerning[gap] ?? 0;
    }
    updateGapMarkers();
  }
  function updateGapMarkers() {
    if (!showGapMarkers.value) {
      gapMarkers.value = [];
      return;
    }
    const markers = [];
    areas.value.forEach((area) => {
      if (!isAreaModified(area)) return;
      const spans = getCharSpans(area.el);
      if (area.indent !== 0) {
        const r = getGapRect(spans, -1);
        if (r) markers.push({ ...r, value: area.indent });
      }
      area.kerning.forEach((k, i) => {
        if (k === 0) return;
        const r = getGapRect(spans, i);
        if (r) markers.push({ ...r, value: k });
      });
    });
    gapMarkers.value = markers;
  }
  function applyAreaPreview(area) {
    const spans = getCharSpans(area.el);
    if (compareMode.value) {
      applyKerningToSpans(spans, new Array(area.kerning.length).fill(0), 0);
      return;
    }
    applyKerningToSpans(spans, area.kerning, area.indent);
  }
  function applyPreviewToAllAreas() {
    areas.value.forEach((area) => applyAreaPreview(area));
  }
  function setCompareMode(next) {
    if (compareMode.value === next) return;
    compareMode.value = next;
    applyPreviewToAllAreas();
    updateCursor();
  }
  function toggleCompareMode() {
    setCompareMode(!compareMode.value);
  }
  function ensureEditableArea(textEl, selector) {
    if (textEl.tagName === "SPAN") {
      console.warn(
        `${LOG_PREFIX} Target element is a <span>: "${selector}". Wrapping may produce nested spans. Consider using a block-level element (e.g. <p>, <div>, <h1>) as the kerning target.`
      );
    }
    if (getSingleCharSpans(textEl) && !isOurWrapped(textEl)) {
      const imported = extractKerningFromWrapped(textEl);
      if (!imported) return;
      const font = getFontInfo(textEl);
      const originalHTML = textEl.innerHTML;
      const kerning = normalizeKerningForText(imported.kerning, imported.text);
      const { brPositions } = wrapText(textEl, kerning, imported.indent);
      textEl.classList.add(MODIFIED_CLASS);
      areas.value.set(selector, {
        selector,
        el: textEl,
        text: imported.text,
        originalHTML,
        kerning,
        indent: imported.indent,
        font,
        brPositions
      });
    }
    if (!isOurWrapped(textEl)) {
      const text = collectKerningText(textEl);
      const originalHTML = textEl.innerHTML;
      const kerning = normalizeKerningForText([], text);
      const font = getFontInfo(textEl);
      const { brPositions } = wrapText(textEl, kerning);
      areas.value.set(selector, {
        selector,
        el: textEl,
        text,
        originalHTML,
        kerning,
        indent: 0,
        font,
        brPositions
      });
    }
  }
  function findTextElement(target) {
    const isIgnored = (el) => !!el.closest("[data-typespacing-ignore]");
    const charSpan = target.closest(`.${CHAR_CLASS}`);
    if (charSpan) {
      let container = charSpan.parentElement;
      while (container && INLINE_TAGS.has(container.tagName)) {
        container = container.parentElement;
      }
      if (container) return container;
    }
    if (isTextLeaf(target) && !isIgnored(target)) {
      return target;
    }
    let current = target;
    while (current && current !== document.body) {
      if (!isIgnored(current) && (isTextLeaf(current) || isOurWrapped(current))) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }
  function onClick(e) {
    if (!enabled.value) return;
    const rawTarget = e.target;
    const target = rawTarget.nodeType === Node.TEXT_NODE ? rawTarget.parentElement : rawTarget;
    if (!target) return;
    if (target.closest(`.${OVERLAY_CLASS}`) || target.closest("svg")) return;
    e.preventDefault();
    e.stopPropagation();
    const textEl = findTextElement(target);
    if (!textEl) {
      deactivate();
      return;
    }
    const selector = generateSelector(textEl);
    ensureEditableArea(textEl, selector);
    const currentArea = areas.value.get(selector);
    if (currentArea) applyAreaPreview(currentArea);
    if (activeSelector.value && activeSelector.value !== selector) {
      const prev = areas.value.get(activeSelector.value);
      if (prev) prev.el.classList.remove(ACTIVE_CLASS);
    }
    textEl.classList.add(ACTIVE_CLASS);
    const clickedGap = findGapIndex(getCharSpans(textEl), e.clientX, e.clientY);
    if (e.shiftKey && activeSelector.value === selector && cursorGap.value >= -1) {
      cursorGapEnd.value = clickedGap;
    } else {
      activeSelector.value = selector;
      cursorGap.value = clickedGap;
      cursorGapEnd.value = null;
    }
    updateCursor();
    emitter.emit("select", {
      selector: activeSelector.value,
      gapIndex: cursorGap.value,
      gapIndexEnd: cursorGapEnd.value
    });
  }
  function onKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      enabled.value = !enabled.value;
      if (enabled.value) {
        emitter.emit("enable", void 0);
      } else {
        setCompareMode(false);
        deactivate();
        emitter.emit("disable", void 0);
      }
      return;
    }
    if (!enabled.value) return;
    if (e.key === "Escape") {
      deactivate();
      return;
    }
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const selector = activeSelector.value;
      if (!selector || cursorGap.value < -1) return;
      e.preventDefault();
      e.stopPropagation();
      const area = areas.value.get(selector);
      if (!area) return;
      const step = e.metaKey || e.ctrlKey ? 100 : 10;
      const delta = e.key === "ArrowRight" ? step : -step;
      const spans = getCharSpans(area.el);
      const bounds = getSelectionBounds();
      if (bounds) {
        for (let i = bounds[0]; i <= bounds[1]; i++) {
          if (i === -1) {
            area.indent += delta;
          } else {
            area.kerning[i] = (area.kerning[i] ?? 0) + delta;
          }
        }
      } else {
        const idx = cursorGap.value;
        if (idx === -1) {
          area.indent += delta;
        } else {
          area.kerning[idx] = (area.kerning[idx] ?? 0) + delta;
        }
      }
      applyKerningToSpans(spans, area.kerning, area.indent);
      if (compareMode.value) {
        applyKerningToSpans(spans, new Array(area.kerning.length).fill(0), 0);
      }
      area.el.classList.add(MODIFIED_CLASS);
      updateCursor();
      savePersistedData(areas.value);
      emitter.emit("change", { selector, kerning: [...area.kerning], indent: area.indent });
      return;
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Tab") && activeSelector.value && cursorGap.value >= -1) {
      e.preventDefault();
      const area = areas.value.get(activeSelector.value);
      if (!area) return;
      const minGap = -1;
      const maxGap = area.kerning.length - 1;
      const back = e.key === "ArrowLeft" || e.key === "Tab" && e.shiftKey;
      if (e.shiftKey && e.key !== "Tab") {
        const end = cursorGapEnd.value ?? cursorGap.value;
        const next = back ? end > minGap ? end - 1 : end : end < maxGap ? end + 1 : end;
        cursorGapEnd.value = next;
      } else if (hasSelection() && !e.shiftKey) {
        collapseSelection(back ? "start" : "end");
      } else {
        cursorGap.value = back ? cursorGap.value > minGap ? cursorGap.value - 1 : maxGap : cursorGap.value < maxGap ? cursorGap.value + 1 : minGap;
      }
      updateCursor();
      return;
    }
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && activeSelector.value && cursorGap.value >= -1 && !e.altKey) {
      e.preventDefault();
      const area = areas.value.get(activeSelector.value);
      if (!area) return;
      const spans = getCharSpans(area.el);
      cursorGap.value = moveCursorVertically(spans, cursorGap.value, e.key === "ArrowUp" ? "up" : "down");
      updateCursor();
      return;
    }
    if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleCompareMode();
    }
  }
  function onScrollOrResize() {
    if (cursorRect.value || selectionRange.value) updateCursor();
    else updateGapMarkers();
  }
  function exportJSON() {
    const exportAreas = [];
    areas.value.forEach((area) => {
      if (!isAreaModified(area)) return;
      exportAreas.push({
        selector: area.selector,
        text: area.text,
        font: area.font,
        indent: area.indent,
        kerning: [...area.kerning]
      });
    });
    return {
      version: KERNING_FORMAT_VERSION,
      exported: (/* @__PURE__ */ new Date()).toISOString(),
      page: location.pathname,
      areas: exportAreas
    };
  }
  function resetAll() {
    areas.value.forEach((area) => {
      area.el.classList.remove(ACTIVE_CLASS, MODIFIED_CLASS);
      restoreOriginalText(area.el, area.originalHTML);
    });
    areas.value.clear();
    setCompareMode(false);
    deactivate();
    localStorage.removeItem(STORAGE_KEY);
    emitter.emit("reset", void 0);
  }
  function load() {
    const data = loadPersistedData();
    for (const [selector, info] of Object.entries(data)) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const indent = info.indent ?? 0;
      const existingSpans = getSingleCharSpans(el);
      const isOurs = existingSpans?.every((s) => s.classList.contains(CHAR_CLASS));
      if (existingSpans && isOurs) {
        const originalHTML = el.innerHTML;
        const kerning = normalizeKerning(info.kerning, existingSpans.length);
        applyKerningToSpans(existingSpans, kerning, indent);
        el.classList.add(MODIFIED_CLASS);
        const brPositions = collectBreakPositions(el);
        areas.value.set(selector, {
          selector,
          el,
          text: info.text,
          originalHTML,
          kerning,
          indent,
          font: info.font,
          brPositions
        });
      } else {
        const text = collectKerningText(el);
        if (text !== info.text) continue;
        const originalHTML = el.innerHTML;
        const kerning = normalizeKerningForText(info.kerning, text);
        const { brPositions } = wrapText(el, kerning, indent);
        el.classList.add(MODIFIED_CLASS);
        areas.value.set(selector, {
          selector,
          el,
          text,
          originalHTML,
          kerning,
          indent,
          font: info.font,
          brPositions
        });
      }
    }
  }
  return {
    name: TOOL_NAME,
    on: emitter.on,
    enabled,
    compareMode,
    areas,
    activeSelector,
    cursorGap,
    cursorGapEnd,
    cursorRect,
    selectionRange,
    cursorValue,
    showGapMarkers,
    gapMarkers,
    modifiedCount,
    exportJSON,
    toggleCompareMode,
    resetAll,
    mount() {
      loadTimerId = window.setTimeout(load, 0);
      window.addEventListener("click", onClick, true);
      window.addEventListener("keydown", onKeydown, true);
      window.addEventListener("scroll", onScrollOrResize, true);
      window.addEventListener("resize", onScrollOrResize);
    },
    unmount() {
      window.clearTimeout(loadTimerId);
      deactivate();
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeydown, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      const wasEnabled = enabled.value;
      enabled.value = false;
      setCompareMode(false);
      if (wasEnabled) emitter.emit("disable", void 0);
    }
  };
}

// src/kerningUI.ts
var EDITOR_CLASS_PREFIX = "typespacing";
function editorClass(name) {
  return `${EDITOR_CLASS_PREFIX}-${name}`;
}
function mergeSelectionRects(rects) {
  if (rects.length === 0) return [];
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  let cur = { x: sorted[0].x, y: sorted[0].y, w: 0, h: sorted[0].h };
  for (const r of sorted) {
    if (Math.abs(r.y - cur.y) > cur.h * 0.5) {
      if (cur.w > 0) rows.push(cur);
      cur = { x: r.x, y: r.y, w: 0, h: r.h };
    }
    const right = Math.max(cur.x + cur.w, r.x);
    cur.x = Math.min(cur.x, r.x);
    cur.w = right - cur.x;
    cur.h = Math.max(cur.h, r.h);
  }
  if (cur.w > 0) rows.push(cur);
  return rows;
}
function createKerningEditor(options = {}) {
  const plugin = createKerningPlugin();
  const locale = options.locale ?? "en";
  const editable = options.editable ?? true;
  const t = editorMessages[locale];
  const rootClass = editorClass("root");
  const cursorClass = editorClass("cursor");
  const valueClass = editorClass("value");
  const selectionClass = editorClass("selection");
  const selectionHighlightClass = editorClass("selection-highlight");
  const areaGuidesClass = editorClass("area-guides");
  const areaGuideClass = editorClass("area-guide");
  const markersClass = editorClass("markers");
  const gapMarkerClass = editorClass("gap-marker");
  const overlayClass = OVERLAY_CLASS;
  const panelClass = editorClass("panel");
  const headerClass = editorClass("header");
  const headingClass = editorClass("heading");
  const bodyClass = editorClass("body");
  const rowClass = editorClass("row");
  const actionsClass = editorClass("actions");
  const buttonClass = editorClass("btn");
  const iconButtonClass = editorClass("icon-btn");
  const helpClass = editorClass("help");
  const toastClass = editorClass("toast");
  let mounted = false;
  let pendingDomReady = null;
  let rafId = 0;
  let copiedTimer = 0;
  let collapsed = false;
  let panelPositioned = false;
  let panelX = 0;
  let panelY = 0;
  let dragPointerId = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let lastAreaGuidesKey = "";
  let lastMarkersKey = "";
  let lastSelectionKey = "";
  const root = document.createElement("div");
  root.className = overlayClass;
  root.setAttribute("data-typespacing-ignore", "true");
  root.innerHTML = `
    <style>
      .${rootClass} { position: fixed; inset: 0; pointer-events: none; z-index: 100000; }
      .${cursorClass} {
        position: fixed;
        width: 2px;
        background: rgba(15,15,15,.95);
        box-shadow: 0 0 0 1px rgba(255,255,255,.85);
        pointer-events: none;
        display: none;
      }
      .${valueClass} {
        position: fixed; transform: translate(-50%, -100%); margin-top: -8px;
        background: #000; color: #fff; border-radius: 4px; padding: 4px 7px;
        font: 500 12px/1 sans-serif; pointer-events: none; white-space: nowrap; display: none;
      }
      .${selectionHighlightClass} {
        position: fixed;
        background: rgba(38, 118, 230, .35);
        pointer-events: none;
      }
      .${areaGuideClass} {
        position: fixed;
        border: 1px solid rgba(255,214,102,.45);
        background: rgba(255,214,102,.08);
        border-radius: 8px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
        pointer-events: none;
      }
      .${gapMarkerClass} {
        position: fixed;
        width: 3px;
        border-radius: 1px;
        pointer-events: none;
        opacity: .7;
        transform: translateX(-1px);
      }
      .${gapMarkerClass}.is-positive { background: #2676e6; }
      .${gapMarkerClass}.is-negative { background: #e05050; }
      .${panelClass} {
        position: fixed;
        min-width: 312px;
        max-width: min(360px, calc(100vw - 24px));
        pointer-events: auto;
        background: rgba(28,28,30,.96);
        color: rgba(255,255,255,.82);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 14px;
        box-shadow: 0 18px 56px rgba(0,0,0,.34);
        font: 500 12px/1.4 sans-serif;
        overflow: hidden;
        user-select: none;
        backdrop-filter: blur(14px);
      }
      .${panelClass}.is-dragging { box-shadow: 0 22px 68px rgba(0,0,0,.4); }
      .${headerClass} {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px 12px;
        background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0));
        cursor: grab;
      }
      .${panelClass}.is-dragging .${headerClass} { cursor: grabbing; }
      .${headingClass} {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .${headingClass} strong {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: .01em;
        color: #fff;
      }
      .${bodyClass} {
        padding: 4px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .${bodyClass}[hidden] { display: none; }
      .${rowClass} { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      .${rowClass} + .${rowClass} { margin-top: 0; }
      .${actionsClass} {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
      }
      .${buttonClass} {
        min-height: 34px;
        width: 100%;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 9px;
        background: rgba(255,255,255,.03);
        color: rgba(255,255,255,.84);
        padding: 8px 10px;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        text-align: center;
      }
      .${iconButtonClass} {
        width: 24px; height: 24px; padding: 0; border: 1px solid rgba(255,255,255,.18); border-radius: 999px;
        background: rgba(255,255,255,.03); color: rgba(255,255,255,.76); cursor: pointer; font: inherit; line-height: 1;
        flex: none;
      }
      .${iconButtonClass}:hover,
      .${buttonClass}:hover:not(:disabled) {
        color: #fff;
        border-color: rgba(255,255,255,.3);
        background: rgba(255,255,255,.08);
      }
      .${buttonClass}:disabled { opacity: .2; cursor: default; }
      .${helpClass} {
        display: block;
        font-size: 11px;
        line-height: 1.55;
        color: rgba(255,255,255,.6);
      }
      .${toastClass} {
        display: none;
        font-size: 11px;
        color: rgba(255,255,255,.72);
        padding-top: 2px;
      }
      .${editorClass("warn")} {
        display: none;
        font-size: 11px;
        line-height: 1.45;
        color: #f5a623;
        padding: 8px 16px;
        border-bottom: 1px solid rgba(255,255,255,.06);
      }
      .${CHAR_CLASS} { display: inline; }
      .${ACTIVE_CLASS} { outline: 1px dashed rgba(255,255,255,.72); outline-offset: 4px; user-select: none; }
      .${ACTIVE_CLASS} ::selection { background: transparent; }
      .${ACTIVE_CLASS} *::selection { background: transparent; }
    </style>
    <div class="${rootClass}">
      <div class="${cursorClass}"></div>
      <div class="${valueClass}"></div>
      <div class="${selectionClass}"></div>
      <div class="${areaGuidesClass}"></div>
      <div class="${markersClass}"></div>
      <div class="${panelClass} js-panel">
        <div class="${headerClass} js-drag-handle">
          <div class="${headingClass}">
            <strong>${plugin.name}</strong>
          </div>
          <button class="${iconButtonClass} js-collapse" type="button" aria-label="${t.collapse}" title="${t.collapse}">\u2212</button>
        </div>
        <div class="${editorClass("warn")} js-warn"></div>
        <div class="${bodyClass} js-panel-body">
          <div class="${rowClass} ${actionsClass}">
            <button class="${buttonClass} js-compare">${t.compare}</button>
            <button class="${buttonClass} js-gaps">${t.guides}</button>
            <button class="${buttonClass} js-export">${t.export}</button>
            <button class="${buttonClass} js-reset">${t.reset}</button>
          </div>
          <div class="${rowClass}">
            <span class="${helpClass}">${t.helpText}</span>
          </div>
          <span class="${toastClass}">${t.copied}</span>
        </div>
      </div>
    </div>
  `;
  const cursorEl = root.querySelector(`.${cursorClass}`);
  const valueEl = root.querySelector(`.${valueClass}`);
  const selectionContainer = root.querySelector(`.${selectionClass}`);
  const areaGuidesContainer = root.querySelector(`.${areaGuidesClass}`);
  const markersContainer = root.querySelector(`.${markersClass}`);
  const panelEl = root.querySelector(".js-panel");
  const panelBodyEl = root.querySelector(".js-panel-body");
  const dragHandleEl = root.querySelector(".js-drag-handle");
  const collapseBtn = root.querySelector(".js-collapse");
  const compareBtn = root.querySelector(".js-compare");
  const gapsBtn = root.querySelector(".js-gaps");
  const exportBtn = root.querySelector(".js-export");
  const resetBtn = root.querySelector(".js-reset");
  const toastEl = root.querySelector(`.${toastClass}`);
  const warnEl = root.querySelector(".js-warn");
  let warnTimer = 0;
  let warnDispose = null;
  function serializeMarkers() {
    return plugin.gapMarkers.value.map((marker) => `${marker.x},${marker.y},${marker.h},${marker.value}`).join("|");
  }
  function serializeAreaGuides() {
    if (!plugin.showGapMarkers.value) return "";
    const guides = [];
    plugin.areas.value.forEach((area) => {
      if (!area.el.classList.contains(MODIFIED_CLASS)) return;
      const rect = area.el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      guides.push(`${rect.left},${rect.top},${rect.width},${rect.height}`);
    });
    return guides.join("|");
  }
  function serializeSelection() {
    const selection = plugin.selectionRange.value;
    if (!selection) return "";
    const rows = mergeSelectionRects(selection.rects);
    return rows.map((row) => `${row.x},${row.y},${row.w},${row.h}`).join("|");
  }
  function syncGapMarkers() {
    const nextKey = serializeMarkers();
    if (nextKey === lastMarkersKey) return;
    lastMarkersKey = nextKey;
    markersContainer.replaceChildren();
    for (const marker of plugin.gapMarkers.value) {
      const el = document.createElement("div");
      el.className = `${gapMarkerClass} ${marker.value > 0 ? "is-positive" : "is-negative"}`;
      el.style.left = `${marker.x}px`;
      el.style.top = `${marker.y}px`;
      el.style.height = `${marker.h}px`;
      markersContainer.appendChild(el);
    }
  }
  function syncAreaGuides() {
    const nextKey = serializeAreaGuides();
    if (nextKey === lastAreaGuidesKey) return;
    lastAreaGuidesKey = nextKey;
    areaGuidesContainer.replaceChildren();
    if (!nextKey) return;
    for (const part of nextKey.split("|")) {
      const [left, top, width, height] = part.split(",").map(Number);
      const el = document.createElement("div");
      el.className = areaGuideClass;
      el.style.left = `${left - 6}px`;
      el.style.top = `${top - 4}px`;
      el.style.width = `${width + 12}px`;
      el.style.height = `${height + 8}px`;
      areaGuidesContainer.appendChild(el);
    }
  }
  function syncSelectionHighlights() {
    const selection = plugin.selectionRange.value;
    const nextKey = serializeSelection();
    if (nextKey === lastSelectionKey) return;
    lastSelectionKey = nextKey;
    selectionContainer.replaceChildren();
    if (!selection) return;
    for (const row of mergeSelectionRects(selection.rects)) {
      const el = document.createElement("div");
      el.className = selectionHighlightClass;
      el.style.left = `${row.x}px`;
      el.style.top = `${row.y}px`;
      el.style.width = `${row.w}px`;
      el.style.height = `${row.h}px`;
      selectionContainer.appendChild(el);
    }
  }
  function clampPanelPosition(x, y) {
    const margin = 12;
    const width = panelEl.offsetWidth || 280;
    const height = panelEl.offsetHeight || 120;
    return {
      x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - width - margin)),
      y: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - height - margin))
    };
  }
  function syncPanelPosition() {
    const next = clampPanelPosition(panelX, panelY);
    panelX = next.x;
    panelY = next.y;
    panelEl.style.left = `${panelX}px`;
    panelEl.style.top = `${panelY}px`;
  }
  function positionPanelDefault() {
    if (!panelPositioned) {
      const rect = panelEl.getBoundingClientRect();
      panelX = window.innerWidth - rect.width - 16;
      panelY = window.innerHeight - rect.height - 16;
      panelPositioned = true;
    }
    syncPanelPosition();
  }
  function setCollapsed(next) {
    collapsed = next;
    panelEl.classList.toggle("is-collapsed", collapsed);
    panelBodyEl.hidden = collapsed;
    const label = collapsed ? t.expand : t.collapse;
    collapseBtn.textContent = collapsed ? "+" : "\u2212";
    collapseBtn.setAttribute("aria-label", label);
    collapseBtn.title = label;
    window.requestAnimationFrame(syncPanelPosition);
  }
  function showWarn(message) {
    warnEl.textContent = message;
    warnEl.style.display = "block";
    clearTimeout(warnTimer);
    warnTimer = window.setTimeout(() => {
      warnEl.style.display = "none";
    }, 5e3);
  }
  function downloadJSON() {
    const data = plugin.exportJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kerning-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toastEl.style.display = "block";
    clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => {
      toastEl.style.display = "none";
    }, 1500);
  }
  function render() {
    const enabled = plugin.enabled.value;
    root.style.display = enabled ? "block" : "none";
    if (!enabled) return;
    const count = plugin.modifiedCount.value;
    compareBtn.style.borderColor = plugin.compareMode.value ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.25)";
    compareBtn.style.color = plugin.compareMode.value ? "#fff" : "rgba(255,255,255,.75)";
    gapsBtn.style.borderColor = plugin.showGapMarkers.value ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.25)";
    gapsBtn.style.color = plugin.showGapMarkers.value ? "#fff" : "rgba(255,255,255,.75)";
    exportBtn.disabled = count === 0;
    resetBtn.disabled = count === 0;
    syncAreaGuides();
    syncGapMarkers();
    const sel = plugin.selectionRange.value;
    syncSelectionHighlights();
    const cursor = plugin.cursorRect.value;
    if (!cursor && !sel) {
      cursorEl.style.display = "none";
      valueEl.style.display = "none";
      return;
    }
    if (cursor) {
      cursorEl.style.display = "block";
      cursorEl.style.left = `${cursor.x}px`;
      cursorEl.style.top = `${cursor.y}px`;
      cursorEl.style.height = `${cursor.h}px`;
    } else {
      cursorEl.style.display = "none";
    }
    if (cursor || sel) {
      valueEl.style.display = "block";
      const anchor = cursor ?? (sel ? sel.rects[0] : null);
      if (anchor) {
        valueEl.style.left = `${anchor.x}px`;
        valueEl.style.top = `${anchor.y}px`;
      }
      const v = plugin.cursorValue.value;
      valueEl.textContent = v > 0 ? `+${v}` : String(v);
    } else {
      valueEl.style.display = "none";
    }
  }
  function loop() {
    render();
    rafId = window.requestAnimationFrame(loop);
  }
  function onResetClick() {
    if (window.confirm(t.confirmReset)) plugin.resetAll();
  }
  function onCompareClick() {
    plugin.toggleCompareMode();
  }
  function onGapsClick() {
    plugin.showGapMarkers.value = !plugin.showGapMarkers.value;
  }
  function onCollapseClick() {
    setCollapsed(!collapsed);
  }
  function onPointerMove(e) {
    if (dragPointerId !== e.pointerId) return;
    panelX = e.clientX - dragOffsetX;
    panelY = e.clientY - dragOffsetY;
    syncPanelPosition();
  }
  function onPointerEnd(e) {
    if (dragPointerId !== e.pointerId) return;
    dragPointerId = null;
    panelEl.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
  }
  function onDragStart(e) {
    const target = e.target;
    if (target.closest("button")) return;
    const rect = panelEl.getBoundingClientRect();
    dragPointerId = e.pointerId;
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    panelEl.classList.add("is-dragging");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
  }
  function onResize() {
    if (mounted && panelPositioned) syncPanelPosition();
  }
  const editor = {
    ...plugin,
    plugin,
    mount() {
      if (document.readyState === "loading") {
        if (!pendingDomReady) {
          pendingDomReady = () => editor.mount();
          document.addEventListener("DOMContentLoaded", pendingDomReady, { once: true });
        }
        return;
      }
      pendingDomReady = null;
      if (!editable) {
        if (options.kerning) applyKerning(options.kerning);
        return;
      }
      if (mounted) return;
      mounted = true;
      if (options.kerning) applyKerning(options.kerning);
      lastAreaGuidesKey = "";
      lastMarkersKey = "";
      lastSelectionKey = "";
      document.body.appendChild(root);
      setCollapsed(false);
      positionPanelDefault();
      dragHandleEl.addEventListener("pointerdown", onDragStart);
      collapseBtn.addEventListener("click", onCollapseClick);
      compareBtn.addEventListener("click", onCompareClick);
      gapsBtn.addEventListener("click", onGapsClick);
      exportBtn.addEventListener("click", downloadJSON);
      resetBtn.addEventListener("click", onResetClick);
      window.addEventListener("resize", onResize);
      warnDispose = plugin.on("select", ({ selector }) => {
        if (!selector) return;
        const el = document.querySelector(selector);
        if (el?.tagName === "SPAN") showWarn(t.warnSpanTarget);
      });
      plugin.mount();
      rafId = window.requestAnimationFrame(loop);
    },
    unmount() {
      if (pendingDomReady) {
        document.removeEventListener("DOMContentLoaded", pendingDomReady);
        pendingDomReady = null;
      }
      if (!editable) {
        return;
      }
      if (!mounted) return;
      mounted = false;
      window.cancelAnimationFrame(rafId);
      clearTimeout(copiedTimer);
      clearTimeout(warnTimer);
      if (warnDispose) {
        warnDispose();
        warnDispose = null;
      }
      plugin.unmount();
      dragHandleEl.removeEventListener("pointerdown", onDragStart);
      collapseBtn.removeEventListener("click", onCollapseClick);
      compareBtn.removeEventListener("click", onCompareClick);
      gapsBtn.removeEventListener("click", onGapsClick);
      exportBtn.removeEventListener("click", downloadJSON);
      resetBtn.removeEventListener("click", onResetClick);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      root.remove();
    }
  };
  return editor;
}
export {
  createKerningEditor
};
