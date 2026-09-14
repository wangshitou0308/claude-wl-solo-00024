const DB_NAME = 'jiuhao-yange-db';
const DB_VERSION = 1;

export type StoreName = 'contacts' | 'records' | 'rules' | 'marks' | 'photos';

const ALL_STORES: StoreName[] = ['contacts', 'records', 'rules', 'marks', 'photos'];

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ALL_STORES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('无法打开本地数据库'));
    });
  }
  return dbPromise;
}

function request<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('本地数据库操作失败'));
      }),
  );
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return request(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

export function put(store: StoreName, value: unknown): Promise<IDBValidKey> {
  return request(store, 'readwrite', (s) => s.put(value));
}

export function remove(store: StoreName, id: string): Promise<undefined> {
  return request(store, 'readwrite', (s) => s.delete(id));
}

export function clear(store: StoreName): Promise<undefined> {
  return request(store, 'readwrite', (s) => s.clear());
}
