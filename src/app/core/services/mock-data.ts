import { User, Company, Project, Ticket, Invoice } from '../models';

export const MOCK_USERS: User[] = [
  { id: 'u1', username: 'owner', password: 'owner123', role: 'owner', name: 'Administrador Sistema', email: 'admin@pmpro.com' },
  { id: 'u2', username: 'empresa1', password: 'emp123', role: 'client', companyId: 'c1', name: 'Carlos López', email: 'carlos@techsolutions.com' },
  { id: 'u3', username: 'empresa2', password: 'emp456', role: 'client', companyId: 'c2', name: 'Ana Martínez', email: 'ana@innovacorp.com' },
  { id: 'u4', username: 'empresa3', password: 'emp789', role: 'client', companyId: 'c3', name: 'Pedro Ramírez', email: 'pedro@globaltech.com' },
  { id: 'u5', username: 'empresa4', password: 'emp111', role: 'client', companyId: 'c5', name: 'Lucía Fernández', email: 'lucia@brightwave.com' },
  { id: 'u6', username: 'empresa5', password: 'emp222', role: 'client', companyId: 'c6', name: 'Jorge Castillo', email: 'jorge@northstarlog.com' },
  { id: 'u7', username: 'empresa6', password: 'emp333', role: 'client', companyId: 'c7', name: 'Valeria Soto', email: 'valeria@vertexstudios.com' },
  { id: 'u8', username: 'empresa1b', password: 'emp999', role: 'client', companyId: 'c1', name: 'Sofía Mendoza', email: 'sofia@techsolutions.com' },
];

