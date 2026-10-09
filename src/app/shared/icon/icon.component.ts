import { Component, input } from '@angular/core';

export type IconName =
  | 'lock' | 'eye' | 'eye-off' | 'check' | 'crown' | 'building'
  | 'chart' | 'folder' | 'ticket' | 'log-out' | 'chevron-left'
  | 'chevron-right' | 'menu' | 'settings' | 'alert-triangle'
  | 'plus' | 'edit' | 'trash' | 'mail' | 'phone' | 'map-pin' | 'x'
  | 'search' | 'user' | 'users' | 'calendar' | 'clock' | 'inbox'
  | 'dollar-sign' | 'message-circle' | 'clipboard' | 'paperclip' | 'tag'
  | 'file-text' | 'image' | 'archive' | 'download' | 'upload' | 'loader'
  | 'send' | 'bell' | 'star';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      [attr.fill]="filled() ? 'currentColor' : 'none'"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @switch (name()) {
        @case ('lock') {
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        }
        @case ('eye') {
          <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        }
        @case ('eye-off') {
          <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c7 0 10.5 7 10.5 7a15.3 15.3 0 0 1-3.2 4.1M6.5 6.6C3.8 8.4 1.5 12 1.5 12S5 19 12 19a10.7 10.7 0 0 0 4.2-.8" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          <path d="M3 3l18 18" />
        }
        @case ('check') {
          <path d="M20 6 9 17l-5-5" />
        }
        @case ('crown') {
          <path d="M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4L3 18Z" />
        }
        @case ('building') {
          <rect x="4" y="3" width="16" height="18" rx="1" />
          <path d="M9 21v-4h6v4M9 8h1M14 8h1M9 12h1M14 12h1" />
        }
        @case ('chart') {
          <path d="M4 20V10M12 20V4M20 20v-7" />
        }
        @case ('folder') {
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        }
        @case ('ticket') {
          <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9Z" />
          <path d="M10 7v10" stroke-dasharray="2 2.4" />
        }
        @case ('log-out') {
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        }
        @case ('chevron-left') {
          <path d="M15 18l-6-6 6-6" />
        }
        @case ('chevron-right') {
          <path d="M9 18l6-6-6-6" />
        }
        @case ('menu') {
          <path d="M3 6h18M3 12h18M3 18h18" />
        }
        @case ('settings') {
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        }
        @case ('alert-triangle') {
          <path d="M10.3 3.9 1.8 18a1.5 1.5 0 0 0 1.3 2.2h17.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('edit') {
          <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
          <path d="M18.4 3.4a2 2 0 0 1 2.8 2.8L12 15.4l-4 1 1-4 9.4-9.4Z" />
        }
        @case ('trash') {
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
          <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        }
        @case ('mail') {
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 7.5 6L19 7" />
        }
        @case ('phone') {
          <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1.5 1.5 0 0 1 1.5-.4 11 11 0 0 0 3.1.5 1.5 1.5 0 0 1 1.5 1.5V20a1.5 1.5 0 0 1-1.5 1.5A17.5 17.5 0 0 1 2.5 4 1.5 1.5 0 0 1 4 2.5h3.2a1.5 1.5 0 0 1 1.5 1.5 11 11 0 0 0 .5 3.1 1.5 1.5 0 0 1-.4 1.5Z" />
        }
        @case ('map-pin') {
          <path d="M20 10.5c0 5-8 11.5-8 11.5s-8-6.5-8-11.5a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10.5" r="2.5" />
        }
        @case ('x') {
          <path d="M18 6 6 18M6 6l12 12" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        }
        @case ('user') {
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
        }
        @case ('users') {
          <circle cx="9" cy="8" r="3.2" />
          <path d="M2.5 19c0-3 2.9-5.2 6.5-5.2s6.5 2.2 6.5 5.2" />
          <path d="M16 4.3a3.2 3.2 0 0 1 0 6.1" />
          <path d="M18.5 13.9c2.1.5 3.5 2.2 3.5 4.3" />
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        }
        @case ('inbox') {
          <path d="M4 12h4l2 3h4l2-3h4" />
          <path d="M5.5 5h13l2.5 7v7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19v-7l2.5-7Z" />
        }
        @case ('dollar-sign') {
          <path d="M12 2v20" />
          <path d="M16.5 6.5a3.5 3.5 0 0 0-3.3-2.5h-1.9a3.3 3.3 0 0 0 0 6.6h2.4a3.4 3.4 0 0 1 0 6.8h-2a3.5 3.5 0 0 1-3.3-2.5" />
        }
        @case ('message-circle') {
          <path d="M21 11.5a8.4 8.4 0 0 1-9.2 8.4 8.8 8.8 0 0 1-3-.6L3 21l1.8-5A8.4 8.4 0 1 1 21 11.5Z" />
        }
        @case ('clipboard') {
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <path d="M9 11h6M9 15h6" />
        }
        @case ('paperclip') {
          <path d="M8 10 15.5 2.5a3.5 3.5 0 0 1 5 5L10 18a5 5 0 0 1-7-7l8-8" />
        }
        @case ('tag') {
          <path d="M3 3h8.4a2 2 0 0 1 1.4.6l7.6 7.6a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L3 13.6V3Z" />
          <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
        }
        @case ('file-text') {
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h6M9 17h6" />
        }
        @case ('image') {
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m21 16-5-5-4 4-2-2-5 5" />
        }
        @case ('archive') {
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
          <path d="M10 13h4" />
        }
        @case ('download') {
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        }
        @case ('upload') {
          <path d="M12 21V9" />
          <path d="m7 14 5-5 5 5" />
          <path d="M5 3h14" />
        }
        @case ('loader') {
          <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        }
        @case ('send') {
          <path d="M21 3 11 13" />
          <path d="M21 3 14.5 21a.6.6 0 0 1-1.1 0L11 13l-8-2.4a.6.6 0 0 1 0-1.1L21 3Z" />
        }
        @case ('bell') {
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        }
        @case ('star') {
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
        }
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; line-height: 0; flex-shrink: 0; }
    svg { display: block; }
  `]
})
export class IconComponent {
  name = input.required<IconName>();
  size = input(20);
  strokeWidth = input(1.75);
  filled = input(false);
}
