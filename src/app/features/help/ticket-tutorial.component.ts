import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { TicketService } from '../../core/services/ticket.service';
import { Ticket, TicketPriority } from '../../core/models';
import { IconComponent, IconName } from '../../shared/icon/icon.component';

type Category = Ticket['category'];
interface Check { label: string; ok: boolean }

const STORAGE_KEY = 'pmpro_tutorial_ticket';

const CATEGORIES: { value: Category; label: string; icon: IconName; hint: string; example: string }[] = [
  { value: 'bug', label: 'Error', icon: 'alert-triangle', hint: 'Algo que antes funcionaba y ahora falla.', example: 'Al pagar con tarjeta aparece "Error 500".' },
  { value: 'feature', label: 'Nueva funcionalidad', icon: 'plus', hint: 'Algo nuevo que quieres que el sistema haga.', example: 'Queremos exportar los pedidos a Excel.' },
  { value: 'support', label: 'Soporte técnico', icon: 'settings', hint: 'Una duda o ayuda para usar algo.', example: '¿Cómo agrego un nuevo usuario a mi equipo?' },
  { value: 'billing', label: 'Facturación', icon: 'file-text', hint: 'Preguntas sobre cobros o documentos.', example: 'Necesito el comprobante del mes pasado.' },
  { value: 'other', label: 'Otro', icon: 'message-circle', hint: 'Cualquier otra cosa.', example: 'Queremos agendar una reunión de seguimiento.' },
];

/** Ejercicio del paso 1: situaciones reales para elegir la categoría correcta. */
const QUIZ: { text: string; answer: Category }[] = [
  { text: 'La página de inicio carga en blanco desde esta mañana.', answer: 'bug' },
  { text: 'Nos gustaría que el sistema envíe un correo cuando entra un pedido.', answer: 'feature' },
  { text: 'No sé cómo cambiar mi contraseña.', answer: 'support' },
];

const PRIORITIES: { value: TicketPriority; label: string; when: string; example: string }[] = [
  { value: 'critical', label: 'Crítica', when: 'Tu operación está detenida o estás perdiendo ventas ahora.', example: 'Nadie puede iniciar sesión / no se puede cobrar.' },
  { value: 'high', label: 'Alta', when: 'Afecta a muchas personas, pero hay una forma de seguir trabajando.', example: 'Un reporte importante sale con datos incorrectos.' },
  { value: 'medium', label: 'Media', when: 'Molesta, pero no impide trabajar.', example: 'Un botón está desalineado en celular.' },
  { value: 'low', label: 'Baja', when: 'Mejoras o detalles sin prisa.', example: 'Cambiar el texto de un mensaje.' },
];

const DESCRIPTION_TEMPLATE = `¿Qué pasó?
(Escribe lo que viste)

¿Dónde?
(Pantalla o sección del sistema)

¿Cómo reproducirlo?
1.
2.

¿Desde cuándo pasa y a cuántas personas afecta?
`;

const STEPS = [
  { title: 'Cuándo pedir soporte', icon: 'help-circle' as IconName },
  { title: 'Dónde está el botón', icon: 'ticket' as IconName },
  { title: 'Un buen título', icon: 'edit' as IconName },
  { title: 'Describe el problema', icon: 'file-text' as IconName },
  { title: 'Elige la prioridad', icon: 'alert-triangle' as IconName },
  { title: 'Adjunta evidencia', icon: 'paperclip' as IconName },
  { title: '¿Y después?', icon: 'check' as IconName },
];

/**
 * Tutorial interactivo "Cómo pedir soporte": el cliente practica creando una
 * solicitud (sin enviar nada) y al final puede convertir la práctica en un
 * ticket real, que se abre ya completado en el formulario de Soporte.
 */
