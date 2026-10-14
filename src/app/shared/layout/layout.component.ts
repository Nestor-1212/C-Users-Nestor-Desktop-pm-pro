import { Component, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { interval } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { CompanyService } from '../../core/services/company.service';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';
import { NotificationService } from '../services/notification.service';
import { IconComponent } from '../icon/icon.component';
import { TourService } from '../services/tour.service';
import { InternalRequestService } from '../../core/services/internal-request.service';
import { DepartmentService } from '../../core/services/department.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ReactiveFormsModule, IconComponent],
  template: `
    <div class="app-shell" [class.sidebar-collapsed]="collapsed()" [class.mobile-nav-open]="mobileOpen()">
      @if (mobileOpen()) {
        <div class="sidebar-backdrop" (click)="mobileOpen.set(false)"></div>
      }
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo-area">
            <div class="logo-icon"><img src="/brand/logo-3tech-mark.png" alt="3TECH" width="706" height="504"></div>
            <span class="logo-text">Tikets y Proceso</span>
          </div>
          <button class="collapse-btn" (click)="collapsed.set(!collapsed())" aria-label="Colapsar menú">
            <app-icon [name]="collapsed() ? 'chevron-right' : 'chevron-left'" [size]="14" />
          </button>
        </div>

        <div class="user-card">
          <div class="user-avatar">{{ userInitials() }}</div>
          <div class="user-info">
            <span class="user-name">{{ auth.currentUser()?.name }}</span>
            <span class="user-role">{{ roleLabel() }}</span>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Navegación principal">
          @if (!auth.isCollaborator()) {
          @if (!auth.isTechnician()) {
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-item" aria-label="Dashboard" (click)="mobileOpen.set(false)">
              <span class="nav-icon-wrap"><app-icon name="chart" [size]="18" class="nav-icon" /></span>
              <span class="nav-label">Dashboard</span>
            </a>
          }
          @if (auth.isOwner()) {
            <a routerLink="/companies" routerLinkActive="active" class="nav-item" aria-label="Empresas" (click)="mobileOpen.set(false)">
              <span class="nav-icon-wrap"><app-icon name="building" [size]="18" class="nav-icon" /></span>
              <span class="nav-label">Empresas</span>
            </a>
            <a routerLink="/users" routerLinkActive="active" class="nav-item" aria-label="Usuarios" (click)="mobileOpen.set(false)">
              <span class="nav-icon-wrap"><app-icon name="users" [size]="18" class="nav-icon" /></span>
              <span class="nav-label">Usuarios</span>
            </a>
            <a routerLink="/activity" routerLinkActive="active" class="nav-item" aria-label="Bitácora de actividad" (click)="mobileOpen.set(false)">
              <span class="nav-icon-wrap"><app-icon name="clock" [size]="18" class="nav-icon" /></span>
              <span class="nav-label">Bitácora</span>
            </a>
            <a routerLink="/analytics" routerLinkActive="active" class="nav-item" aria-label="Analíticas" (click)="mobileOpen.set(false)">
              <span class="nav-icon-wrap"><app-icon name="chart" [size]="18" class="nav-icon" /></span>
              <span class="nav-label">Analíticas</span>
            </a>
          }
          <a routerLink="/projects" routerLinkActive="active" class="nav-item" aria-label="Proyectos" (click)="mobileOpen.set(false)">
            <span class="nav-icon-wrap"><app-icon name="folder" [size]="18" class="nav-icon" /></span>
            <span class="nav-label">Proyectos</span>
          </a>
          <a routerLink="/tickets" routerLinkActive="active" class="nav-item"
            [attr.aria-label]="'Tickets' + (openTickets() > 0 ? ', ' + openTickets() + ' abiertos' : '')"
            (click)="mobileOpen.set(false)">
            <span class="nav-icon-wrap">
              <app-icon name="ticket" [size]="18" class="nav-icon" />
              @if (openTickets() > 0) {
                <span class="nav-icon-badge" aria-hidden="true">{{ openTickets() }}</span>
              }
            </span>
            <span class="nav-label">Tickets</span>
          </a>
          @if (auth.isClient()) {
            <a routerLink="/aprende" routerLinkActive="active" class="nav-item" aria-label="Aprende a pedir soporte" (click)="mobileOpen.set(false)">
              <span class="nav-icon-wrap"><app-icon name="lightbulb" [size]="18" class="nav-icon" /></span>
              <span class="nav-label">Aprende</span>
            </a>
          }
          }
          @if (auth.canUseInternal()) {
            <a routerLink="/internas" routerLinkActive="active" class="nav-item"
              [attr.aria-label]="'Solicitudes internas' + (internalPending() > 0 ? ', ' + internalPending() + ' por atender' : '')"
              (click)="mobileOpen.set(false)">
              <span class="nav-icon-wrap">
                <app-icon name="share" [size]="18" class="nav-icon" />
                @if (internalPending() > 0) { <span class="nav-icon-badge" aria-hidden="true">{{ internalPending() }}</span> }
              </span>
              <span class="nav-label">Solicitudes internas</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <button class="logout-btn" (click)="auth.logout()" aria-label="Cerrar sesión">
            <span class="nav-icon-wrap"><app-icon name="log-out" [size]="18" class="nav-icon" /></span>
            <span class="nav-label">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <header class="top-bar">
          <div class="page-title">
            <button class="menu-btn" (click)="mobileOpen.set(!mobileOpen())" aria-label="Abrir menú">
              <app-icon name="menu" [size]="20" />
            </button>
            <h2 class="page-title-text">{{ pageTitle() }}</h2>
          </div>
          <div class="top-bar-right">
            @if (tour.current(); as startGuide) {
              <button class="help-btn" (click)="startGuide()" aria-label="Ver la guía de esta pantalla" title="Ver la guía de esta pantalla">
                <app-icon name="help-circle" [size]="17" /> <span>Guía</span>
              </button>
            }
            <div class="notif-wrap">
              <button class="notif-btn" (click)="notifOpen.set(!notifOpen())" aria-label="Notificaciones"
                [attr.aria-expanded]="notifOpen()">
                <app-icon name="bell" [size]="19" />
                @if (unreadCount() > 0) {
                  <span class="notif-badge" aria-hidden="true">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
                }
              </button>
              @if (notifOpen()) {
                <div class="notif-backdrop" (click)="notifOpen.set(false)"></div>
                <div class="notif-panel" role="menu">
                  <div class="notif-panel-header">
                    <h3>Notificaciones</h3>
                    @if (unreadCount() > 0) {
                      <button type="button" class="notif-mark-all" (click)="markAllRead()">Marcar todas como leídas</button>
                    }
                  </div>
                  <div class="notif-list">
                    @for (n of myNotifications(); track n.id) {
                      <a class="notif-item" [class.unread]="!n.read" [routerLink]="n.link" (click)="openNotification(n.id)">
                        <span class="notif-dot" [class.unread]="!n.read"></span>
                        <div class="notif-item-body">
                          <span class="notif-item-title">{{ n.title }}</span>
                          <span class="notif-item-msg">{{ n.message }}</span>
                          <span class="notif-item-date">{{ n.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                        </div>
                      </a>
                    } @empty {
                      <div class="notif-empty">
                        <app-icon name="bell" [size]="24" />
                        <p>No tienes notificaciones todavía.</p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
            <button type="button" class="account-trigger" (click)="openAccountModal()" aria-label="Mi cuenta">
              <span class="top-user">{{ auth.currentUser()?.name }}</span>
              <div class="user-avatar-sm">{{ userInitials() }}</div>
            </button>
          </div>
        </header>
        <div class="content-area">
          <router-outlet />
        </div>
      </main>
    </div>

    <!-- Mi Cuenta -->
    @if (accountModalOpen()) {
      <div class="modal-overlay" (click)="closeAccountModal()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="account-modal-title">Mi Cuenta</h2>
            <button class="modal-close" (click)="closeAccountModal()" aria-label="Cerrar">
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <div class="modal-body">
            <div class="account-info">
              <div class="user-avatar-sm lg">{{ userInitials() }}</div>
              <div>
                <span class="account-name">{{ auth.currentUser()?.name }}</span>
                <span class="account-email">{{ auth.currentUser()?.email }}</span>
              </div>
            </div>
            <h4 class="account-section-title">Cambiar contraseña</h4>
            <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="password-form">
              <div class="form-group">
                <label for="current-password">Contraseña actual</label>
                <input id="current-password" type="password" formControlName="currentPassword" autocomplete="current-password">
              </div>
              <div class="form-group">
                <label for="new-password">Nueva contraseña</label>
                <input id="new-password" type="password" formControlName="newPassword" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
              </div>
              @if (passwordError()) {
                <div class="alert-error">{{ passwordError() }}</div>
              }
              <div class="modal-footer">
                <button type="button" class="btn-secondary" (click)="closeAccountModal()">Cerrar</button>
                <button type="submit" class="btn-primary" [disabled]="passwordForm.invalid">Actualizar contraseña</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .app-shell { display: flex; height: 100vh; overflow: hidden; }

    .sidebar {
      width: 260px; min-width: 260px;
      background: var(--color-primary-900, #092f5b);
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
      background: #fff; padding: 5px; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .logo-icon img { width: 100%; height: 100%; object-fit: contain; }
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
      background: var(--color-brand-orange, #e99d34);
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
    .nav-item:hover { background: rgba(20,101,197,0.2); color: white; }
    .nav-item.active { background: rgba(20,101,197,0.35); color: #d1e4fa; font-weight: 600; }
    .nav-icon-wrap { position: relative; display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 24px; }
    .nav-icon { flex-shrink: 0; }
    .nav-icon-badge {
      position: absolute; top: -7px; right: -9px;
      background: #ef4444; color: white; border-radius: 10px;
      min-width: 15px; text-align: center; line-height: 1.5;
      padding: 0 3px; font-size: 9px; font-weight: 700;
    }

    .sidebar-footer { padding: 12px 8px; border-top: 1px solid rgba(255,255,255,0.08); }
    .logout-btn {
      width: 100%; display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 8px; border: none;
      background: transparent; color: rgba(255,255,255,0.5);
      font-size: 14px; cursor: pointer; transition: all 0.2s; white-space: nowrap;
    }
    .logout-btn:hover { background: rgba(239,68,68,0.15); color: #fca5a5; }

    .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--color-bg, #f1f5f9); }
    .top-bar {
      height: 60px; background: var(--color-surface, #fff); border-bottom: 1px solid var(--color-border, #e2e8f0);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; flex-shrink: 0;
    }
    .page-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .page-title-text { font-size: 16px; font-weight: 700; color: var(--color-text, #0f172a); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .menu-btn {
      display: none; background: none; border: none; cursor: pointer; color: #64748b;
      width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
      align-items: center; justify-content: center; transition: background 0.15s;
    }
    .menu-btn:hover { background: #f1f5f9; }
    .top-bar-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

    .notif-wrap { position: relative; }
    .help-btn { display: inline-flex; align-items: center; gap: 6px; border: 1.5px solid #c9dbf2; background: #eef4fc; color: #0f4b92; font-weight: 700; font-size: 13px; padding: 7px 12px; border-radius: 999px; cursor: pointer; font-family: inherit; }
    .help-btn:hover { background: #dfeafa; }
    @media (max-width: 600px) { .help-btn span { display: none; } .help-btn { padding: 7px; } }
    .notif-btn {
      position: relative; background: none; border: none; cursor: pointer; color: #64748b;
      width: 36px; height: 36px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; transition: background 0.15s;
    }
    .notif-btn:hover { background: #f1f5f9; }
    .notif-badge {
      position: absolute; top: 3px; right: 3px; background: var(--color-danger-text, #dc2626); color: #fff;
      font-size: 10px; font-weight: 700; line-height: 1; border-radius: 10px;
      min-width: 16px; height: 16px; padding: 0 3px; display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--color-surface, #fff);
    }
    .notif-backdrop { position: fixed; inset: 0; z-index: 110; }
    .notif-panel {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: 120; width: 340px; max-width: 90vw;
      background: var(--color-surface, #fff); border-radius: var(--radius-lg, 14px);
      box-shadow: var(--shadow-modal, 0 20px 60px rgba(0,0,0,0.2)); border: 1px solid var(--color-border, #e2e8f0);
      overflow: hidden; max-height: 420px; display: flex; flex-direction: column;
    }
    .notif-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--color-border, #e2e8f0); }
    .notif-panel-header h3 { font-size: 14px; font-weight: 700; color: var(--color-text, #0f172a); margin: 0; }
    .notif-mark-all { background: none; border: none; cursor: pointer; color: var(--color-primary-700, #0f4b92); font-size: 12px; font-weight: 600; padding: 0; }
    .notif-mark-all:hover { text-decoration: underline; }
    .notif-list { overflow-y: auto; }
    .notif-item { display: flex; gap: 10px; padding: 12px 16px; text-decoration: none; border-bottom: 1px solid #f8fafc; transition: background 0.15s; }
    .notif-item:hover { background: #f8fafc; }
    .notif-item.unread { background: var(--color-primary-50, #e8f1fd); }
    .notif-dot { width: 7px; height: 7px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; background: transparent; }
    .notif-dot.unread { background: var(--color-primary-500, #1465c5); }
    .notif-item-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .notif-item-title { font-size: 13px; font-weight: 700; color: var(--color-text, #0f172a); }
    .notif-item-msg { font-size: 12.5px; color: var(--color-text-secondary, #475569); }
    .notif-item-date { font-size: 11px; color: var(--color-text-muted, #64748b); margin-top: 2px; }
    .notif-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 16px; color: var(--color-text-muted, #64748b); text-align: center; }
    .notif-empty p { margin: 0; font-size: 13px; }
    .top-user { font-size: 14px; color: #475569; font-weight: 500; }
    .user-avatar-sm {
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--color-primary-700, #0f4b92);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 12px; color: white; flex-shrink: 0;
    }
    .user-avatar-sm.lg { width: 48px; height: 48px; font-size: 16px; }
    .account-trigger { display: flex; align-items: center; gap: 10px; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 10px; transition: background 0.15s; }
    .account-trigger:hover { background: #f1f5f9; }
    .account-info { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--color-border, #e2e8f0); }
    .account-info > div { display: flex; flex-direction: column; gap: 2px; }
    .account-name { font-size: 15px; font-weight: 700; color: var(--color-text, #0f172a); }
    .account-email { font-size: 13px; color: var(--color-text-muted, #64748b); }
    .account-section-title { font-size: 13px; font-weight: 700; color: var(--color-text, #0f172a); margin: 0 0 12px; }
    .password-form .form-group { margin-bottom: 14px; }
    .password-form label { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .password-form input {
      width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px;
      font-size: 14px; outline: none; box-sizing: border-box;
    }
    .password-form input:focus { border-color: var(--color-primary-500, #1465c5); }
    .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 4px; }
    .content-area { flex: 1; overflow-y: auto; padding: 24px; }

    .sidebar-backdrop {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5);
      z-index: 90; animation: backdrop-in 0.15s ease;
    }
    @keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }

    @media (max-width: 1024px) {
      .content-area { padding: 20px; }
    }

    @media (max-width: 768px) {
      .menu-btn { display: flex; }
      .collapse-btn { display: none; }

      .sidebar {
        position: fixed; top: 0; left: 0; height: 100vh;
        width: 260px; min-width: 260px;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
      }
      .app-shell.mobile-nav-open .sidebar { transform: translateX(0); }

      .app-shell.sidebar-collapsed .sidebar { width: 260px; min-width: 260px; }
      .app-shell.sidebar-collapsed .logo-text,
      .app-shell.sidebar-collapsed .user-info,
      .app-shell.sidebar-collapsed .nav-label { display: block; }

      .top-bar { padding: 0 16px; }
      .content-area { padding: 16px; }
      .top-user { display: none; }
    }
    @media (max-width: 420px) {
      .page-title-text { font-size: 14px; }
    }
  `]
})
export class LayoutComponent {
  auth = inject(AuthService);
  tour = inject(TourService);
  private ticketService = inject(TicketService);
  private notificationCenter = inject(NotificationCenterService);
  private companyService = inject(CompanyService);
  private internalRequests = inject(InternalRequestService);
  private departments = inject(DepartmentService);
  private notify = inject(NotificationService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  collapsed = signal(false);
  mobileOpen = signal(false);
  pageTitle = signal('');
  notifOpen = signal(false);
  accountModalOpen = signal(false);
  passwordError = signal('');

  passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  myNotifications = this.notificationCenter.items;
  unreadCount = computed(() => this.notificationCenter.unreadCount());

  private static readonly NOTIFICATIONS_REFRESH_MS = 30_000;

  constructor() {
    this.updatePageTitle();
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.updatePageTitle());

    // Datos comunes a toda la app: campana, contador de tickets abiertos y, para clientes, su empresa (logo, tiempo de respuesta).
    // Un colaborador interno no usa nada de clientes: solo la campana y sus solicitudes internas.
    const internal = this.auth.canUseInternal() ? [this.internalRequests.load(), this.departments.load()] : [];
    if (this.auth.isCollaborator()) loadPageData(this.notify, this.notificationCenter.load(), ...internal);
    else loadPageData(this.notify, this.notificationCenter.load(), this.ticketService.load(), this.companyService.load(), ...internal);
    // Refresco periódico silencioso: refleja acciones de otros usuarios sin recargar la página.
    interval(LayoutComponent.NOTIFICATIONS_REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.notificationCenter.load().catch(() => undefined);
        if (this.auth.canUseInternal()) this.internalRequests.load().catch(() => undefined);
      });
  }

  /** Solicitudes que esperan respuesta del departamento del usuario. */
  internalPending = computed(() => this.internalRequests.pendingForMe());

  roleLabel = computed(() => {
    if (this.auth.isOwner()) return 'Administrador';
    if (this.auth.isClient()) return 'Empresa Cliente';
    const dep = this.departments.getById(this.auth.currentUser()?.departmentId)?.name;
    if (this.auth.isTechnician()) return dep && dep !== 'Tecnología' ? `Técnico · ${dep}` : 'Técnico 3TECH';
    return dep ? `Colaborador · ${dep}` : 'Colaborador';
  });

  private updatePageTitle() {
    let r = this.route.firstChild;
    while (r?.firstChild) r = r.firstChild;
    this.pageTitle.set(r?.snapshot?.data?.['title'] ?? '');
  }

  userInitials() {
    const name = this.auth.currentUser()?.name || '';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  openAccountModal() {
    this.passwordForm.reset();
    this.passwordError.set('');
    this.accountModalOpen.set(true);
  }
  closeAccountModal() { this.accountModalOpen.set(false); }

  async changePassword() {
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    const { currentPassword, newPassword } = this.passwordForm.value;
    try {
      await this.auth.changePassword(currentPassword!, newPassword!);
      this.passwordError.set('');
      this.closeAccountModal();
      this.notify.success('Contraseña actualizada correctamente.');
    } catch (err) {
      this.passwordError.set(apiErrorMessage(err));
    }
  }

  markAllRead() {
    this.notificationCenter.markAllRead().catch(err => this.notify.error(apiErrorMessage(err)));
  }

  openNotification(id: string) {
    this.notificationCenter.markRead(id).catch(() => undefined);
    this.notifOpen.set(false);
  }

  openTickets() {
    const user = this.auth.currentUser();
    if (!user) return 0;
    const tickets = this.ticketService.getAll();
    if (user.role === 'technician') {
      // Lo que le toca: sus tickets abiertos más los que nadie ha tomado.
      return tickets.filter(t => t.status === 'open' && (!t.assignedTo || t.assignedTo.id === user.id)).length;
    }
    if (user.role === 'owner') {
      return tickets.filter(t => t.status === 'open').length;
    }
    return tickets.filter(t => t.companyId === user.companyId && t.status === 'open').length;
  }
}
