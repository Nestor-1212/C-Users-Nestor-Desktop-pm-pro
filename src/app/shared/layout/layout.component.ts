import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="app-shell" [class.sidebar-collapsed]="collapsed()">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo-area">
            <div class="logo-icon">T·P</div>
            <span class="logo-text">Tikets y Proceso</span>
          </div>
          <button class="collapse-btn" (click)="collapsed.set(!collapsed())">
            <span class="icon">{{ collapsed() ? '→' : '←' }}</span>
          </button>
        </div>

        <div class="user-card">
          <div class="user-avatar">{{ userInitials() }}</div>
          <div class="user-info">
            <span class="user-name">{{ auth.currentUser()?.name }}</span>
            <span class="user-role">{{ auth.isOwner() ? 'Administrador' : 'Empresa Cliente' }}</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">📊</span>
            <span class="nav-label">Dashboard</span>
          </a>
          @if (auth.isOwner()) {
            <a routerLink="/companies" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">🏢</span>
              <span class="nav-label">Empresas</span>
            </a>
          }
          <a routerLink="/projects" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">📁</span>
            <span class="nav-label">Proyectos</span>
          </a>
          <a routerLink="/tickets" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">🎫</span>
            <span class="nav-label">
              Tickets
              @if (openTickets() > 0) {
                <span class="badge">{{ openTickets() }}</span>
              }
            </span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <button class="logout-btn" (click)="auth.logout()">
            <span class="nav-icon">🚪</span>
            <span class="nav-label">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <header class="top-bar">
          <div class="page-title">
            <button class="menu-btn" (click)="collapsed.set(!collapsed())">☰</button>
          </div>
          <div class="top-bar-right">
            <span class="top-user">{{ auth.currentUser()?.name }}</span>
            <div class="user-avatar-sm">{{ userInitials() }}</div>
          </div>
        </header>
        <div class="content-area">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [`
    .app-shell { display: flex; height: 100vh; overflow: hidden; }

    .sidebar {
      width: 260px; min-width: 260px;
      background: #0f1f3d;
      display: flex; flex-direction: column;
      transition: width 0.3s, min-width 0.3s;
      overflow: hidden; z-index: 100;
    }
    .app-shell.sidebar-collapsed .sidebar { width: 70px; min-width: 70px; }
    .app-shell.sidebar-collapsed .logo-text,
    .app-shell.sidebar-collapsed .user-info,
    .app-shell.sidebar-collapsed .nav-label { display: none; }

    .sidebar-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .logo-area { display: flex; align-items: center; gap: 10px; }
    .logo-icon {
      width: 38px; height: 38px; border-radius: 10px;
      background: linear-gradient(135deg, #3b82f6, #1e40af);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 13px; color: white; flex-shrink: 0;
    }
    .logo-text { color: white; font-weight: 700; font-size: 18px; }
    .collapse-btn {
      background: rgba(255,255,255,0.08); border: none; border-radius: 6px;
      color: rgba(255,255,255,0.6); cursor: pointer; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center; font-size: 12px;
    }
    .collapse-btn:hover { background: rgba(255,255,255,0.15); }

    .user-card {
      display: flex; align-items: center; gap: 10px;
      padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .user-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #06b6d4);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px; color: white; flex-shrink: 0;
    }
    .user-name { color: white; font-size: 13px; font-weight: 600; display: block; white-space: nowrap; }
    .user-role { color: rgba(255,255,255,0.5); font-size: 11px; display: block; }

    .sidebar-nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
    .nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 8px;
      color: rgba(255,255,255,0.65); text-decoration: none;
      font-size: 14px; transition: all 0.2s; white-space: nowrap;
    }
    .nav-item:hover { background: rgba(59,130,246,0.15); color: white; }
    .nav-item.active { background: rgba(59,130,246,0.25); color: #93c5fd; font-weight: 600; }
    .nav-icon { font-size: 18px; flex-shrink: 0; width: 24px; text-align: center; }
    .badge {
      background: #ef4444; color: white; border-radius: 10px;
      padding: 1px 7px; font-size: 11px; font-weight: 700; margin-left: 4px;
    }

    .sidebar-footer { padding: 12px 8px; border-top: 1px solid rgba(255,255,255,0.08); }
    .logout-btn {
      width: 100%; display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 8px; border: none;
      background: transparent; color: rgba(255,255,255,0.5);
      font-size: 14px; cursor: pointer; transition: all 0.2s; white-space: nowrap;
    }
    .logout-btn:hover { background: rgba(239,68,68,0.15); color: #fca5a5; }

    .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f1f5f9; }
    .top-bar {
      height: 60px; background: white; border-bottom: 1px solid #e2e8f0;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; flex-shrink: 0;
    }
    .menu-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; }
    .top-bar-right { display: flex; align-items: center; gap: 12px; }
    .top-user { font-size: 14px; color: #475569; font-weight: 500; }
    .user-avatar-sm {
      width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #06b6d4);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 12px; color: white;
    }
    .content-area { flex: 1; overflow-y: auto; padding: 24px; }
  `]
})
export class LayoutComponent {
  auth = inject(AuthService);
  private ticketService = inject(TicketService);
  collapsed = signal(false);

  userInitials() {
    const name = this.auth.currentUser()?.name || '';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  openTickets() {
    const user = this.auth.currentUser();
    if (!user) return 0;
    const tickets = this.ticketService.getAll();
    if (user.role === 'owner') {
      return tickets.filter(t => t.status === 'open').length;
    }
    return tickets.filter(t => t.companyId === user.companyId && t.status === 'open').length;
  }
}
