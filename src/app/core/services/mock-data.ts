import { User, Company, Project, Ticket } from '../models';

export const MOCK_USERS: User[] = [
  { id: 'u1', username: 'owner', password: 'owner123', role: 'owner', name: 'Administrador Sistema', email: 'admin@pmpro.com' },
  { id: 'u2', username: 'empresa1', password: 'emp123', role: 'client', companyId: 'c1', name: 'Carlos López', email: 'carlos@techsolutions.com' },
  { id: 'u3', username: 'empresa2', password: 'emp456', role: 'client', companyId: 'c2', name: 'Ana Martínez', email: 'ana@innovacorp.com' },
  { id: 'u4', username: 'empresa3', password: 'emp789', role: 'client', companyId: 'c3', name: 'Pedro Ramírez', email: 'pedro@globaltech.com' },
];

export const MOCK_COMPANIES: Company[] = [
  { id: 'c1', name: 'TechSolutions S.A.', email: 'contact@techsolutions.com', phone: '+502 5555-0001', address: 'Zona 10, Guatemala City', status: 'active', createdAt: '2025-01-15', plan: 'Premium' },
  { id: 'c2', name: 'InnovaCorp', email: 'info@innovacorp.com', phone: '+502 5555-0002', address: 'Zona 4, Guatemala City', status: 'active', createdAt: '2025-03-01', plan: 'Standard' },
  { id: 'c3', name: 'GlobalTech Ltd.', email: 'hello@globaltech.com', phone: '+502 5555-0003', address: 'Antigua Guatemala', status: 'inactive', createdAt: '2024-11-20', plan: 'Basic' },
  { id: 'c4', name: 'DataPro Inc.', email: 'data@datapro.com', phone: '+502 5555-0004', address: 'Zona 14, Guatemala City', status: 'active', createdAt: '2026-01-10', plan: 'Premium' },
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
];

const now = new Date();
const sla = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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
];
