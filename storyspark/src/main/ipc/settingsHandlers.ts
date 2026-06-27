import { IpcMain, app } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'

interface Settings {
  anthropicApiKey: string
  openaiApiKey: string
  defaultModel: string
  defaultLength: string
  autoImageGen: boolean
  theme: 'light' | 'dark'
  ttsRate: number
  ttsVoice: string
}

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'storyspark.db')
    db = new Database(dbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }
  return db
}

const defaultSettings: Settings = {
  anthropicApiKey: '',
  openaiApiKey: '',
  defaultModel: 'claude-3-haiku-20240307',
  defaultLength: 'medium',
  autoImageGen: false,
  theme: 'dark',
  ttsRate: 1.0,
  ttsVoice: '',
}

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:get', () => {
    const database = getDb()
    const rows = database.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
    const settings = { ...defaultSettings }
    for (const row of rows) {
      const key = row.key as keyof Settings
      const value = row.value
      if (key === 'autoImageGen') {
        (settings as Record<string, unknown>)[key] = value === 'true'
      } else if (key === 'ttsRate') {
        (settings as Record<string, unknown>)[key] = parseFloat(value)
      } else {
        (settings as Record<string, unknown>)[key] = value
      }
    }
    return settings
  })

  ipcMain.handle('settings:save', (_event, settings: Partial<Settings>) => {
    const database = getDb()
    const upsert = database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    const upsertMany = database.transaction((entries: Array<[string, string]>) => {
      for (const [key, value] of entries) {
        upsert.run(key, value)
      }
    })
    const entries = Object.entries(settings).map(([k, v]) => [k, String(v)] as [string, string])
    upsertMany(entries)
    return { success: true }
  })
}
