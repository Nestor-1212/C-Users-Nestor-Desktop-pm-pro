import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { InvoiceService } from '../../core/services/invoice.service';
import { CompanyService } from '../../core/services/company.service';
import { Invoice } from '../../core/models';
import { IconComponent } from '../../shared/icon/icon.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { ConfirmService } from '../../shared/services/confirm.service';
import { NotificationService } from '../../shared/services/notification.service';
import { isControlInvalid } from '../../shared/utils/form.util';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, IconComponent, StatCardComponent, ModalFocusTrapDirective],
  template: `
    <div class="billing-page">
      <div class="page-header">
        <div>
          <h1>{{ auth.isOwner() ? 'Facturación' : 'Mis Facturas' }}</h1>
          <p>{{ auth.isOwner() ? 'Gestiona el cobro a tus empresas cliente' : 'Historial de facturas de tu empresa' }}</p>
        </div>
        @if (auth.isOwner()) {
          <button class="btn-primary" (click)="openModal()">
            <app-icon name="plus" [size]="16" /> Nueva Factura
          </button>
        }
      </div>

      <div class="quick-stats">
        <app-stat-card [value]="'Q' + pendingTotal().toLocaleString('es-GT')" label="Pendiente" icon="clock" color="yellow" />
        <app-stat-card [value]="'Q' + overdueTotal().toLocaleString('es-GT')" label="Vencido" icon="alert-triangle" color="red" />
        <app-stat-card [value]="'Q' + paidTotal().toLocaleString('es-GT')" label="Pagado" icon="check" color="green" />
      </div>

      <div class="filters-row">
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="invoice-search" class="sr-only">Buscar factura</label>
          <input id="invoice-search" type="text" placeholder="Buscar por empresa o concepto..." class="search-input"
            [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
        <label for="invoice-status-filter" class="sr-only">Filtrar por estado</label>
        <select id="invoice-status-filter" class="filter-select" (change)="statusFilter.set($any($event.target).value)">
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="overdue">Vencido</option>
          <option value="paid">Pagado</option>
        </select>
        @if (auth.isOwner()) {
          <label for="invoice-company-filter" class="sr-only">Filtrar por empresa</label>
          <select id="invoice-company-filter" class="filter-select" (change)="companyFilter.set($any($event.target).value)">
            <option value="">Todas las empresas</option>
            @for (c of companies(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        }
      </div>

      <div class="invoices-list">
        @for (inv of filteredInvoices(); track inv.id) {
          <div class="invoice-row">
            <div class="invoice-icon" [class]="rowStatus(inv)">
              <app-icon [name]="rowStatus(inv) === 'paid' ? 'check' : rowStatus(inv) === 'overdue' ? 'alert-triangle' : 'clock'" [size]="16" />
            </div>
            <div class="invoice-main">
              <span class="invoice-concept">{{ inv.concept }}</span>
              <span class="invoice-sub">
                @if (auth.isOwner()) { {{ inv.companyName }} · }
                Emitida {{ inv.issueDate | date:'dd/MM/yyyy' }} · Vence {{ inv.dueDate | date:'dd/MM/yyyy' }}
              </span>
            </div>
            <span class="invoice-amount">Q{{ inv.amount.toLocaleString('es-GT') }}</span>
            <span class="status-badge sm" [class]="rowStatus(inv)">{{ statusLabel(rowStatus(inv)) }}</span>
            @if (auth.isOwner()) {
              <div class="invoice-actions">
                @if (inv.status === 'pending') {
                  <button class="btn-icon" (click)="markPaid(inv)" title="Marcar como pagada" aria-label="Marcar como pagada">
                    <app-icon name="check" [size]="15" />
                  </button>
                }
                <button class="btn-icon danger" (click)="deleteInvoice(inv)" title="Eliminar" aria-label="Eliminar factura">
                  <app-icon name="trash" [size]="15" />
                </button>
              </div>
            }
          </div>
        } @empty {
          <div class="empty-state grid-span">
            <div class="empty-icon"><app-icon name="dollar-sign" [size]="32" /></div>
            <h3>Sin facturas</h3>
            <p>{{ auth.isOwner() ? 'Crea la primera factura.' : 'Todavía no tienes facturas registradas.' }}</p>
          </div>
        }
      </div>
    </div>

    <!-- Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title"
          appModalFocusTrap (closeRequested)="closeModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="invoice-modal-title">Nueva Factura</h2>
            <button class="modal-close" (click)="closeModal()" aria-label="Cerrar">
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveInvoice()" class="modal-body" novalidate>
            <div class="form-grid">
              <div class="form-group full">
                <label for="invoice-company">Empresa *</label>
                <select id="invoice-company" formControlName="companyId" [class.error]="invalid('companyId')">
                  <option value="" disabled>Selecciona una empresa</option>
                  @for (c of companies(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
                @if (invalid('companyId')) { <span class="field-error">Selecciona la empresa a facturar.</span> }
              </div>
              <div class="form-group full">
                <label for="invoice-concept">Concepto *</label>
                <input id="invoice-concept" type="text" formControlName="concept" placeholder="Ej: Mensualidad Plan Premium - Noviembre 2026"
                  [class.error]="invalid('concept')">
                @if (invalid('concept')) { <span class="field-error">El concepto es obligatorio.</span> }
              </div>
              <div class="form-group">
                <label for="invoice-amount">Monto (Q) *</label>
                <input id="invoice-amount" type="number" formControlName="amount" min="1" placeholder="0"
                  [class.error]="invalid('amount')">
                @if (invalid('amount')) { <span class="field-error">Ingresa un monto mayor a 0.</span> }
              </div>
              <div class="form-group">
                <label for="invoice-due">Fecha de vencimiento *</label>
                <input id="invoice-due" type="date" formControlName="dueDate" [class.error]="invalid('dueDate')">
                @if (invalid('dueDate')) { <span class="field-error">La fecha de vencimiento es obligatoria.</span> }
              </div>
            </div>
            <div class="modal-footer">
              @if (form.invalid) { <span class="form-hint">Completa los campos obligatorios (*)</span> }
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">Crear factura</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .billing-page { max-width: 1000px; margin: 0 auto; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .quick-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 20px; }

    .invoices-list { display: flex; flex-direction: column; gap: 8px; }
    .invoice-row {
      display: flex; align-items: center; gap: 14px; background: white; border-radius: 12px;
      border: 1px solid #e2e8f0; padding: 14px 16px; flex-wrap: wrap;
    }
    .invoice-icon { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .invoice-icon.pending { background: var(--color-warning-bg, #fef3c7); color: var(--color-warning-text, #d97706); }
    .invoice-icon.overdue { background: var(--color-danger-bg, #fee2e2); color: var(--color-danger-text, #dc2626); }
    .invoice-icon.paid { background: var(--color-success-bg, #dcfce7); color: var(--color-success-text, #16a34a); }
    .invoice-main { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 3px; }
    .invoice-concept { font-size: 14px; font-weight: 700; color: #0f172a; }
    .invoice-sub { font-size: 12px; color: #64748b; }
    .invoice-amount { font-size: 15px; font-weight: 800; color: #0f172a; white-space: nowrap; }
    .invoice-actions { display: flex; gap: 6px; }
    .btn-icon {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: var(--color-neutral-bg, #f1f5f9); cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: background 0.2s, color 0.2s;
      color: var(--color-text-secondary, #475569);
    }
    .btn-icon:hover { background: var(--color-primary-100, #d1e4fa); color: var(--color-primary-700, #0f4b92); }
    .btn-icon.danger:hover { background: var(--color-danger-bg, #fee2e2); color: var(--color-danger-text, #dc2626); }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1/-1; }
    label { font-size: 13px; font-weight: 600; color: #374151; }
    input, select {
      padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px;
      font-size: 14px; outline: none; width: 100%; box-sizing: border-box;
    }
    input:focus, select:focus { border-color: var(--color-primary-500, #1465c5); }

    @media (max-width: 640px) {
      .form-grid { grid-template-columns: 1fr; }
      .form-group.full { grid-column: auto; }
      .invoice-amount { order: 10; }
    }
  `]
})
export class BillingComponent {
  auth = inject(AuthService);
  private invoiceService = inject(InvoiceService);
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);

  search = signal('');
  statusFilter = signal('');
  companyFilter = signal('');
  showModal = signal(false);
  saving = signal(false);

  companies = this.companyService.companies;

  constructor() {
    loadPageData(this.notify, this.invoiceService.load(), ...(this.auth.isOwner() ? [this.companyService.load()] : []));
  }

  form = this.fb.group({
    companyId: ['', Validators.required],
    concept: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    dueDate: ['', Validators.required]
  });

  private myInvoices = computed(() => {
    const user = this.auth.currentUser();
    return user?.role === 'client'
      ? this.invoiceService.getByCompany(user.companyId!)
      : this.invoiceService.getAll();
  });

  filteredInvoices = computed(() => {
    let list = this.myInvoices();
    const s = this.search().toLowerCase();
    const sf = this.statusFilter();
    const cf = this.companyFilter();
    if (s) list = list.filter(i => i.companyName.toLowerCase().includes(s) || i.concept.toLowerCase().includes(s));
    if (sf) list = list.filter(i => this.rowStatus(i) === sf);
    if (cf) list = list.filter(i => i.companyId === cf);
    return list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  pendingTotal = computed(() => this.myInvoices().filter(i => this.rowStatus(i) === 'pending').reduce((s, i) => s + i.amount, 0));
  overdueTotal = computed(() => this.myInvoices().filter(i => this.rowStatus(i) === 'overdue').reduce((s, i) => s + i.amount, 0));
  paidTotal = computed(() => this.myInvoices().filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0));

  rowStatus(inv: Invoice): 'pending' | 'overdue' | 'paid' {
    if (inv.status === 'paid') return 'paid';
    return this.invoiceService.isOverdue(inv) ? 'overdue' : 'pending';
  }

  statusLabel(status: string): string {
    return status === 'paid' ? 'Pagada' : status === 'overdue' ? 'Vencida' : 'Pendiente';
  }

  invalid(name: string): boolean {
    return isControlInvalid(this.form.get(name));
  }

  openModal() {
    this.form.reset({ companyId: '', concept: '', amount: 0, dueDate: '' });
    this.showModal.set(true);
  }
  closeModal() { this.showModal.set(false); }

  private async run(action: Promise<unknown>, successMessage: string): Promise<boolean> {
    try {
      await action;
      this.notify.success(successMessage);
      return true;
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
      return false;
    }
  }

  async saveInvoice() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    // La fecha de emisión la fija el servidor (zona horaria del negocio).
    const ok = await this.run(this.invoiceService.create({
      companyId: v.companyId!, concept: v.concept!, amount: Number(v.amount), dueDate: v.dueDate!,
    }), 'Factura creada correctamente.');
    this.saving.set(false);
    if (ok) this.closeModal();
  }

  async markPaid(inv: Invoice) {
    const ok = await this.confirm.ask({
      title: 'Marcar como pagada',
      message: `¿Confirmas que "${inv.concept}" (Q${inv.amount.toLocaleString('es-GT')}) fue pagada?`,
      confirmLabel: 'Marcar pagada'
    });
    if (!ok) return;
    this.run(this.invoiceService.markPaid(inv.id), 'Factura marcada como pagada.');
  }

  async deleteInvoice(inv: Invoice) {
    const ok = await this.confirm.ask({
      title: 'Eliminar factura',
      message: `¿Eliminar "${inv.concept}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    this.run(this.invoiceService.delete(inv.id), 'Factura eliminada correctamente.');
  }
}
