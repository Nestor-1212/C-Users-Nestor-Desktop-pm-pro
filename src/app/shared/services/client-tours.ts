import { TourDef, TourStep } from './tour.service';

/**
 * Contenido de las guías de cada módulo del cliente. Los selectores apuntan a
 * la pantalla real; si un elemento no está (lista vacía, celular…), ese paso
 * se salta solo.
 */

const HELP_STEP: TourStep = {
  element: '.help-btn',
  title: '¿Necesitas repasar?',
  text: 'En cada pantalla, el botón <b>Guía</b> repite este recorrido. Y en <b>Aprende</b> practicas cómo pedir soporte.',
  side: 'bottom', align: 'end',
};

export function dashboardTour(): TourDef {
  return {
    id: 'inicio',
    ready: '.client-hero',
    steps: [
      { element: '.client-hero h1', title: '¡Bienvenido a Tikets y Proceso!', text: 'Este es tu inicio: un resumen de tus proyectos y de tu soporte con 3TECH. Te lo muestro en un minuto.', side: 'bottom' },
      { element: '.sidebar-nav', title: 'El menú', text: 'Desde aquí vas a <b>Dashboard</b>, <b>Proyectos</b>, <b>Tickets</b> (soporte) y <b>Aprende</b>.', side: 'right' },
      { element: '.notif-btn', title: 'Notificaciones', text: 'Te avisamos aquí cuando respondemos una solicitud o hay avances en tus proyectos.', side: 'bottom', align: 'end' },
      { element: '.hero-btn', title: 'Reportar un problema', text: 'El camino rápido para pedir ayuda a 3TECH.', side: 'bottom', align: 'end' },
      { element: '.plan-chip', title: 'Tu tiempo de respuesta', text: 'Es el tiempo máximo en que te respondemos cada solicitud.', side: 'bottom', align: 'end' },
      { element: '.project-cards', title: 'Tus proyectos', text: 'Avance, fecha de entrega y si va a tiempo. Pulsa una tarjeta para ver el seguimiento y el cronograma.', side: 'top' },
      { element: '.support-grid', title: 'Tu soporte en números', text: 'Lo que estamos atendiendo, lo que espera tu respuesta, lo resuelto este mes y tu calificación promedio.', side: 'top' },
      { element: '.support-grid + .card', title: 'Tickets abiertos', text: 'Tus solicitudes en curso y quién las atiende. Pulsa una para ver la conversación.', side: 'top' },
      HELP_STEP,
    ],
  };
}

export function projectsTour(): TourDef {
  return {
    id: 'proyectos',
    ready: '.projects-list .project-card, .projects-list .empty-state',
    steps: [
      { element: '.page-header h1', title: 'Tus proyectos', text: 'Todos los proyectos que 3TECH desarrolla para tu empresa.', side: 'bottom' },
      { element: '.filters-row', title: 'Busca y filtra', text: 'Encuentra un proyecto por nombre o fíltralos por estado.', side: 'bottom' },
      { element: '.project-card', title: 'Cada proyecto', text: 'Su estado, prioridad y fechas de inicio y entrega.', side: 'bottom' },
      { element: '.project-card .progress-section', title: 'Avance', text: 'El porcentaje se calcula con el avance de cada etapa del proyecto.', side: 'left' },
      { element: '.project-card .project-stats', title: 'Comentarios, requerimientos y documentos', text: 'Cuántos hay en cada proyecto. Todo eso lo ves dentro del detalle.', side: 'left' },
      { element: '.project-card .btn-view', title: 'Entra al detalle', text: 'Ahí verás el seguimiento, el cronograma, la conversación con el equipo y los archivos.', side: 'left' },
      HELP_STEP,
    ],
  };
}

export type ProjectTab = 'tracking' | 'schedule' | 'comments' | 'requirements' | 'documents';

