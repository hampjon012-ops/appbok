/**
 * Roll-märke i sidomenyns användarsektion (synlig roll i panelen).
 */
export function getSidebarRoleBadge(role) {
  switch (role) {
    case 'superadmin':
      return { label: 'SUPERADMIN', variant: 'superadmin' };
    case 'staff':
      return { label: 'PERSONAL', variant: 'staff' };
    case 'admin':
    default:
      return { label: 'ADMIN', variant: 'admin' };
  }
}
