import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';
import { User } from '../models';
import { MOCK_USERS } from './mock-data';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private storageService = inject(StorageService);
  private routerService = inject(Router);

  private _currentUser = signal<User | null>(null);
  currentUser = this._currentUser.asReadonly();
  isLoggedIn = computed(() => !!this._currentUser());
  isOwner = computed(() => this._currentUser()?.role === 'owner');
  isClient = computed(() => this._currentUser()?.role === 'client');

  constructor() {
    const saved = this.storageService.get<User>('current_user');
    if (saved) this._currentUser.set(saved);
    if (!this.storageService.get('users')) {
      this.storageService.set('users', MOCK_USERS);
    }
  }

  login(username: string, password: string): boolean {
    const users = this.storageService.get<User[]>('users') || MOCK_USERS;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      this._currentUser.set(user);
      this.storageService.set('current_user', user);
      return true;
    }
    return false;
  }

  logout(): void {
    this._currentUser.set(null);
    this.storageService.remove('current_user');
    this.routerService.navigate(['/login']);
  }
}
