const DATABASE_NAME = 'mahjong-layout-tool'
const DATABASE_VERSION = 1
const STORE_NAME = 'layouts'

let databasePromise: Promise<IDBDatabase> | null = null

const openDatabase = () => {
  if (databasePromise) return databasePromise
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDBを開けませんでした'))
  })
  return databasePromise
}

export const readLargeValue = async <T>(key: string): Promise<T | null> => {
  const database = await openDatabase()
  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('保存データを読み込めませんでした'))
  })
}

export const writeLargeValue = async (key: string, value: unknown): Promise<void> => {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(value, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('保存データを書き込めませんでした'))
    transaction.onabort = () => reject(transaction.error ?? new Error('保存処理が中断されました'))
  })
}
