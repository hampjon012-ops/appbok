import { getSidebarRoleBadge } from '../lib/adminRoleBadge.js';

export default function SidebarRoleBadge({ role }) {
  const { label, variant } = getSidebarRoleBadge(role);
  return <span className={`sidebar-role-badge sidebar-role-badge--${variant}`}>{label}</span>;
}
