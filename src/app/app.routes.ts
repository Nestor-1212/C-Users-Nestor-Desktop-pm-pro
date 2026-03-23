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
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'companies',
        loadComponent: () => import('./features/companies/companies.component').then(m => m.CompaniesComponent),
        canActivate: [ownerGuard]
      },
      {
        path: 'projects',
        loadComponent: () => import('./features/projects/projects.component').then(m => m.ProjectsComponent)
      },
      {
        path: 'projects/:id',
        loadComponent: () => import('./features/projects/project-detail.component').then(m => m.ProjectDetailComponent)
      },
      {
        path: 'tickets',
        loadComponent: () => import('./features/tickets/tickets.component').then(m => m.TicketsComponent)
      },
      {
        path: 'tickets/:id',
        loadComponent: () => import('./features/tickets/ticket-detail.component').then(m => m.TicketDetailComponent)
      },
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];
