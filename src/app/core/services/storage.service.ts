import { Injectable } from '@angular/core';

const PREFIX = 'pmpro_';

@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string): T | null {
    try {
      const val = localStorage.getItem(PREFIX + key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  }

  getSession<T>(key: string): T | null {
    try {
      const val = sessionStorage.getItem(PREFIX + key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  }

  setSession<T>(key: string, value: T): void {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  removeSession(key: string): void {
    sessionStorage.removeItem(PREFIX + key);
  }
}
