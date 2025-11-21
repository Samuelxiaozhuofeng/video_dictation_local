/**
 * File System Access API and IndexedDB utilities
 * Handles video file references and subtitle storage
 */

// Check if File System Access API is supported
export const isFileSystemAccessSupported = (): boolean => {
  return 'showOpenFilePicker' in window;
};

// IndexedDB setup
const DB_NAME = 'linguaclip_db';
const DB_VERSION = 1;
const STORE_VIDEOS = 'videos';
const STORE_FILE_HANDLES = 'fileHandles';

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
        db.createObjectStore(STORE_VIDEOS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_FILE_HANDLES)) {
        db.createObjectStore(STORE_FILE_HANDLES, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Save video record to IndexedDB
 */
export const saveVideoToDB = async (videoRecord: any): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_VIDEOS], 'readwrite');
    const store = transaction.objectStore(STORE_VIDEOS);
    const request = store.put(videoRecord);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to save video record'));
  });
};

/**
 * Get all video records from IndexedDB
 */
export const getAllVideosFromDB = async (): Promise<any[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_VIDEOS], 'readonly');
    const store = transaction.objectStore(STORE_VIDEOS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error('Failed to get video records'));
  });
};

/**
 * Get a single video record by ID
 */
export const getVideoFromDB = async (id: string): Promise<any | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_VIDEOS], 'readonly');
    const store = transaction.objectStore(STORE_VIDEOS);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to get video record'));
  });
};

/**
 * Delete video record from IndexedDB
 */
export const deleteVideoFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_VIDEOS], 'readwrite');
    const store = transaction.objectStore(STORE_VIDEOS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete video record'));
  });
};

/**
 * Save file handle to IndexedDB (for File System Access API)
 */
export const saveFileHandle = async (id: string, handle: FileSystemFileHandle): Promise<void> => {
  if (!isFileSystemAccessSupported()) return;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FILE_HANDLES], 'readwrite');
    const store = transaction.objectStore(STORE_FILE_HANDLES);
    const request = store.put({ id, handle });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to save file handle'));
  });
};

/**
 * Get file handle from IndexedDB
 */
export const getFileHandle = async (id: string): Promise<FileSystemFileHandle | null> => {
  if (!isFileSystemAccessSupported()) return null;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FILE_HANDLES], 'readonly');
    const store = transaction.objectStore(STORE_FILE_HANDLES);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result?.handle || null);
    request.onerror = () => reject(new Error('Failed to get file handle'));
  });
};

/**
 * Request file access and get File object from handle
 */
export const getFileFromHandle = async (handle: FileSystemFileHandle): Promise<File | null> => {
  try {
    // Request permission if needed
    const permission = await handle.queryPermission({ mode: 'read' });
    if (permission === 'denied') {
      return null;
    }

    return await handle.getFile();
  } catch (error) {
    console.error('Failed to get file from handle:', error);
    return null;
  }
};

