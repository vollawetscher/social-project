/**
 * Local Storage Service for Offline Recordings
 * Stores audio recordings in IndexedDB until user is ready to upload
 */

export interface LocalRecording {
  id: string
  blob: Blob
  duration: number
  timestamp: number
  mimeType: string
  size: number
}

const DB_NAME = 'gespraechsbericht-recordings'
const STORE_NAME = 'recordings'
const DB_VERSION = 1

class LocalStorageService {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async saveRecording(recording: LocalRecording): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(recording)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getAllRecordings(): Promise<LocalRecording[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async getRecording(id: string): Promise<LocalRecording | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteRecording(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getTotalSize(): Promise<number> {
    const recordings = await this.getAllRecordings()
    return recordings.reduce((total, rec) => total + rec.size, 0)
  }

  async getRecordingCount(): Promise<number> {
    const recordings = await this.getAllRecordings()
    return recordings.length
  }
}

export const localStorageService = new LocalStorageService()
