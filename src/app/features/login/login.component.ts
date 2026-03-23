import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <div class="login-wrapper">
      <div class="login-left">
        <div class="brand-content">
          <div class="brand-logo">T·P</div>
          <h1>Tikets y Proceso</h1>
          <p>Gestión de proyectos empresariales centralizada. Control total sobre tus proyectos internos y total transparencia para tus clientes.</p>
          <div class="features">
            <div class="feature-item">✅ Gestión de proyectos por empresa</div>
            <div class="feature-item">✅ Sistema de tickets con SLA 24h</div>
            <div class="feature-item">✅ Colaboración en tiempo real</div>
            <div class="feature-item">✅ Control de acceso por roles</div>
          </div>
        </div>
      </div>

      <div class="login-right">
        <div class="login-card">
          <div class="login-header">
            <div class="login-icon">🔐</div>
            <h2>Bienvenido</h2>
            <p>Ingresa tus credenciales para acceder</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-group">
              <label>Usuario</label>
              <input type="text" formControlName="username" placeholder="Ingresa tu usuario"
                [class.error]="form.get('username')?.invalid && form.get('username')?.touched">
            </div>
            <div class="form-group">
              <label>Contraseña</label>
              <div class="input-group">
                <input [type]="showPass() ? 'text' : 'password'" formControlName="password"
                  placeholder="Ingresa tu contraseña"
                  [class.error]="form.get('password')?.invalid && form.get('password')?.touched">
                <button type="button" class="toggle-pass" (click)="showPass.set(!showPass())">
                  {{ showPass() ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>

            @if (errorMsg()) {
              <div class="alert-error">{{ errorMsg() }}</div>
            }

            <button type="submit" class="btn-login" [disabled]="loading()">
              @if (loading()) { <span>Accediendo...</span> }
              @else { <span>Iniciar Sesión</span> }
            </button>
          </form>

          <div class="demo-accounts">
            <p class="demo-title">Cuentas de demostración:</p>
            <div class="demo-chips">
              <button class="chip owner" (click)="fillDemo('owner', 'owner123')">
                👑 Propietario
              </button>
              <button class="chip client" (click)="fillDemo('empresa1', 'emp123')">
                🏢 TechSolutions
              </button>
              <button class="chip client" (click)="fillDemo('empresa2', 'emp456')">
                🏢 InnovaCorp
              </button>
              <button class="chip client" (click)="fillDemo('empresa3', 'emp789')">
                🏢 GlobalTech
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper { display: flex; height: 100vh; font-family: 'Inter', sans-serif; }

    .login-left {
      flex: 1; background: linear-gradient(135deg, #0f1f3d 0%, #1e3a8a 50%, #1e40af 100%);
      display: flex; align-items: center; justify-content: center; padding: 60px;
    }
    .brand-content { color: white; max-width: 400px; }
    .brand-logo {
      width: 70px; height: 70px; border-radius: 20px;
      background: rgba(255,255,255,0.15); backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 800; margin-bottom: 24px;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .brand-content h1 { font-size: 42px; font-weight: 800; margin: 0 0 16px; }
    .brand-content p { font-size: 16px; opacity: 0.8; line-height: 1.6; margin-bottom: 32px; }
    .features { display: flex; flex-direction: column; gap: 10px; }
    .feature-item { font-size: 14px; opacity: 0.9; }

    .login-right {
      width: 480px; background: #f8fafc;
      display: flex; align-items: center; justify-content: center; padding: 40px;
    }
    .login-card { width: 100%; max-width: 380px; }
    .login-header { text-align: center; margin-bottom: 32px; }
    .login-icon { font-size: 40px; margin-bottom: 12px; }
    .login-header h2 { font-size: 28px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
    .login-header p { color: #64748b; font-size: 14px; margin: 0; }

    .form-group { margin-bottom: 20px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input {
      width: 100%; padding: 12px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px;
      font-size: 14px; color: #0f172a; background: white; box-sizing: border-box;
      transition: border-color 0.2s; outline: none;
    }
    input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    input.error { border-color: #ef4444; }

    .input-group { position: relative; }
    .input-group input { padding-right: 44px; }
    .toggle-pass {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px;
    }

    .alert-error {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;
    }

    .btn-login {
      width: 100%; padding: 13px; background: linear-gradient(135deg, #1e40af, #3b82f6);
      color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s, transform 0.1s;
    }
    .btn-login:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    .btn-login:disabled { opacity: 0.7; cursor: not-allowed; }

    .demo-accounts { margin-top: 28px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
    .demo-title { font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 12px; font-weight: 500; }
    .demo-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .chip {
      padding: 6px 14px; border-radius: 20px; border: 1.5px solid;
      font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .chip.owner { border-color: #1e40af; color: #1e40af; background: #eff6ff; }
    .chip.owner:hover { background: #1e40af; color: white; }
    .chip.client { border-color: #0891b2; color: #0891b2; background: #ecfeff; }
    .chip.client:hover { background: #0891b2; color: white; }

    @media (max-width: 768px) {
      .login-left { display: none; }
      .login-right { width: 100%; }
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });
  showPass = signal(false);
  loading = signal(false);
  errorMsg = signal('');

  fillDemo(username: string, password: string) {
    this.form.patchValue({ username, password });
    this.errorMsg.set('');
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.errorMsg.set('');
    const { username, password } = this.form.value;
    setTimeout(() => {
      const ok = this.auth.login(username!, password!);
      if (ok) this.router.navigate(['/dashboard']);
      else this.errorMsg.set('Usuario o contraseña incorrectos.');
      this.loading.set(false);
    }, 600);
  }
}