export const MOCK_COMPANIES: Company[] = [
  { id: 'c1', name: 'TechSolutions S.A.', email: 'contact@techsolutions.com', phone: '+502 5555-0001', address: 'Zona 10, Guatemala City', status: 'active', createdAt: '2025-01-15', plan: 'Premium' },
  { id: 'c2', name: 'InnovaCorp', email: 'info@innovacorp.com', phone: '+502 5555-0002', address: 'Zona 4, Guatemala City', status: 'active', createdAt: '2025-03-01', plan: 'Standard' },
  { id: 'c3', name: 'GlobalTech Ltd.', email: 'hello@globaltech.com', phone: '+502 5555-0003', address: 'Antigua Guatemala', status: 'inactive', createdAt: '2024-11-20', plan: 'Basic' },
  { id: 'c4', name: 'DataPro Inc.', email: 'data@datapro.com', phone: '+502 5555-0004', address: 'Zona 14, Guatemala City', status: 'active', createdAt: '2026-01-10', plan: 'Premium' },
  { id: 'c5', name: 'BrightWave Solutions', email: 'hello@brightwave.com', phone: '+502 5555-0005', address: 'Zona 9, Guatemala City', status: 'active', createdAt: '2026-04-10', plan: 'Premium' },
  { id: 'c6', name: 'NorthStar Logistics', email: 'contact@northstarlog.com', phone: '+502 5555-0006', address: 'Mixco, Guatemala', status: 'active', createdAt: '2026-05-22', plan: 'Standard' },
  { id: 'c7', name: 'Vertex Studios', email: 'info@vertexstudios.com', phone: '+502 5555-0007', address: 'Zona 1, Guatemala City', status: 'active', createdAt: '2026-06-15', plan: 'Basic' },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1', name: 'Portal E-Commerce TechSolutions', description: 'Desarrollo de plataforma de comercio electrónico con pasarela de pagos integrada.',
    companyId: 'c1', status: 'in_progress', progress: 65, priority: 'high',
    startDate: '2025-11-01', endDate: '2026-04-30', budget: 25000,
    internalNotes: 'Cliente muy exigente. Requiere reuniones semanales.',
    tags: ['e-commerce', 'web', 'payments'], createdAt: '2025-10-20', updatedAt: '2026-03-15',
    comments: [
      { id: 'cm1', projectId: 'p1', authorId: 'u2', authorName: 'Carlos López', authorRole: 'client', content: 'Necesitamos integrar también PayPal además de tarjetas.', createdAt: '2026-01-10', isInternal: false },
      { id: 'cm2', projectId: 'p1', authorId: 'u1', authorName: 'Administrador', authorRole: 'owner', content: 'Confirmado. Incluiremos PayPal en el sprint 3.', createdAt: '2026-01-11', isInternal: false },
    ],
    requirements: [
      { id: 'r1', projectId: 'p1', title: 'Módulo de inventario', description: 'Control de stock en tiempo real con alertas de bajo inventario.', status: 'approved', createdBy: 'u2', createdAt: '2025-11-05' },
      { id: 'r2', projectId: 'p1', title: 'App móvil', description: 'Versión móvil del portal para iOS y Android.', status: 'pending', createdBy: 'u2', createdAt: '2026-02-01' },
    ],
    documents: [
      { id: 'd1', projectId: 'p1', name: 'Propuesta técnica v2.pdf', type: 'pdf', size: 2048000, uploadedBy: 'Administrador', uploadedAt: '2025-10-25' },
    ]
  },
  {
    id: 'p2', name: 'Sistema CRM InnovaCorp', description: 'Implementación de CRM personalizado para gestión de clientes y ventas.',
    companyId: 'c2', status: 'planning', progress: 15, priority: 'medium',
    startDate: '2026-03-01', endDate: '2026-08-31', budget: 18000,
    internalNotes: 'Integración con sistema legacy existente.',
    tags: ['crm', 'web', 'integración'], createdAt: '2026-02-10', updatedAt: '2026-03-10',
    comments: [],
    requirements: [
      { id: 'r3', projectId: 'p2', title: 'Migración de datos', description: 'Migrar 5000 registros del sistema anterior.', status: 'pending', createdBy: 'u3', createdAt: '2026-02-15' },
    ],
    documents: []
  },
  {
    id: 'p3', name: 'App Gestión de Flotas GlobalTech', description: 'Aplicación móvil para rastreo y gestión de flotilla de vehículos.',
    companyId: 'c3', status: 'on_hold', progress: 40, priority: 'low',
    startDate: '2025-09-01', endDate: '2026-03-31', budget: 12000,
    internalNotes: 'Pausado por cambios internos del cliente.',
    tags: ['mobile', 'gps', 'fleet'], createdAt: '2025-08-15', updatedAt: '2026-01-20',
    comments: [],
    requirements: [],
    documents: []
  },
  {
    id: 'p4', name: 'Dashboard Analytics DataPro', description: 'Panel de análisis de datos con reportes en tiempo real.',
    companyId: 'c4', status: 'review', progress: 90, priority: 'critical',
    startDate: '2025-12-01', endDate: '2026-03-31', budget: 30000,
    internalNotes: 'En etapa final de revisión con el cliente.',
    tags: ['analytics', 'dashboard', 'bi'], createdAt: '2025-11-20', updatedAt: '2026-03-18',
    comments: [
      { id: 'cm3', projectId: 'p4', authorId: 'u1', authorName: 'Administrador', authorRole: 'owner', content: 'Entregamos staging para revisión. Favor validar módulo de reportes.', createdAt: '2026-03-18', isInternal: false },
    ],
    requirements: [],
    documents: [
      { id: 'd2', projectId: 'p4', name: 'Manual de usuario.pdf', type: 'pdf', size: 1024000, uploadedBy: 'Administrador', uploadedAt: '2026-03-10' },
    ]
  },
  {
    id: 'p5', name: 'Rediseño Web TechSolutions', description: 'Renovación completa del sitio corporativo con nueva identidad visual.',
    companyId: 'c1', status: 'completed', progress: 100, priority: 'medium',
    startDate: '2025-06-01', endDate: '2025-10-31', budget: 8000,
    tags: ['web', 'design', 'branding'], createdAt: '2025-05-20', updatedAt: '2025-11-05',
    comments: [],
    requirements: [],
    documents: []
  },
  {
    id: 'p6', name: 'Integración API de Pagos', description: 'Conectar pasarela de pagos propia con el ERP interno de BrightWave.',
    companyId: 'c5', status: 'in_progress', progress: 45, priority: 'high',
    startDate: '2026-07-01', endDate: '2026-11-30', budget: 15000,
    tags: ['api', 'payments'], createdAt: '2026-06-25', updatedAt: '2026-09-20',
    comments: [], requirements: [], documents: []
  },
  {
    id: 'p7', name: 'App Móvil de Seguimiento', description: 'Aplicación móvil para que los clientes de NorthStar rastreen sus envíos en tiempo real.',
    companyId: 'c6', status: 'planning', progress: 10, priority: 'medium',
    startDate: '2026-09-01', endDate: '2027-02-28', budget: 22000,
    tags: ['mobile', 'logistics'], createdAt: '2026-08-20', updatedAt: '2026-09-05',
    comments: [], requirements: [], documents: []
  },
  {
    id: 'p8', name: 'Rediseño de Marca', description: 'Actualización de identidad visual y sitio web de Vertex Studios.',
    companyId: 'c7', status: 'completed', progress: 100, priority: 'low',
    startDate: '2026-05-01', endDate: '2026-07-31', budget: 6000,
    tags: ['design', 'branding'], createdAt: '2026-04-28', updatedAt: '2026-08-01',
    comments: [], requirements: [], documents: []
  },
  {
    id: 'p9', name: 'Migración a la Nube', description: 'Migrar infraestructura on-premise de DataPro a AWS.',
    companyId: 'c4', status: 'in_progress', progress: 60, priority: 'critical',
    startDate: '2026-06-01', endDate: '2026-12-15', budget: 35000,
    internalNotes: 'Requiere ventana de mantenimiento nocturna para el corte final.',
    tags: ['cloud', 'infraestructura'], createdAt: '2026-05-20', updatedAt: '2026-09-28',
    comments: [], requirements: [], documents: []
  },
  {
    id: 'p10', name: 'Portal de Autoservicio', description: 'Portal para que los clientes de TechSolutions gestionen sus propios tickets de soporte de nivel 1.',
    companyId: 'c1', status: 'review', progress: 85, priority: 'medium',
    startDate: '2026-05-15', endDate: '2026-10-20', budget: 18000,
    tags: ['web', 'self-service'], createdAt: '2026-05-10', updatedAt: '2026-10-01',
    comments: [], requirements: [], documents: []
  },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 't1', companyId: 'c1', companyName: 'TechSolutions S.A.', title: 'Error en pasarela de pagos', description: 'Al procesar pagos con Visa, el sistema devuelve error 500 y no confirma la transacción.',
    category: 'bug', status: 'in_review', priority: 'critical',
    createdAt: '2026-03-20T10:30:00', updatedAt: '2026-03-20T14:00:00',
    slaDeadline: '2026-03-21T10:30:00',
    responses: [
      { id: 'tr1', ticketId: 't1', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Hemos recibido tu reporte. El equipo técnico está investigando el problema. Te contactaremos en máximo 2 horas.', createdAt: '2026-03-20T14:00:00' },
    ]
  },
  {
    id: 't2', companyId: 'c2', companyName: 'InnovaCorp', title: 'Solicitud de nueva funcionalidad en CRM', description: 'Necesitamos agregar un módulo de seguimiento de cotizaciones con estados personalizables.',
    category: 'feature', status: 'open', priority: 'medium',
    createdAt: '2026-03-21T09:00:00', updatedAt: '2026-03-21T09:00:00',
    slaDeadline: '2026-03-22T09:00:00',
    responses: []
  },
  {
    id: 't3', companyId: 'c1', companyName: 'TechSolutions S.A.', title: 'Lentitud en carga del dashboard', description: 'El módulo de estadísticas tarda más de 30 segundos en cargar los reportes.',
    category: 'bug', status: 'resolved', priority: 'high',
    createdAt: '2026-03-05T11:00:00', updatedAt: '2026-03-07T16:00:00',
    slaDeadline: '2026-03-06T11:00:00', resolvedAt: '2026-03-07T16:00:00',
    responses: [
      { id: 'tr2', ticketId: 't3', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Identificamos el problema: consultas SQL sin índices. Se aplicó optimización.', createdAt: '2026-03-06T10:00:00' },
      { id: 'tr3', ticketId: 't3', authorId: 'u2', authorName: 'Carlos López', authorRole: 'client', content: 'Confirmamos que el problema fue resuelto. Ahora carga en 2 segundos.', createdAt: '2026-03-07T16:00:00' },
    ]
  },
  {
    id: 't4', companyId: 'c3', companyName: 'GlobalTech Ltd.', title: 'Problema con acceso al portal', description: 'Los usuarios no pueden iniciar sesión desde ciertos navegadores (Safari en iOS).',
    category: 'support', status: 'closed', priority: 'medium',
    createdAt: '2026-02-28T14:00:00', updatedAt: '2026-03-01T10:00:00',
    slaDeadline: '2026-03-01T14:00:00', resolvedAt: '2026-03-01T10:00:00',
    responses: [
      { id: 'tr4', ticketId: 't4', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Problema resuelto: incompatibilidad con cookies SameSite en Safari. Corregido en v1.2.1.', createdAt: '2026-03-01T10:00:00' },
    ]
  },
  {
    id: 't5', companyId: 'c1', companyName: 'TechSolutions S.A.', title: 'Error al exportar reporte a Excel', description: 'El botón de exportar no genera el archivo cuando hay más de 500 filas.',
    category: 'bug', status: 'resolved', priority: 'high',
    createdAt: '2026-08-03T09:00:00', updatedAt: '2026-08-03T11:30:00',
    slaDeadline: '2026-08-03T13:00:00', resolvedAt: '2026-08-03T11:30:00',
    satisfactionRating: 5, satisfactionComment: '¡Rapidísimos, gracias!', ratedAt: '2026-08-03T12:00:00',
    responses: [
      { id: 'tr5', ticketId: 't5', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Corregido: el límite de filas del exportador estaba mal configurado. Ya soporta hasta 50,000 filas.', createdAt: '2026-08-03T11:30:00' },
    ]
  },
  {
    id: 't6', companyId: 'c2', companyName: 'InnovaCorp', title: 'Solicitud de integración con WhatsApp', description: 'Nos gustaría recibir notificaciones de nuevas cotizaciones por WhatsApp Business.',
    category: 'feature', status: 'open', priority: 'medium',
    createdAt: '2026-08-07T10:00:00', updatedAt: '2026-08-07T10:00:00',
    slaDeadline: '2026-08-07T22:00:00',
    responses: []
  },
  {
    id: 't7', companyId: 'c1', companyName: 'TechSolutions S.A.', title: 'Falla en notificaciones push', description: 'Los usuarios no reciben notificaciones push en Android desde la última actualización.',
    category: 'bug', status: 'resolved', priority: 'critical',
    createdAt: '2026-08-12T08:00:00', updatedAt: '2026-08-12T14:00:00',
    slaDeadline: '2026-08-12T12:00:00', resolvedAt: '2026-08-12T14:00:00',
    satisfactionRating: 3, satisfactionComment: 'Se resolvió pero tardó más de lo esperado.', ratedAt: '2026-08-12T15:00:00',
    responses: [
      { id: 'tr6', ticketId: 't7', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Identificamos un certificado FCM vencido. Renovado y verificado en producción.', createdAt: '2026-08-12T14:00:00' },
    ]
  },
  {
    id: 't8', companyId: 'c4', companyName: 'DataPro Inc.', title: 'Actualizar certificado SSL', description: 'El certificado SSL del subdominio de reportes vence esta semana.',
    category: 'support', status: 'resolved', priority: 'medium',
    createdAt: '2026-08-15T09:00:00', updatedAt: '2026-08-15T12:00:00',
    slaDeadline: '2026-08-15T13:00:00', resolvedAt: '2026-08-15T12:00:00',
    satisfactionRating: 5, ratedAt: '2026-08-15T13:00:00',
    responses: [
      { id: 'tr7', ticketId: 't8', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Certificado renovado y desplegado. Válido por 12 meses más.', createdAt: '2026-08-15T12:00:00' },
    ]
  },
  {
    id: 't9', companyId: 'c3', companyName: 'GlobalTech Ltd.', title: 'Duda sobre factura de agosto', description: 'No entendemos el concepto de un cargo adicional en la factura de este mes.',
    category: 'billing', status: 'closed', priority: 'low',
    createdAt: '2026-08-18T11:00:00', updatedAt: '2026-08-19T09:00:00',
    slaDeadline: '2026-08-19T11:00:00', resolvedAt: '2026-08-19T09:00:00',
    responses: [
      { id: 'tr8', ticketId: 't9', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Ese cargo corresponde a un addon de almacenamiento extra contratado en julio. Te enviamos el detalle por correo.', createdAt: '2026-08-19T09:00:00' },
    ]
  },
  {
    id: 't10', companyId: 'c5', companyName: 'BrightWave Solutions', title: 'Error 500 al iniciar sesión', description: 'Algunos usuarios reciben error 500 al intentar iniciar sesión desde esta mañana.',
    category: 'bug', status: 'resolved', priority: 'critical',
    createdAt: '2026-08-22T07:30:00', updatedAt: '2026-08-22T10:00:00',
    slaDeadline: '2026-08-22T11:30:00', resolvedAt: '2026-08-22T10:00:00',
    satisfactionRating: 4, ratedAt: '2026-08-22T11:00:00',
    responses: [
      { id: 'tr9', ticketId: 't10', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'El servicio de autenticación tuvo una sobrecarga temporal. Escalamos recursos y monitoreamos.', createdAt: '2026-08-22T10:00:00' },
    ]
  },
  {
    id: 't11', companyId: 'c2', companyName: 'InnovaCorp', title: 'Lentitud en reportes mensuales', description: 'El reporte de ventas mensuales tarda más de un minuto en generarse.',
    category: 'bug', status: 'in_review', priority: 'medium',
    createdAt: '2026-08-25T13:00:00', updatedAt: '2026-08-26T09:00:00',
    slaDeadline: '2026-08-26T01:00:00',
    responses: [
      { id: 'tr10', ticketId: 't11', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Estamos perfilando la consulta para identificar el cuello de botella.', createdAt: '2026-08-26T09:00:00' },
    ]
  },
  {
    id: 't12', companyId: 'c6', companyName: 'NorthStar Logistics', title: 'Capacitación para nuevo módulo', description: 'Solicitamos una sesión de capacitación para el equipo sobre el módulo de rutas.',
    category: 'support', status: 'resolved', priority: 'low',
    createdAt: '2026-08-28T10:00:00', updatedAt: '2026-08-29T08:00:00',
    slaDeadline: '2026-08-28T22:00:00', resolvedAt: '2026-08-29T08:00:00',
    satisfactionRating: 3, satisfactionComment: 'Buena sesión, aunque se agendó con unos días de retraso.', ratedAt: '2026-08-29T09:00:00',
    responses: [
      { id: 'tr11', ticketId: 't12', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Sesión agendada y realizada con el equipo de operaciones. Grabación enviada por correo.', createdAt: '2026-08-29T08:00:00' },
    ]
  },
  {
    id: 't13', companyId: 'c1', companyName: 'TechSolutions S.A.', title: 'Agregar filtro de fechas en dashboard', description: 'Nos gustaría poder filtrar el dashboard por rango de fechas personalizado.',
    category: 'feature', status: 'open', priority: 'low',
    createdAt: '2026-09-02T09:00:00', updatedAt: '2026-09-02T09:00:00',
    slaDeadline: '2026-09-02T13:00:00',
    responses: []
  },
  {
    id: 't14', companyId: 'c7', companyName: 'Vertex Studios', title: 'No se pueden subir imágenes mayores a 2MB', description: 'El uploader de assets rechaza imágenes de alta resolución que usamos para mockups.',
    category: 'bug', status: 'resolved', priority: 'medium',
    createdAt: '2026-09-05T15:00:00', updatedAt: '2026-09-06T10:00:00',
    slaDeadline: '2026-09-06T15:00:00', resolvedAt: '2026-09-06T10:00:00',
    satisfactionRating: 4, ratedAt: '2026-09-06T11:00:00',
    responses: [
      { id: 'tr12', ticketId: 't14', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Aumentamos el límite a 10MB por archivo para el plan de Vertex.', createdAt: '2026-09-06T10:00:00' },
    ]
  },
  {
    id: 't15', companyId: 'c4', companyName: 'DataPro Inc.', title: 'Revisión de permisos de usuario', description: 'Un ex-empleado todavía tiene acceso al sistema. Es urgente revocarlo.',
    category: 'support', status: 'escalated', priority: 'critical',
    createdAt: '2026-09-10T09:00:00', updatedAt: '2026-09-10T09:30:00',
    slaDeadline: '2026-09-10T13:00:00',
    responses: [
      { id: 'tr13', ticketId: 't15', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Escalado al equipo de seguridad para revocación inmediata de accesos.', createdAt: '2026-09-10T09:30:00' },
    ]
  },
  {
    id: 't16', companyId: 'c1', companyName: 'TechSolutions S.A.', title: 'Checkout falla con tarjetas AMEX', description: 'Los pagos con American Express son rechazados en el checkout.',
    category: 'bug', status: 'resolved', priority: 'critical',
    createdAt: '2026-09-14T08:00:00', updatedAt: '2026-09-14T11:00:00',
    slaDeadline: '2026-09-14T12:00:00', resolvedAt: '2026-09-14T11:00:00',
    satisfactionRating: 5, satisfactionComment: 'Excelente soporte, resuelto muy rápido.', ratedAt: '2026-09-14T12:00:00',
    responses: [
      { id: 'tr14', ticketId: 't16', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Faltaba habilitar AMEX en la configuración de la pasarela. Ya está activo y probado.', createdAt: '2026-09-14T11:00:00' },
    ]
  },
  {
    id: 't17', companyId: 'c2', companyName: 'InnovaCorp', title: 'Nueva funcionalidad: exportar a PDF', description: 'Necesitamos poder exportar las cotizaciones a PDF directamente desde el CRM.',
    category: 'feature', status: 'closed', priority: 'medium',
    createdAt: '2026-09-18T10:00:00', updatedAt: '2026-09-19T09:00:00',
    slaDeadline: '2026-09-18T22:00:00', resolvedAt: '2026-09-19T09:00:00',
    responses: [
      { id: 'tr15', ticketId: 't17', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Funcionalidad liberada en producción. Encuéntrala en el botón "Exportar" de cada cotización.', createdAt: '2026-09-19T09:00:00' },
    ]
  },
  {
    id: 't18', companyId: 'c5', companyName: 'BrightWave Solutions', title: 'Consulta sobre upgrade de plan', description: '¿Qué beneficios obtendríamos al subir de Standard a Premium?',
    category: 'billing', status: 'resolved', priority: 'low',
    createdAt: '2026-09-22T11:00:00', updatedAt: '2026-09-22T13:30:00',
    slaDeadline: '2026-09-22T15:00:00', resolvedAt: '2026-09-22T13:30:00',
    satisfactionRating: 5, ratedAt: '2026-09-22T14:00:00',
    responses: [
      { id: 'tr16', ticketId: 't18', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Te compartimos el comparativo de planes y el SLA de 4h que aplica a Premium.', createdAt: '2026-09-22T13:30:00' },
    ]
  },
  {
    id: 't19', companyId: 'c3', companyName: 'GlobalTech Ltd.', title: 'Portal lento en horas pico', description: 'Entre 2pm y 4pm el portal se vuelve muy lento para todos los usuarios.',
    category: 'bug', status: 'open', priority: 'high',
    createdAt: '2026-09-28T09:00:00', updatedAt: '2026-09-28T09:00:00',
    slaDeadline: '2026-09-29T09:00:00',
    responses: []
  },
  {
    id: 't20', companyId: 'c6', companyName: 'NorthStar Logistics', title: 'Error en cálculo de inventario', description: 'El inventario disponible no coincide con el reportado en bodega física.',
    category: 'bug', status: 'in_review', priority: 'high',
    createdAt: '2026-10-02T08:00:00', updatedAt: '2026-10-02T10:00:00',
    slaDeadline: '2026-10-02T20:00:00',
    responses: [
      { id: 'tr17', ticketId: 't20', authorId: 'u1', authorName: 'Soporte Tikets y Proceso', authorRole: 'owner', content: 'Revisando el job de sincronización nocturna de inventario.', createdAt: '2026-10-02T10:00:00' },
    ]
  },
  {
    id: 't21', companyId: 'c1', companyName: 'TechSolutions S.A.', title: 'Mejorar tiempo de carga del dashboard', description: 'El dashboard principal tarda varios segundos en mostrar las gráficas.',
    category: 'feature', status: 'open', priority: 'medium',
    createdAt: '2026-10-05T09:00:00', updatedAt: '2026-10-05T09:00:00',
    slaDeadline: '2026-10-05T13:00:00',
    responses: []
  },
];

export const MOCK_INVOICES: Invoice[] = [
  { id: 'inv1', companyId: 'c1', companyName: 'TechSolutions S.A.', concept: 'Mensualidad Plan Premium - Septiembre 2026', amount: 2500, issueDate: '2026-09-01', dueDate: '2026-09-15', status: 'paid', paidAt: '2026-09-10T09:00:00', createdAt: '2026-09-01T08:00:00' },
  { id: 'inv2', companyId: 'c1', companyName: 'TechSolutions S.A.', concept: 'Mensualidad Plan Premium - Octubre 2026', amount: 2500, issueDate: '2026-10-01', dueDate: '2026-10-15', status: 'pending', createdAt: '2026-10-01T08:00:00' },
  { id: 'inv3', companyId: 'c2', companyName: 'InnovaCorp', concept: 'Mensualidad Plan Standard - Septiembre 2026', amount: 1200, issueDate: '2026-09-01', dueDate: '2026-09-20', status: 'pending', createdAt: '2026-09-01T08:00:00' },
  { id: 'inv4', companyId: 'c3', companyName: 'GlobalTech Ltd.', concept: 'Mensualidad Plan Basic - Agosto 2026', amount: 600, issueDate: '2026-08-01', dueDate: '2026-08-15', status: 'pending', createdAt: '2026-08-01T08:00:00' },
  { id: 'inv5', companyId: 'c4', companyName: 'DataPro Inc.', concept: 'Mensualidad Plan Premium - Septiembre 2026', amount: 2500, issueDate: '2026-09-01', dueDate: '2026-09-15', status: 'paid', paidAt: '2026-09-05T11:00:00', createdAt: '2026-09-01T08:00:00' },
  { id: 'inv6', companyId: 'c1', companyName: 'TechSolutions S.A.', concept: 'Mensualidad Plan Premium - Mayo 2026', amount: 2500, issueDate: '2026-05-01', dueDate: '2026-05-15', status: 'paid', paidAt: '2026-05-10T09:00:00', createdAt: '2026-05-01T08:00:00' },
  { id: 'inv7', companyId: 'c1', companyName: 'TechSolutions S.A.', concept: 'Mensualidad Plan Premium - Junio 2026', amount: 2500, issueDate: '2026-06-01', dueDate: '2026-06-15', status: 'paid', paidAt: '2026-06-12T09:00:00', createdAt: '2026-06-01T08:00:00' },
  { id: 'inv8', companyId: 'c1', companyName: 'TechSolutions S.A.', concept: 'Mensualidad Plan Premium - Julio 2026', amount: 2500, issueDate: '2026-07-01', dueDate: '2026-07-15', status: 'paid', paidAt: '2026-07-14T09:00:00', createdAt: '2026-07-01T08:00:00' },
  { id: 'inv9', companyId: 'c1', companyName: 'TechSolutions S.A.', concept: 'Mensualidad Plan Premium - Agosto 2026', amount: 2500, issueDate: '2026-08-01', dueDate: '2026-08-15', status: 'paid', paidAt: '2026-08-13T09:00:00', createdAt: '2026-08-01T08:00:00' },
  { id: 'inv10', companyId: 'c2', companyName: 'InnovaCorp', concept: 'Mensualidad Plan Standard - Agosto 2026', amount: 1200, issueDate: '2026-08-01', dueDate: '2026-08-20', status: 'paid', paidAt: '2026-08-18T09:00:00', createdAt: '2026-08-01T08:00:00' },
  { id: 'inv11', companyId: 'c2', companyName: 'InnovaCorp', concept: 'Mensualidad Plan Standard - Octubre 2026', amount: 1200, issueDate: '2026-10-01', dueDate: '2026-10-20', status: 'pending', createdAt: '2026-10-01T08:00:00' },
  { id: 'inv12', companyId: 'c5', companyName: 'BrightWave Solutions', concept: 'Mensualidad Plan Premium - Septiembre 2026', amount: 2800, issueDate: '2026-09-01', dueDate: '2026-09-15', status: 'paid', paidAt: '2026-09-12T09:00:00', createdAt: '2026-09-01T08:00:00' },
  { id: 'inv13', companyId: 'c5', companyName: 'BrightWave Solutions', concept: 'Mensualidad Plan Premium - Octubre 2026', amount: 2800, issueDate: '2026-10-01', dueDate: '2026-10-15', status: 'pending', createdAt: '2026-10-01T08:00:00' },
  { id: 'inv14', companyId: 'c6', companyName: 'NorthStar Logistics', concept: 'Mensualidad Plan Standard - Septiembre 2026', amount: 1300, issueDate: '2026-09-01', dueDate: '2026-09-20', status: 'paid', paidAt: '2026-09-18T09:00:00', createdAt: '2026-09-01T08:00:00' },
  { id: 'inv15', companyId: 'c7', companyName: 'Vertex Studios', concept: 'Mensualidad Plan Basic - Septiembre 2026', amount: 650, issueDate: '2026-09-01', dueDate: '2026-09-15', status: 'pending', createdAt: '2026-09-01T08:00:00' },
];
