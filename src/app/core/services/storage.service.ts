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

  clear(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}
