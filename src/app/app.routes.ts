import { Routes } from '@angular/router';
import { authGuard, ownerGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        data: { title: 'Dashboard' },
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'companies',
        data: { title: 'Empresas' },
        loadComponent: () => import('./features/companies/companies.component').then(m => m.CompaniesComponent),
        canActivate: [ownerGuard]
      },
      {
        path: 'users',
        data: { title: 'Usuarios' },
        loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent),
        canActivate: [ownerGuard]
      },
      {
        path: 'activity',
        data: { title: 'Bitácora de Actividad' },
        loadComponent: () => import('./features/activity/activity.component').then(m => m.ActivityComponent),
        canActivate: [ownerGuard]
      },
      {
        path: 'billing',
        data: { title: 'Facturación' },
        loadComponent: () => import('./features/billing/billing.component').then(m => m.BillingComponent)
      },
      {
        path: 'analytics',
        data: { title: 'Analíticas' },
        loadComponent: () => import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent),
        canActivate: [ownerGuard]
      },
      {
        path: 'projects',
        data: { title: 'Proyectos' },
        loadComponent: () => import('./features/projects/projects.component').then(m => m.ProjectsComponent)
      },
      {
        path: 'projects/:id',
        data: { title: 'Detalle de Proyecto' },
        loadComponent: () => import('./features/projects/project-detail.component').then(m => m.ProjectDetailComponent)
      },
      {
        path: 'tickets',
        data: { title: 'Tickets' },
        loadComponent: () => import('./features/tickets/tickets.component').then(m => m.TicketsComponent)
      },
      {
        path: 'tickets/:id',
        data: { title: 'Detalle de Ticket' },
        loadComponent: () => import('./features/tickets/ticket-detail.component').then(m => m.TicketDetailComponent)
      },
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];