@Component({
  selector: 'app-ticket-tutorial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="tutorial">
      <header class="t-head">
        <div>
          <span class="eyebrow"><app-icon name="lightbulb" [size]="14" /> Aprende en 3 minutos</span>
          <h1>Cómo pedir soporte a 3TECH</h1>
          <p>Practica creando una solicitud paso a paso. No se envía nada hasta que tú lo decidas.</p>
        </div>
        <a routerLink="/tickets" class="skip">Ya sé cómo, ir a Soporte <app-icon name="chevron-right" [size]="14" /></a>
      </header>

      <!-- Progreso -->
      <ol class="stepper" aria-label="Pasos del tutorial">
        @for (s of steps; track s.title; let i = $index) {
          <li [class.done]="i < step()" [class.current]="i === step()">
            <button (click)="goTo(i)" [disabled]="i > maxReached()" [attr.aria-current]="i === step() ? 'step' : null">
              <span class="num">@if (i < step()) { <app-icon name="check" [size]="13" [strokeWidth]="3" /> } @else { {{ i + 1 }} }</span>
              <span class="lbl">{{ s.title }}</span>
            </button>
          </li>
        }
      </ol>
      <div class="progress" aria-hidden="true"><div [style.width.%]="(step() / (steps.length - 1)) * 100"></div></div>

      <div class="stage">
        <!-- Lección -->
        <section class="lesson" aria-live="polite">
          <span class="step-tag">Paso {{ step() + 1 }} de {{ steps.length }}</span>

          @switch (step()) {
            @case (0) {
              <h2>¿Cuándo crear una solicitud?</h2>
              <p class="lead">Cada vez que algo falle, tengas una duda o quieras algo nuevo. Elegir bien la <strong>categoría</strong> ayuda a que llegue a la persona correcta.</p>
              <div class="cat-grid">
                @for (c of categories; track c.value) {
                  <div class="cat"><app-icon [name]="c.icon" [size]="18" /><strong>{{ c.label }}</strong><span>{{ c.hint }}</span><em>"{{ c.example }}"</em></div>
                }
              </div>
              <div class="exercise">
                <h3><app-icon name="star" [size]="15" /> Ejercicio: ¿qué categoría es?</h3>
                @for (q of quiz; track q.text; let qi = $index) {
                  <div class="quiz-q">
                    <p>"{{ q.text }}"</p>
                    <div class="quiz-opts">
                      @for (c of categories.slice(0, 3); track c.value) {
                        <button [class.right]="quizAnswers()[qi] === c.value && c.value === q.answer" [class.wrong]="quizAnswers()[qi] === c.value && c.value !== q.answer"
                          (click)="answer(qi, c.value)">{{ c.label }}</button>
                      }
                    </div>
                    @if (quizAnswers()[qi]; as a) {
                      <span class="feedback" [class.good]="a === q.answer">{{ a === q.answer ? '¡Correcto!' : 'Casi: es ' + labelOf(q.answer) + '.' }}</span>
                    }
                  </div>
                }
              </div>
            }

            @case (1) {
              <h2>Entra a Soporte y pulsa "Nueva solicitud"</h2>
              <p class="lead">En el menú de la izquierda, entra a <strong>Tickets</strong>. Arriba a la derecha está el botón naranja. <strong>Encuéntralo y púlsalo en la simulación</strong> para continuar.</p>
              <div class="mock-screen">
                <div class="mock-side"><span></span><span class="on">Tickets</span><span></span></div>
                <div class="mock-main">
                  <div class="mock-top">
                    <div><b>Soporte</b><i>Respuesta garantizada en {{ slaHours() }} horas</i></div>
                    <button class="mock-btn" [class.pulse]="!foundButton()" (click)="foundButton.set(true); save()">+ Nueva solicitud</button>
                  </div>
                  <div class="mock-list"><span></span><span></span><span></span></div>
                </div>
                @if (foundButton()) {
                  <div class="mock-ok"><app-icon name="check" [size]="18" [strokeWidth]="3" /> ¡Exacto! Ese botón abre el formulario.</div>
                }
              </div>
            }

            @case (2) {
              <h2>Escribe un buen título</h2>
              <p class="lead">El título es lo primero que lee el equipo. Que diga <strong>qué falla y dónde</strong>, en pocas palabras.</p>
              <div class="examples">
                <div class="ex bad"><app-icon name="x" [size]="14" /> "Ayuda urgente"</div>
                <div class="ex bad"><app-icon name="x" [size]="14" /> "No funciona"</div>
                <div class="ex good"><app-icon name="check" [size]="14" /> "El pago con tarjeta da error 500 en el checkout"</div>
              </div>
              <label class="field-label" for="tut-title">Prueba tú: escribe el título de tu solicitud</label>
              <input id="tut-title" class="field" [(ngModel)]="title" (ngModelChange)="save()" placeholder="Ej. No puedo descargar facturas desde la sección Reportes" maxlength="120">
              <ul class="checks">@for (c of titleChecks(); track c.label) { <li [class.ok]="c.ok"><app-icon [name]="c.ok ? 'check' : 'x'" [size]="13" /> {{ c.label }}</li> }</ul>
            }

            @case (3) {
              <h2>Describe el problema</h2>
              <p class="lead">Mientras más claro, más rápido lo resolvemos. Responde: <strong>qué pasó, dónde, cómo repetirlo y desde cuándo</strong>.</p>
              <div class="desc-head">
                <label class="field-label" for="tut-desc">Tu descripción</label>
                <button class="link-btn" (click)="useTemplate()"><app-icon name="file-text" [size]="13" /> Usar plantilla</button>
              </div>
              <textarea id="tut-desc" class="field" rows="8" [(ngModel)]="description" (ngModelChange)="save()" placeholder="Cuéntanos qué pasó…"></textarea>
              <ul class="checks">@for (c of descChecks(); track c.label) { <li [class.ok]="c.ok"><app-icon [name]="c.ok ? 'check' : 'x'" [size]="13" /> {{ c.label }}</li> }</ul>
            }

            @case (4) {
              <h2>Elige la prioridad</h2>
              <p class="lead">La prioridad nos dice <strong>qué tan grave es para tu operación</strong>. Sé honesto: así atendemos primero lo realmente urgente.</p>
              <div class="prio-list" role="radiogroup" aria-label="Prioridad">
                @for (pr of priorities; track pr.value) {
                  <button role="radio" class="prio" [class]="pr.value" [class.active]="priority() === pr.value" [attr.aria-checked]="priority() === pr.value" (click)="priority.set(pr.value); save()">
                    <span class="prio-dot"></span>
                    <span class="prio-text"><strong>{{ pr.label }}</strong><span>{{ pr.when }}</span><em>Ej.: {{ pr.example }}</em></span>
                  </button>
                }
              </div>
              <label class="field-label" for="tut-cat">Y la categoría</label>
              <select id="tut-cat" class="field" [ngModel]="category()" (ngModelChange)="category.set($event); save()">
                @for (c of categories; track c.value) { <option [value]="c.value">{{ c.label }}</option> }
              </select>
              <p class="sla"><app-icon name="clock" [size]="15" /> Sin importar la prioridad, tu empresa tiene respuesta garantizada en <strong>{{ slaHours() }} horas</strong>.</p>
            }

            @case (5) {
              <h2>Adjunta evidencia</h2>
              <p class="lead">Una imagen vale más que mil palabras. Puedes adjuntar <strong>una captura o un PDF</strong> (hasta 5 MB).</p>
              <div class="tips">
                <div class="tip"><span class="kbd">Windows</span><p>Presiona <kbd>Win</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> y selecciona la parte de la pantalla.</p></div>
                <div class="tip"><span class="kbd">Mac</span><p>Presiona <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>4</kbd> y arrastra para capturar.</p></div>
                <div class="tip"><span class="kbd">Celular</span><p>Usa la captura de pantalla de tu teléfono y adjúntala desde la galería.</p></div>
              </div>
              <div class="mock-drop" [class.done]="attached()" (click)="attached.set(true); save()" (keydown.enter)="attached.set(true); save()" tabindex="0" role="button">
                @if (attached()) { <app-icon name="image" [size]="22" /> <span><b>captura-error.png</b> adjuntada (simulación)</span> }
                @else { <app-icon name="paperclip" [size]="22" /> <span>Haz clic para simular que adjuntas una captura</span> }
              </div>
              <p class="note">Consejo: si hay un mensaje de error, que se vea completo en la captura.</p>
            }

            @case (6) {
              <h2>¿Qué pasa después de enviarla?</h2>
              <p class="lead">Puedes seguir cada solicitud en <strong>Tickets</strong>. Te avisamos con una notificación en cada cambio.</p>
              <ol class="journey">
                <li><span class="j-dot">1</span><div><strong>Recibida</strong><span>Tu solicitud entra con un número (#) y empieza a correr el tiempo de respuesta.</span></div></li>
                <li><span class="j-dot">2</span><div><strong>Asignada</strong><span>Un técnico de 3TECH la toma; verás su nombre.</span></div></li>
                <li><span class="j-dot">3</span><div><strong>En atención</strong><span>Te respondemos en la conversación. Puedes contestar ahí mismo y adjuntar más información.</span></div></li>
                <li><span class="j-dot">4</span><div><strong>Resuelta</strong><span>Confírmanos si quedó bien y califica la atención con estrellas. ¡Nos ayuda mucho!</span></div></li>
              </ol>
              <div class="done-box">
                <app-icon name="check" [size]="20" [strokeWidth]="3" />
                <div><strong>¡Listo, ya sabes cómo pedir soporte!</strong><span>{{ readyCount() }} de 4 elementos de tu práctica están completos.</span></div>
              </div>
            }
          }

          <div class="nav">
            <button class="btn-back" [disabled]="step() === 0" (click)="goTo(step() - 1)"><app-icon name="chevron-left" [size]="15" /> Anterior</button>
            <span class="spacer"></span>
            @if (step() < steps.length - 1) {
              <button class="btn-next" [disabled]="!canContinue()" (click)="goTo(step() + 1)">
                {{ canContinue() ? 'Siguiente' : continueHint() }} <app-icon name="chevron-right" [size]="15" />
              </button>
            } @else {
              <button class="btn-real" (click)="createReal()"><app-icon name="send" [size]="15" /> Crear esta solicitud de verdad</button>
            }
          </div>
        </section>

        <!-- Vista previa de la práctica -->
        <aside class="preview" aria-label="Vista previa de tu solicitud">
          <span class="pv-title"><app-icon name="eye" [size]="14" /> Así la verá el equipo de 3TECH</span>
          <div class="pv-card">
            <div class="pv-top">
              <span class="pv-pill" [class]="priority()">{{ priorityLabel() }}</span>
              <span class="pv-cat">{{ labelOf(category()) }}</span>
            </div>
            <strong class="pv-name" [class.empty]="!title.trim()">{{ title.trim() || 'Tu título aparecerá aquí' }}</strong>
            <p class="pv-desc" [class.empty]="!description.trim()">{{ description.trim() || 'Tu descripción aparecerá aquí…' }}</p>
            @if (attached()) { <span class="pv-att"><app-icon name="paperclip" [size]="12" /> captura-error.png</span> }
            <div class="pv-foot"><app-icon name="clock" [size]="12" /> Respuesta en {{ slaHours() }} h</div>
          </div>
          <ul class="pv-score">
            <li [class.ok]="titleScore() === titleChecks().length"><app-icon name="check" [size]="12" /> Título claro</li>
            <li [class.ok]="descScore() >= 3"><app-icon name="check" [size]="12" /> Descripción completa</li>
            <li [class.ok]="!!priority()"><app-icon name="check" [size]="12" /> Prioridad elegida</li>
            <li [class.ok]="attached()"><app-icon name="check" [size]="12" /> Evidencia adjunta</li>
          </ul>
          <button class="reset" (click)="reset()">Reiniciar práctica</button>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .tutorial { max-width: var(--page-max-width); margin: 0 auto; }
    .t-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
    .eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #a8620a; background: #fdf3e6; padding: 4px 10px; border-radius: 999px; }
    .t-head h1 { margin: 8px 0 4px; font-size: 26px; font-weight: 800; color: #0f172a; }
    .t-head p { margin: 0; color: #64748b; font-size: 14px; }
    .skip { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: #0f4b92; text-decoration: none; }

    .stepper { list-style: none; display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 0; padding: 0; }
    .stepper button { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 5px; border: none; background: none; cursor: pointer; font-family: inherit; padding: 4px; }
    .stepper button:disabled { cursor: default; }
    .num { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #cbd5e1; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #94a3b8; }
    .lbl { font-size: 11.5px; font-weight: 600; color: #94a3b8; text-align: center; }
    .done .num { background: #a9c238; border-color: #a9c238; color: #fff; }
    .done .lbl { color: #5b6b12; }
    .current .num { border-color: #0f4b92; color: #0f4b92; box-shadow: 0 0 0 4px rgba(15,75,146,0.12); }
    .current .lbl { color: #0f4b92; font-weight: 800; }
    .progress { height: 4px; background: #e2e8f0; border-radius: 999px; margin: 10px 0 18px; overflow: hidden; }
    .progress div { height: 100%; background: #0f4b92; transition: width 0.3s ease; }

    .stage { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
    .lesson, .preview { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; }
    .lesson { padding: 24px 28px; display: flex; flex-direction: column; gap: 12px; min-height: 480px; }
    .step-tag { font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
    .lesson h2 { margin: 0; font-size: 21px; font-weight: 800; color: #0f172a; }
    .lead { margin: 0; font-size: 15px; color: #475569; line-height: 1.55; }
    .lead strong { color: #0f172a; }

    .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
    .cat { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 4px; color: #0f4b92; }
    .cat strong { color: #0f172a; font-size: 14px; }
    .cat span { font-size: 12.5px; color: #64748b; }
    .cat em { font-size: 12px; color: #94a3b8; }
    .exercise { background: #f8fafc; border-radius: 14px; padding: 14px 16px; }
    .exercise h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 14px; color: #a8620a; }
    .quiz-q { padding: 8px 0; border-top: 1px solid #eef2f7; }
    .quiz-q p { margin: 0 0 6px; font-size: 14px; color: #0f172a; font-weight: 600; }
    .quiz-opts { display: flex; gap: 6px; flex-wrap: wrap; }
    .quiz-opts button { border: 1.5px solid #e2e8f0; background: #fff; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; color: #334155; }
    .quiz-opts button.right { border-color: #a9c238; background: #f2f7e1; color: #5b6b12; }
    .quiz-opts button.wrong { border-color: #fca5a5; background: #fef2f2; color: #dc2626; }
    .feedback { display: inline-block; margin-top: 6px; font-size: 12.5px; font-weight: 700; color: #a8620a; }
    .feedback.good { color: #5b6b12; }

    .mock-screen { position: relative; display: grid; grid-template-columns: 90px 1fr; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; min-height: 220px; background: #f1f5f9; }
    .mock-side { background: #0f4b92; display: flex; flex-direction: column; gap: 8px; padding: 14px 10px; }
    .mock-side span { height: 10px; border-radius: 4px; background: rgba(255,255,255,0.2); }
    .mock-side span.on { height: auto; padding: 5px 7px; background: rgba(255,255,255,0.25); color: #fff; font-size: 11px; font-weight: 700; }
    .mock-main { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
    .mock-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .mock-top b { display: block; font-size: 15px; color: #0f172a; }
    .mock-top i { font-size: 11.5px; color: #64748b; font-style: normal; }
    .mock-btn { border: none; background: #e99d34; color: #fff; font-weight: 800; font-size: 13px; padding: 9px 14px; border-radius: 10px; cursor: pointer; }
    .mock-btn.pulse { animation: pulse 1.4s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(233,157,52,0.6); } 50% { box-shadow: 0 0 0 10px rgba(233,157,52,0); } }
    @media (prefers-reduced-motion: reduce) { .mock-btn.pulse { animation: none; outline: 3px solid #e99d34; outline-offset: 3px; } }
    .mock-list { display: flex; flex-direction: column; gap: 8px; }
    .mock-list span { height: 38px; background: #fff; border-radius: 10px; }
    .mock-ok { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: #5b6b12; color: #fff; padding: 9px 14px; border-radius: 12px; font-size: 13.5px; font-weight: 700; white-space: nowrap; }

    .examples { display: flex; flex-direction: column; gap: 6px; }
    .ex { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 8px 12px; border-radius: 10px; }
    .ex.bad { background: #fef2f2; color: #b91c1c; text-decoration: line-through; }
    .ex.good { background: #f2f7e1; color: #5b6b12; font-weight: 600; }
    .field-label { font-size: 13px; font-weight: 700; color: #334155; }
    .field { width: 100%; box-sizing: border-box; padding: 11px 13px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 14.5px; font-family: inherit; outline: none; resize: vertical; }
    .field:focus { border-color: #0f4b92; box-shadow: 0 0 0 3px rgba(15,75,146,0.1); }
    .checks { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 14px; }
    .checks li { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: #94a3b8; }
    .checks li.ok { color: #5b6b12; font-weight: 700; }
    .desc-head { display: flex; justify-content: space-between; align-items: center; }
    .link-btn { display: inline-flex; align-items: center; gap: 5px; border: none; background: #eef4fc; color: #0f4b92; font-weight: 700; font-size: 12.5px; padding: 6px 10px; border-radius: 8px; cursor: pointer; }

    .prio-list { display: flex; flex-direction: column; gap: 8px; }
    .prio { display: flex; align-items: flex-start; gap: 12px; text-align: left; border: 1.5px solid #e2e8f0; background: #fff; border-radius: 12px; padding: 11px 13px; cursor: pointer; font-family: inherit; }
    .prio.active { border-color: #0f4b92; background: #f6f9fe; }
    .prio-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
    .critical .prio-dot { background: #ef4444; } .high .prio-dot { background: #f97316; }
    .medium .prio-dot { background: #e99d34; } .low .prio-dot { background: #a9c238; }
    .prio-text { display: flex; flex-direction: column; gap: 2px; }
    .prio-text strong { font-size: 14px; color: #0f172a; }
    .prio-text span { font-size: 13px; color: #475569; }
    .prio-text em { font-size: 12px; color: #94a3b8; }
    .sla { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 13.5px; color: #0f4b92; background: #eef4fc; padding: 10px 12px; border-radius: 10px; }

    .tips { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
    .tip { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
    .tip p { margin: 6px 0 0; font-size: 13px; color: #475569; line-height: 1.5; }
    .kbd { font-size: 11px; font-weight: 800; color: #0f4b92; text-transform: uppercase; letter-spacing: 0.04em; }
    kbd { display: inline-block; padding: 1px 6px; border: 1px solid #cbd5e1; border-bottom-width: 2px; border-radius: 5px; background: #f8fafc; font-size: 12px; font-family: inherit; color: #0f172a; }
    .mock-drop { display: flex; align-items: center; justify-content: center; gap: 10px; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 22px; color: #64748b; cursor: pointer; font-size: 14px; outline: none; }
    .mock-drop:hover, .mock-drop:focus-visible { border-color: #0f4b92; color: #0f4b92; }
    .mock-drop.done { border-style: solid; border-color: #a9c238; background: #f2f7e1; color: #5b6b12; }
    .note { margin: 0; font-size: 13px; color: #64748b; }

    .journey { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .journey li { display: flex; gap: 12px; padding: 8px 0; position: relative; }
    .journey li:not(:last-child)::after { content: ''; position: absolute; left: 14px; top: 38px; bottom: -6px; width: 2px; background: #e2e8f0; }
    .j-dot { width: 30px; height: 30px; border-radius: 50%; background: #0f4b92; color: #fff; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .journey div { display: flex; flex-direction: column; gap: 2px; }
    .journey strong { font-size: 14.5px; color: #0f172a; }
    .journey span { font-size: 13.5px; color: #475569; }
    .done-box { display: flex; align-items: center; gap: 12px; background: #f2f7e1; color: #5b6b12; border-radius: 14px; padding: 14px 16px; }
    .done-box div { display: flex; flex-direction: column; }
    .done-box span { font-size: 13px; }

    .nav { display: flex; align-items: center; gap: 10px; margin-top: auto; padding-top: 14px; border-top: 1px solid #f1f5f9; }
    .spacer { flex: 1; }
    .btn-back, .btn-next, .btn-real { display: inline-flex; align-items: center; gap: 6px; border: none; border-radius: 11px; padding: 10px 16px; font-weight: 700; font-size: 14px; cursor: pointer; font-family: inherit; }
    .btn-back { background: #f1f5f9; color: #334155; }
    .btn-back:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-next { background: #0f4b92; color: #fff; }
    .btn-next:disabled { background: #cbd5e1; cursor: not-allowed; }
    .btn-real { background: #e99d34; color: #fff; }
    .btn-real:hover { background: #d48a22; }

    .preview { padding: 16px; position: sticky; top: 16px; display: flex; flex-direction: column; gap: 12px; }
    .pv-title { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #64748b; }
    .pv-card { border: 1.5px solid #e2e8f0; border-left: 4px solid #e99d34; border-radius: 14px; padding: 13px; display: flex; flex-direction: column; gap: 7px; }
    .pv-top { display: flex; justify-content: space-between; align-items: center; }
    .pv-pill { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; background: #f1f5f9; color: #475569; }
    .pv-pill.critical { background: #fee2e2; color: #dc2626; } .pv-pill.high { background: #ffedd5; color: #c2410c; }
    .pv-pill.medium { background: #fdf3e6; color: #a8620a; } .pv-pill.low { background: #f2f7e1; color: #5b6b12; }
    .pv-cat { font-size: 11.5px; color: #64748b; font-weight: 600; }
    .pv-name { font-size: 15px; color: #0f172a; line-height: 1.35; }
    .pv-desc { margin: 0; font-size: 13px; color: #475569; white-space: pre-wrap; max-height: 150px; overflow: hidden; line-height: 1.45; }
    .empty { color: #cbd5e1 !important; font-style: italic; }
    .pv-att { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #0f4b92; font-weight: 600; }
    .pv-foot { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 7px; }
    .pv-score { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
    .pv-score li { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #94a3b8; }
    .pv-score li.ok { color: #5b6b12; font-weight: 700; }
    .reset { align-self: flex-start; border: none; background: none; color: #94a3b8; font-size: 12.5px; cursor: pointer; text-decoration: underline; padding: 0; }

    @media (max-width: 1100px) { .stage { grid-template-columns: 1fr; } .preview { position: static; } }
    @media (max-width: 760px) {
      .stepper { display: flex; overflow-x: auto; gap: 2px; }
      .stepper li { flex: 0 0 auto; }
      .lbl { display: none; }
      .lesson { padding: 18px; min-height: 0; }
      .mock-screen { grid-template-columns: 1fr; }
      .mock-side { display: none; }
      .mock-ok { white-space: normal; text-align: center; width: 80%; }
    }
  `]
})
export class TicketTutorialComponent {
  private auth = inject(AuthService);
  private companyService = inject(CompanyService);
  private ticketService = inject(TicketService);
  private router = inject(Router);

  readonly steps = STEPS;
  readonly categories = CATEGORIES;
  readonly quiz = QUIZ;
  readonly priorities = PRIORITIES;

  step = signal(0);
  maxReached = signal(0);
  quizAnswers = signal<(Category | null)[]>(QUIZ.map(() => null));
  foundButton = signal(false);
  attached = signal(false);
  priority = signal<TicketPriority>('medium');
  category = signal<Category>('bug');
  title = '';
  description = '';
  /** Versión para que los computed se recalculen al escribir (ngModel cambia propiedades simples). */
  private typed = signal(0);

  constructor() {
    this.companyService.load().catch(() => undefined);
    this.restore();
    effect(() => { this.maxReached.update(m => Math.max(m, this.step())); });
  }

  slaHours = computed(() => {
    const id = this.auth.currentUser()?.companyId;
    return id ? this.ticketService.getSlaHoursForCompany(id) : 24;
  });

  labelOf(c: Category) { return CATEGORIES.find(x => x.value === c)?.label ?? c; }
  priorityLabel() { return PRIORITIES.find(p => p.value === this.priority())?.label ?? ''; }

  // ── Revisión en vivo ──
  titleChecks = computed<Check[]>(() => {
    this.typed();
    const t = this.title.trim();
    const vague = /^(ayuda|urgente|no funciona|problema|error|falla)[!. ]*$/i.test(t) || /\b(urgente|ayuda)\b/i.test(t);
    return [
      { label: 'Entre 15 y 90 caracteres', ok: t.length >= 15 && t.length <= 90 },
      { label: 'Dice qué falla o qué necesitas', ok: t.split(/\s+/).length >= 4 },
      { label: 'Sin palabras vagas ("urgente", "ayuda")', ok: t.length > 0 && !vague },
    ];
  });
  titleScore = computed(() => this.titleChecks().filter(c => c.ok).length);

  descChecks = computed<Check[]>(() => {
    this.typed();
    const d = this.description.toLowerCase();
    const filled = (marker: RegExp) => marker.test(d);
    return [
      { label: 'Qué pasó', ok: d.replace(/¿qué pasó\?|\(escribe lo que viste\)/g, '').trim().length >= 40 },
      { label: 'Dónde (pantalla o sección)', ok: filled(/(pantalla|secci[oó]n|p[aá]gina|m[oó]dulo|men[uú]|bot[oó]n|reporte|checkout|inicio)/) },
      { label: 'Cómo repetirlo (pasos)', ok: filled(/(1\.\s*\S|paso|primero|luego|despu[eé]s|al (hacer|dar|pulsar|presionar))/) },
      { label: 'Desde cuándo / a quién afecta', ok: filled(/(desde|hoy|ayer|ma[ñn]ana|semana|todos|usuarios|clientes|personas)/) },
    ];
  });
  descScore = computed(() => this.descChecks().filter(c => c.ok).length);

  readyCount = computed(() => {
    this.typed();
    return [this.titleScore() === 3, this.descScore() >= 3, !!this.priority(), this.attached()].filter(Boolean).length;
  });

  /** Cada paso pide una acción mínima antes de avanzar (aprender haciendo). */
  canContinue = computed(() => {
    this.typed();
    switch (this.step()) {
      case 0: return this.quizAnswers().every(a => a !== null);
      case 1: return this.foundButton();
      case 2: return this.title.trim().length >= 8;
      case 3: return this.description.trim().length >= 20;
      default: return true;
    }
  });

  continueHint = computed(() => ['Responde el ejercicio', 'Pulsa el botón naranja', 'Escribe un título', 'Escribe la descripción'][this.step()] ?? 'Siguiente');

  answer(i: number, c: Category) {
    this.quizAnswers.update(a => a.map((v, idx) => (idx === i ? c : v)));
    this.save();
  }

  useTemplate() {
    if (!this.description.trim()) this.description = DESCRIPTION_TEMPLATE;
    else this.description = this.description.trimEnd() + '\n\n' + DESCRIPTION_TEMPLATE;
    this.save();
  }

  goTo(i: number) {
    if (i < 0 || i >= STEPS.length || i > this.maxReached() + (this.canContinue() ? 1 : 0)) return;
    this.step.set(i);
    this.save();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Abre el formulario real de Soporte con la práctica ya escrita. */
  createReal() {
    this.router.navigate(['/tickets'], {
      state: { ticketDraft: { title: this.title.trim(), description: this.description.trim(), category: this.category(), priority: this.priority() } },
    });
  }

  reset() {
    this.title = ''; this.description = '';
    this.step.set(0); this.maxReached.set(0);
    this.quizAnswers.set(QUIZ.map(() => null));
    this.foundButton.set(false); this.attached.set(false);
    this.priority.set('medium'); this.category.set('bug');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* opcional */ }
    this.typed.update(v => v + 1);
  }

  // ── Progreso guardado (para retomar después) ──
  save() {
    this.typed.update(v => v + 1);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        step: this.step(), max: this.maxReached(), quiz: this.quizAnswers(), found: this.foundButton(), attached: this.attached(),
        title: this.title, description: this.description, priority: this.priority(), category: this.category(),
      }));
    } catch { /* opcional */ }
  }

  private restore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (!s) return;
      this.step.set(s.step ?? 0); this.maxReached.set(s.max ?? 0);
      this.quizAnswers.set(s.quiz ?? QUIZ.map(() => null));
      this.foundButton.set(!!s.found); this.attached.set(!!s.attached);
      this.title = s.title ?? ''; this.description = s.description ?? '';
      this.priority.set(s.priority ?? 'medium'); this.category.set(s.category ?? 'bug');
    } catch { /* progreso dañado: se empieza de cero */ }
  }
}
