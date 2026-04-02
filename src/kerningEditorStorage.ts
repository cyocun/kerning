import type { KerningExport } from './applyKerning'
import { sanitizePersistedKerningData, type PersistedKerningArea } from './validation'

export const TOOL_NAME = 'visual kerning'
export const LOG_PREFIX = '[visual-kerning]'
export const STORAGE_KEY = 'visual-kerning-editor-data'
const LEGACY_STORAGE_KEY = 'typespacing-editor-data'

type StorageName = 'localStorage' | 'sessionStorage'
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

interface StorageBackend {
  name: StorageName
  storage: StorageLike
}

let cachedStorageBackend: StorageBackend | null | undefined

function probeStorageBackend(name: StorageName): StorageBackend | null {
  try {
    const storage = window[name]
    const probeKey = `${STORAGE_KEY}::__probe__`
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    return { name, storage }
  } catch (error) {
    console.warn(`${LOG_PREFIX} ${name} is unavailable.`, error)
    return null
  }
}

function fallbackToSessionStorage(reason: unknown): StorageBackend | null {
  const fallback = probeStorageBackend('sessionStorage')
  if (!fallback) {
    cachedStorageBackend = null
    console.warn(
      `${LOG_PREFIX} Web storage is unavailable. Kerning changes will not persist across reloads.`,
      reason,
    )
    return null
  }
  cachedStorageBackend = fallback
  console.warn(
    `${LOG_PREFIX} Falling back to sessionStorage. Kerning data will reset when the tab closes.`,
    reason,
  )
  return fallback
}

function getStorageBackend(): StorageBackend | null {
  if (cachedStorageBackend !== undefined) return cachedStorageBackend

  const local = probeStorageBackend('localStorage')
  if (local) {
    cachedStorageBackend = local
    return local
  }

  const session = probeStorageBackend('sessionStorage')
  if (session) {
    cachedStorageBackend = session
    console.warn(`${LOG_PREFIX} Falling back to sessionStorage. Kerning data will reset when the tab closes.`)
    return session
  }

  cachedStorageBackend = null
  console.warn(`${LOG_PREFIX} Web storage is unavailable. Kerning changes will not persist across reloads.`)
  return null
}

function readPersistedRaw(): string | null {
  const backend = getStorageBackend()
  if (!backend) return null

  try {
    const current = backend.storage.getItem(STORAGE_KEY)
    if (current !== null) return current

    const legacy = backend.storage.getItem(LEGACY_STORAGE_KEY)
    if (legacy !== null) {
      backend.storage.setItem(STORAGE_KEY, legacy)
      backend.storage.removeItem(LEGACY_STORAGE_KEY)
      return legacy
    }

    return null
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to read ${backend.name} data.`, error)
    if (backend.name === 'localStorage') {
      const fallback = fallbackToSessionStorage(error)
      if (!fallback) return null
      try {
        const current = fallback.storage.getItem(STORAGE_KEY)
        if (current !== null) return current

        const legacy = fallback.storage.getItem(LEGACY_STORAGE_KEY)
        if (legacy !== null) {
          fallback.storage.setItem(STORAGE_KEY, legacy)
          fallback.storage.removeItem(LEGACY_STORAGE_KEY)
          return legacy
        }

        return null
      } catch (fallbackError) {
        console.warn(`${LOG_PREFIX} Failed to read sessionStorage data.`, fallbackError)
      }
    }
    return null
  }
}

function writePersistedRaw(raw: string | null) {
  let backend = getStorageBackend()
  if (!backend) return

  try {
    if (raw === null) {
      backend.storage.removeItem(STORAGE_KEY)
      backend.storage.removeItem(LEGACY_STORAGE_KEY)
    } else {
      backend.storage.setItem(STORAGE_KEY, raw)
      backend.storage.removeItem(LEGACY_STORAGE_KEY)
    }
    return
  } catch (error) {
    if (backend.name === 'localStorage') {
      backend = fallbackToSessionStorage(error)
      if (!backend) return
      try {
        if (raw === null) {
          backend.storage.removeItem(STORAGE_KEY)
          backend.storage.removeItem(LEGACY_STORAGE_KEY)
        } else {
          backend.storage.setItem(STORAGE_KEY, raw)
          backend.storage.removeItem(LEGACY_STORAGE_KEY)
        }
        return
      } catch (fallbackError) {
        console.warn(`${LOG_PREFIX} Failed to write sessionStorage data.`, fallbackError)
      }
    }

    console.warn(`${LOG_PREFIX} Failed to persist kerning data.`, error)
  }
}

export function removePersistedData() {
  writePersistedRaw(null)
}

function writePersistedData(data: Record<string, PersistedKerningArea>) {
  writePersistedRaw(Object.keys(data).length > 0 ? JSON.stringify(data) : null)
}

export function seedPersistedKerningData(data: KerningExport) {
  const persisted: Record<string, PersistedKerningArea> = {}
  for (const area of data.areas) {
    persisted[area.selector] = {
      text: area.text,
      kerning: [...area.kerning],
      indent: area.indent,
      font: { ...area.font },
    }
  }
  writePersistedData(persisted)
}

export function loadPersistedData(): Record<string, PersistedKerningArea> {
  const raw = readPersistedRaw()
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown
    const sanitized = sanitizePersistedKerningData(parsed)
    if (!sanitized) {
      console.warn(`${LOG_PREFIX} Ignoring invalid localStorage data shape.`)
      removePersistedData()
      return {}
    }

    if (sanitized.droppedSelectors.length > 0) {
      console.warn(`${LOG_PREFIX} Ignoring invalid stored areas: ${sanitized.droppedSelectors.join(', ')}`)
      writePersistedData(sanitized.data)
    }

    return sanitized.data
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to parse localStorage data.`, error)
    removePersistedData()
    return {}
  }
}

export function savePersistedData(data: Record<string, PersistedKerningArea>) {
  writePersistedData(data)
}
