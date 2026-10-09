import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, IconComponent],
  template: `
    <div class="login-page">
      <div class="bg-decor" aria-hidden="true">
        <div class="grid-overlay"></div>
        <div class="orb orb-blue"></div>
        <div class="orb orb-green"></div>
        <div class="orb orb-orange"></div>
      </div>

      <div class="login-card">
        <img class="brand-logo-img" src="/brand/logo-3tech.png" alt="3TECH" width="1204" height="512">

        <div class="login-header">
          <h1>Bienvenido de nuevo</h1>
          <p>Inicia sesión en tu portal de proyectos y tickets</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="form-group">
            <label for="login-username">Usuario</label>
            <div class="input-icon-wrap">
              <app-icon name="user" [size]="16" class="field-icon" />
              <input id="login-username" type="text" formControlName="username" placeholder="Ingresa tu usuario"
                autocomplete="username"
                [class.error]="invalid('username')"
                [attr.aria-invalid]="invalid('username')"
                [attr.aria-describedby]="invalid('username') ? 'login-username-error' : null">
            </div>
            @if (invalid('username')) {
              <span class="field-error" id="login-username-error">El usuario es obligatorio.</span>
            }
          </div>
          <div class="form-group">
            <label for="login-password">Contraseña</label>
            <div class="input-group input-icon-wrap">
              <app-icon name="lock" [size]="16" class="field-icon" />
              <input id="login-password" [type]="showPass() ? 'text' : 'password'" formControlName="password"
                placeholder="Ingresa tu contraseña" autocomplete="current-password"
                [class.error]="invalid('password')"
                [attr.aria-invalid]="invalid('password')"
                [attr.aria-describedby]="invalid('password') ? 'login-password-error' : null">
              <button type="button" class="toggle-pass" (click)="showPass.set(!showPass())"
                [attr.aria-label]="showPass() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <app-icon [name]="showPass() ? 'eye-off' : 'eye'" [size]="18" />
              </button>
            </div>
            @if (invalid('password')) {
              <span class="field-error" id="login-password-error">La contraseña es obligatoria.</span>
            }
          </div>

          <div class="remember-row">
            <label class="remember-check">
              <input type="checkbox" formControlName="remember">
              Mantener sesión iniciada
            </label>
          </div>

          @if (errorMsg()) {
            <div class="alert-error" role="alert" aria-live="assertive">{{ errorMsg() }}</div>
          }

          <button type="submit" class="btn-login" [disabled]="loading()">
            @if (loading()) {
              <span class="spin"><app-icon name="loader" [size]="16" /></span>
              <span>Accediendo...</span>
            } @else {
              <span>Iniciar Sesión</span>
              <app-icon name="chevron-right" [size]="16" />
            }
          </button>
        </form>

        <div class="demo-accounts">
          <p class="demo-title"><app-icon name="alert-triangle" [size]="12" /> Solo para fines de demostración</p>
          <div class="demo-chips">
            <button type="button" class="chip owner" (click)="fillDemo('owner', 'owner123')">
              <app-icon name="crown" [size]="13" /> Propietario
            </button>
            <button type="button" class="chip client" (click)="fillDemo('empresa1', 'emp123')">
              <app-icon name="building" [size]="13" /> TechSolutions
            </button>
            <button type="button" class="chip client" (click)="fillDemo('empresa2', 'emp456')">
              <app-icon name="building" [size]="13" /> InnovaCorp
            </button>
            <button type="button" class="chip client" (click)="fillDemo('empresa3', 'emp789')">
              <app-icon name="building" [size]="13" /> GlobalTech
            </button>
          </div>
        </div>
      </div>

      <p class="page-footer">© {{ currentYear }} 3TECH · Tikets y Proceso</p>
    </div>
  `,
  styles: [`
    .login-page {
      position: relative; min-height: 100vh; overflow: hidden; isolation: isolate;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 20px; padding: 32px 20px; box-sizing: border-box;
      font-family: 'Inter', sans-serif;
      background:
        radial-gradient(circle at 15% 20%, var(--color-primary-500, #1465c5) 0%, transparent 45%),
        radial-gradient(circle at 85% 85%, var(--color-primary-700, #0f4b92) 0%, transparent 50%),
        linear-gradient(160deg, #0a1328 0%, var(--color-primary-900, #092f5b) 45%, var(--color-primary-700, #0f4b92) 100%);
    }

    /* ---------- Decorative backdrop ---------- */
    .bg-decor { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
    .grid-overlay {
      position: absolute; inset: 0;
      background-image: radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px);
      background-size: 26px 26px;
      -webkit-mask-image: radial-gradient(circle at 50% 35%, black, transparent 70%);
      mask-image: radial-gradient(circle at 50% 35%, black, transparent 70%);
    }
    .orb { position: absolute; border-radius: 50%; filter: blur(80px); animation: orb-float 12s ease-in-out infinite; }
    .orb-blue { width: 380px; height: 380px; background: var(--color-primary-500, #1465c5); opacity: 0.45; top: -100px; left: -80px; }
    .orb-green { width: 300px; height: 300px; background: var(--color-brand-green, #a9c238); opacity: 0.22; bottom: -60px; left: 28%; animation-delay: -4s; }
    .orb-orange { width: 260px; height: 260px; background: var(--color-brand-orange, #e99d34); opacity: 0.22; top: 12%; right: -60px; animation-delay: -8s; }
    @keyframes orb-float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(18px, -22px) scale(1.08); }
    }

    /* ---------- Card ---------- */
    .login-card {
      position: relative; z-index: 1; width: 100%; max-width: 400px; box-sizing: border-box;
      background: #fff; border-radius: 24px; padding: 40px 36px 32px;
      box-shadow: 0 24px 60px -20px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.08);
      animation: card-in 0.5s ease both;
    }
    @keyframes card-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

    .brand-logo-img { display: block; height: 52px; width: auto; margin: 0 auto 26px; }

    .login-header { text-align: center; margin-bottom: 26px; }
    .login-header h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 6px; letter-spacing: -0.3px; }
    .login-header p { color: #64748b; font-size: 13.5px; margin: 0; }

    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px; }

    .input-icon-wrap { position: relative; }
    .input-icon-wrap .field-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
    .input-icon-wrap input { padding-left: 40px; }

    input[type="text"], input[type="password"] {
      width: 100%; padding: 12px 14px; border: 1.5px solid #e5e9f0; border-radius: 12px;
      font-size: 14px; color: #0f172a; background: #f8fafc; box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; outline: none;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      border-color: #0F4B92; background: #fff; box-shadow: 0 0 0 4px rgba(15,75,146,0.1);
    }
    input.error { border-color: #ef4444; }

    .input-group { position: relative; }
    .input-group input { padding-right: 44px; }
    .toggle-pass {
      position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: #94a3b8;
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .toggle-pass:hover { background: #f1f5f9; color: #475569; }

    .remember-row { margin: 2px 0 18px; }
    .remember-check {
      display: inline-flex; align-items: center; gap: 8px; margin: 0;
      font-size: 13px; font-weight: 500; color: #475569; cursor: pointer; user-select: none;
    }
    .remember-check input[type="checkbox"] {
      width: 16px; height: 16px; margin: 0; accent-color: #0F4B92; cursor: pointer;
    }

    .alert-error {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;
    }

    .btn-login {
      width: 100%; padding: 13px; margin-top: 4px;
      background: linear-gradient(135deg, #0a2f66, #0F4B92 55%, #1768c7);
      background-size: 170% 170%; background-position: 0% 50%;
      color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
      cursor: pointer; transition: background-position 0.4s, transform 0.1s, box-shadow 0.2s;
      box-shadow: 0 10px 24px -8px rgba(15,75,146,0.55);
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-login:hover:not(:disabled) { background-position: 100% 50%; transform: translateY(-1px); }
    .btn-login:disabled { opacity: 0.7; cursor: not-allowed; }
    .spin { display: inline-flex; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .demo-accounts { margin-top: 26px; padding: 16px; border-radius: 16px; background: #f8fafc; border: 1px dashed #dbe3ee; }
    .demo-title {
      display: flex; align-items: center; justify-content: center; gap: 5px;
      font-size: 12px; color: #b45309; text-align: center; margin: 0 0 12px; font-weight: 600;
    }
    .demo-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 20px; border: 1.5px solid;
      font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .chip.owner { border-color: #0F4B92; color: #0F4B92; background: #eff6ff; }
    .chip.owner:hover { background: #0F4B92; color: white; transform: translateY(-1px); box-shadow: 0 6px 14px -6px rgba(15,75,146,0.5); }
    .chip.client { border-color: #0891b2; color: #0891b2; background: #ecfeff; }
    .chip.client:hover { background: #0891b2; color: white; transform: translateY(-1px); box-shadow: 0 6px 14px -6px rgba(8,145,178,0.5); }

    .page-footer { position: relative; z-index: 1; font-size: 12px; color: rgba(255,255,255,0.55); margin: 0; }

    @media (prefers-reduced-motion: reduce) {
      .orb, .login-card, .spin { animation: none; }
    }

    @media (max-width: 480px) {
      .login-card { padding: 32px 24px 24px; }
      .login-header h1 { font-size: 20px; }
      .demo-chips { gap: 6px; }
      .chip { padding: 6px 10px; font-size: 11px; }
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    remember: [true]
  });
  showPass = signal(false);
  loading = signal(false);
  errorMsg = signal('');
  currentYear = new Date().getFullYear();

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  fillDemo(username: string, password: string) {
    this.form.patchValue({ username, password });
    this.errorMsg.set('');
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.errorMsg.set('');
    const { username, password, remember } = this.form.value;
    setTimeout(() => {
      const ok = this.auth.login(username!, password!, remember!);
      if (ok) this.router.navigate(['/dashboard']);
      else this.errorMsg.set('Usuario o contraseña incorrectos.');
      this.loading.set(false);
    }, 600);
  }
}