export function projectTour(setTab: (t: ProjectTab) => void): TourDef {
  return {
    id: 'proyecto',
    ready: '.project-hero',
    onEnd: () => setTab('tracking'),
    steps: [
      { element: '.project-hero h1', title: 'Tu proyecto', text: 'Estado, prioridad, fechas y de qué se trata.', side: 'bottom' },
      { element: '.progress-circle-container', title: 'Avance general', text: 'Se actualiza a medida que el equipo completa las etapas.', side: 'left' },
      { element: '.tabs-nav', title: 'Todo en pestañas', text: 'Seguimiento, Cronograma, Comentarios, Requerimientos y Documentos. Te muestro cada una.', side: 'bottom' },
      { before: () => setTab('tracking'), element: '.track-card.overview', title: '¿Vamos a tiempo?', text: 'El resumen del proyecto: avance, fecha de entrega y si va en tiempo.', side: 'bottom' },
      { element: '.stages-card', title: 'Etapas', text: 'Cada fase del proyecto con su avance.', side: 'top' },
      { element: '.links-card', title: 'Ver el proyecto', text: 'Enlaces para probar el sistema mientras se desarrolla, con sus accesos.', side: 'top' },
      { element: '.updates-card', title: 'Últimos avances', text: 'Las novedades que publica el equipo.', side: 'top' },
      { before: () => setTab('schedule'), element: '.sched-card', title: 'Cronograma', text: 'Etapas, tareas e hitos en el tiempo. Pasa el cursor por una barra para ver el detalle; las tareas en otro color son las que dependen de tu equipo.', side: 'top' },
      { before: () => setTab('comments'), element: '.comment-form', title: 'Comentarios', text: 'Conversa con el equipo sobre el proyecto. Te avisamos cuando te respondan.', side: 'top' },
      { before: () => setTab('requirements'), element: '.add-req-form', title: 'Requerimientos', text: '¿Necesitas algo nuevo o un cambio? Envíalo aquí y el equipo lo revisa y aprueba.', side: 'top' },
      { before: () => setTab('documents'), element: '.add-doc-form', title: 'Documentos', text: 'Contratos, manuales y entregables. Descárgalos o sube tus propios archivos.', side: 'top' },
      HELP_STEP,
    ],
  };
}

export type SupportTourMode = 'full' | 'form';

/**
 * Soporte. `full`: bandeja, botón "Nueva solicitud" y cada campo del formulario.
 * `form`: solo el formulario, ya abierto con la práctica del tutorial.
 */
export function supportTour(mode: SupportTourMode, openForm: () => void): TourDef {
  const form: TourStep[] = [
    {
      element: '#ticket-title', noBack: true,
      title: mode === 'form' ? 'Tu práctica ya está aquí' : 'Título',
      text: mode === 'form'
        ? 'Copiamos lo que escribiste en el tutorial. Revisa el título: que diga <b>qué falla y dónde</b>.'
        : 'Escribe en pocas palabras <b>qué falla y dónde</b>. Ej.: "El pago con tarjeta da error 500".',
      side: 'bottom',
      ...(mode === 'full' ? { before: openForm } : {}),
    },
    { element: '#ticket-description', title: 'Descripción', text: 'Cuenta <b>qué pasó, dónde, cómo repetirlo y desde cuándo</b>. Mientras más claro, más rápido lo resolvemos.', side: 'bottom' },
    { element: '.modal .form-grid-2', title: 'Categoría y prioridad', text: '¿Es un error, algo nuevo o una duda? ¿Qué tan grave es para tu operación? Elige con honestidad: así atendemos primero lo urgente.', side: 'top' },
    { element: '#ticket-attachment', title: 'Adjunta una captura', text: 'Una imagen vale más que mil palabras. En Windows: <kbd>Win</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>. Imagen o PDF de hasta 5 MB.', side: 'top' },
    { element: '.modal .sla-info', title: 'Tiempo de respuesta', text: 'Desde que la envías empieza a correr este tiempo garantizado. Te avisamos con una notificación en cada cambio.', side: 'top' },
    { element: '.modal-footer button[type="submit"]', title: '¡Tu turno!', text: 'Cuando el título y la descripción estén completos, este botón se activa. Pulsa <b>Enviar</b> y listo.', side: 'top', align: 'end' },
  ];
  if (mode === 'form') return { id: 'soporte', ready: '#ticket-title', steps: form };
  return {
    id: 'soporte',
    ready: '.list-pane .card, .list-pane .list-empty',
    steps: [
      { element: '.support-head h1', title: 'Tu centro de soporte', text: 'Aquí pides ayuda a 3TECH y sigues cada solicitud. Te lo muestro en un minuto.', side: 'bottom' },
      { element: '.list-pane .tabs', title: 'Tus solicitudes', text: 'En <b>Abiertas</b> ves lo que estamos atendiendo; en <b>Resueltas</b>, tu historial.', side: 'bottom' },
      { element: '.list-pane .cards', title: 'Cada tarjeta es una solicitud', text: 'Cuando el equipo te conteste verás la etiqueta <b>Nueva respuesta</b>. Pulsa una tarjeta para conversar.', side: 'right' },
      { element: '.btn-new', title: 'Crea una solicitud', text: 'Este botón abre el formulario. Pulsa <b>Siguiente</b> y lo abro por ti.', side: 'bottom', align: 'end' },
      ...form,
    ],
  };
}
