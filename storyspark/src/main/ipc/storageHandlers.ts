import { IpcMain, app } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'

interface Story {
  id?: number
  title: string
  content: string
  genre: string
  length: string
  imageUrl?: string
  createdAt: string
  savedAt?: string
}

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'storyspark.db')
    db = new Database(dbPath)
    initDb(db)
  }
  return db
}

function initDb(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      genre TEXT NOT NULL,
      length TEXT NOT NULL,
      imageUrl TEXT,
      createdAt TEXT NOT NULL,
      savedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

export function registerStorageHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('storage:getFavorites', () => {
    const database = getDb()
    return database.prepare('SELECT * FROM favorites ORDER BY savedAt DESC').all()
  })

  ipcMain.handle('storage:saveFavorite', (_event, story: Story) => {
    const database = getDb()
    const savedAt = new Date().toISOString()
    const result = database.prepare(`
      INSERT INTO favorites (title, content, genre, length, imageUrl, createdAt, savedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(story.title, story.content, story.genre, story.length, story.imageUrl || null, story.createdAt, savedAt)
    return { id: result.lastInsertRowid, ...story, savedAt }
  })

  ipcMain.handle('storage:deleteFavorite', (_event, id: number) => {
    const database = getDb()
    database.prepare('DELETE FROM favorites WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('storage:getFavorite', (_event, id: number) => {
    const database = getDb()
    return database.prepare('SELECT * FROM favorites WHERE id = ?').get(id)
  })
}
