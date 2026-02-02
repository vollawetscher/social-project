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
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 100 // ms

/**
 * Retry helper with exponential backoff
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (retries <= 0) {
      throw error
    }
    
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, MAX_RETRIES - retries)
    console.warn(`[LocalStorage] Operation failed, retrying in ${delay}ms (${retries} retries left)`)
    
    await new Promise(resolve => setTimeout(resolve, delay))
    return retryOperation(operation, retries - 1)
  }
}

class LocalStorageService {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return retryOperation(() => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          this.db = request.result
          
          // Handle version change while database is open
          this.db.onversionchange = () => {
            console.warn('[LocalStorage] Database version changed, closing connection')
            this.db?.close()
            this.db = null
          }
          
          resolve()
        }

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
            store.createIndex('timestamp', 'timestamp', { unique: false })
          }
        }

        request.onblocked = () => {
          console.warn('[LocalStorage] Database upgrade blocked, please close other tabs')
          reject(new Error('Database upgrade blocked'))
        }
      })
    })
  }

  async saveRecording(recording: LocalRecording): Promise<void> {
    if (!this.db) await this.init()

    return retryOperation(() => {
      return new Promise<void>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'))
          return
        }

        const transaction = this.db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.add(recording)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        transaction.onerror = () => reject(transaction.error)
      })
    })
  }

  async getAllRecordings(): Promise<LocalRecording[]> {
    if (!this.db) await this.init()

    return retryOperation(() => {
      return new Promise<LocalRecording[]>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'))
          return
        }

        const transaction = this.db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.getAll()

        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
        transaction.onerror = () => reject(transaction.error)
      })
    })
  }

  async getRecording(id: string): Promise<LocalRecording | null> {
    if (!this.db) await this.init()

    return retryOperation(() => {
      return new Promise<LocalRecording | null>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'))
          return
        }

        const transaction = this.db.transaction([STORE_NAME], 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(id)

        request.onsuccess = () => resolve(request.result || null)
        request.onerror = () => reject(request.error)
        transaction.onerror = () => reject(transaction.error)
      })
    })
  }

  async deleteRecording(id: string): Promise<void> {
    if (!this.db) await this.init()

    return retryOperation(() => {
      return new Promise<void>((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'))
          return
        }

        const transaction = this.db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.delete(id)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        transaction.onerror = () => reject(transaction.error)
      })
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
