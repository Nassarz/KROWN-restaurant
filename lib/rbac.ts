// KROWN POS — Role-Based Access Control
// Defines permissions per role and provides helpers to check access

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, type TokenPayload } from './auth';

// ── Legacy Role Definitions (kept for backward compatibility) ────────────────

export type Role = 'super_admin' | 'branch_manager' | 'head_chef' | 'cashier' | 'kitchen_staff' | 'waiter';

export const ROLES: Role[] = ['super_admin', 'branch_manager', 'head_chef', 'cashier', 'kitchen_staff', 'waiter'];

// ── New Platform + Restaurant Role Definitions ──────────────────────────────

export type PlatformRole = 'super_admin' | 'platform_admin' | 'security_admin' | 'support_admin' | 'support_agent' | 'billing_admin' | 'read_only_analyst';
export type RestaurantRole = 'restaurant_admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen_staff';
export type UserRole = PlatformRole | RestaurantRole;

// Map legacy roles to new roles for backward compatibility
const ROLE_ALIASES: Record<string, UserRole> = {
  'super_admin': 'super_admin',
  'branch_manager': 'manager',
  'admin': 'restaurant_admin',
  'cashier': 'cashier',
  'waiter': 'waiter',
  'kitchen_staff': 'kitchen_staff',
  'head_chef': 'kitchen_staff',
  'Senior Waiter': 'waiter',
  'Branch Manager': 'manager',
  'Cashier': 'cashier',
  'Kitchen Staff': 'kitchen_staff',
  'Head Chef': 'kitchen_staff',
};

// ── Granular Permissions ─────────────────────────────────────────────────────

const PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],

  platform_admin: [
    'restaurants:view', 'restaurants:create', 'restaurants:update',
    'users:view', 'users:create', 'users:update', 'users:suspend',
    'staff:view', 'staff:create', 'staff:update', 'staff:suspend', 'staff:reset_pin', 'staff:reset_password',
    'devices:view', 'devices:register', 'devices:revoke',
    'security:view', 'security:investigate', 'security:alert_manage',
    'support:view', 'support:respond', 'support:resolve', 'support:assign',
    'billing:view', 'billing:manage',
    'system:view', 'system:health', 'system:config',
    'audit:view', 'analytics:view', 'feature_flags:manage',
    'notifications:manage',
  ],

  security_admin: [
    'security:view', 'security:investigate', 'security:alert_manage',
    'audit:view', 'users:view', 'devices:view', 'devices:revoke',
  ],

  support_admin: [
    'support:view', 'support:respond', 'support:resolve', 'support:assign',
    'users:view', 'restaurants:view',
  ],

  support_agent: [
    'support:view', 'support:respond', 'support:resolve',
  ],

  billing_admin: [
    'billing:view', 'billing:manage', 'restaurants:view',
  ],

  read_only_analyst: [
    'analytics:view', 'audit:view', 'reports:view',
  ],

  restaurant_admin: [
    'restaurant:view', 'restaurant:update',
    'staff:view', 'staff:create', 'staff:update', 'staff:suspend', 'staff:reset_pin', 'staff:delete', 'staff:set_pin', 'staff:update_status',
    'devices:view', 'devices:register', 'devices:revoke', 'devices:create', 'devices:update', 'devices:delete', 'devices:read',
    'support:view', 'support:create',
    'orders:view', 'orders:create', 'orders:update', 'orders:pay', 'orders:split_pay', 'orders:update_status',
    'products:view', 'products:create', 'products:update', 'products:delete', 'products:toggle', 'products:recipe',
    'ingredients:view', 'ingredients:create', 'ingredients:update', 'ingredients:delete', 'ingredients:update_quantity',
    'inventory:view', 'inventory:update', 'inventory:deduct', 'inventory:restore',
    'reports:view', 'audit:view', 'audit:create', 'audit:read',
    'branches:view', 'branches:create', 'branches:update', 'branches:update_status', 'branches:read', 'branches:delete',
    'categories:view', 'categories:create', 'categories:update', 'categories:delete',
    'expenses:view', 'expenses:create', 'expenses:read',
    'companies:view', 'companies:create', 'companies:update', 'companies:read_staff', 'companies:manage_staff', 'companies:settle', 'companies:toggle_status', 'companies:read',
    'zones:view', 'zones:create', 'zones:update', 'zones:manage_tables', 'zones:read', 'zones:delete',
    'upload:upload',
    'print_jobs:create', 'print_jobs:update',
    'sessions:read', 'sessions:revoke',
    'security:view',
  ],

  manager: [
    'restaurant:view',
    'staff:view', 'staff:create', 'staff:update', 'staff:set_pin', 'staff:update_status',
    'orders:view', 'orders:create', 'orders:update', 'orders:pay', 'orders:split_pay', 'orders:update_status',
    'products:view', 'products:create', 'products:update', 'products:delete', 'products:toggle', 'products:recipe',
    'ingredients:view', 'ingredients:create', 'ingredients:update', 'ingredients:delete', 'ingredients:update_quantity',
    'inventory:view', 'inventory:update', 'inventory:deduct', 'inventory:restore',
    'reports:view', 'support:view', 'support:create',
    'audit:view', 'audit:read',
    'branches:view', 'branches:create', 'branches:update', 'branches:read',
    'categories:view', 'categories:create', 'categories:update', 'categories:delete',
    'expenses:view', 'expenses:create', 'expenses:read',
    'companies:view', 'companies:create', 'companies:update', 'companies:read_staff', 'companies:manage_staff', 'companies:settle', 'companies:read',
    'zones:view', 'zones:create', 'zones:update', 'zones:manage_tables', 'zones:read',
    'upload:upload',
    'print_jobs:create', 'print_jobs:update',
    'devices:read', 'devices:create',
    'security:view',
  ],

  cashier: [
    'orders:view', 'orders:create', 'orders:update', 'orders:pay',
    'products:view', 'tables:view',
  ],

  waiter: [
    'orders:view', 'orders:create', 'orders:update',
    'products:view', 'tables:view',
  ],

  kitchen_staff: [
    'orders:view', 'orders:update',
    'products:view', 'inventory:view',
  ],
};

// ── Legacy Permission Definitions (kept for backward compatibility) ──────────

type Permission = string;

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    '*',
  ],
  branch_manager: [
    'staff:read', 'staff:create', 'staff:update', 'staff:delete', 'staff:update_role', 'staff:update_status', 'staff:set_pin',
    'products:read', 'products:create', 'products:update', 'products:delete', 'products:toggle', 'products:recipe',
    'ingredients:read', 'ingredients:create', 'ingredients:update', 'ingredients:delete', 'ingredients:update_quantity',
    'orders:read', 'orders:create', 'orders:update_status', 'orders:cancel',
    'companies:read', 'companies:create', 'companies:update', 'companies:toggle_status', 'companies:read_staff', 'companies:manage_staff', 'companies:settle',
    'branches:read', 'branches:create', 'branches:update', 'branches:delete', 'branches:update_status',
    'zones:read', 'zones:create', 'zones:update', 'zones:delete', 'zones:manage_tables',
    'expenses:read', 'expenses:create',
    'inventory:read', 'inventory:deduct', 'inventory:restore',
    'audit:read',
    'print_jobs:create', 'print_jobs:update',
    'upload:upload',
    'devices:read', 'devices:create', 'devices:update',
    'sessions:read', 'sessions:revoke',
  ],
  head_chef: [
    'products:read', 'products:update', 'products:toggle', 'products:recipe',
    'ingredients:read',
    'orders:read', 'orders:update_status',
    'zones:read',
  ],
  cashier: [
    'orders:read', 'orders:pay', 'orders:split_pay',
    'companies:read', 'companies:read_staff',
    'products:read',
    'print_jobs:create',
    'branches:read',
    'zones:read',
  ],
  kitchen_staff: [
    'orders:read', 'orders:update_status',
    'products:read',
  ],
  waiter: [
    'orders:create', 'orders:read',
    'products:read',
    'zones:read',
    'companies:read',
    'branches:read',
  ],
};

// ── Role Normalization ───────────────────────────────────────────────────────

export function normalizeRole(role: string): UserRole {
  return ROLE_ALIASES[role] ?? (role as UserRole);
}

// ── Granular Permission Checking ─────────────────────────────────────────────

export function hasPermission(role: string, permission: string): boolean {
  // Check legacy permissions first (backward compat)
  const legacyRolePerms = ROLE_PERMISSIONS[role as Role];
  if (legacyRolePerms) {
    if (legacyRolePerms.includes('*')) return true;
    if (legacyRolePerms.includes(permission)) return true;
  }

  // Check new granular permissions
  const normalized = normalizeRole(role);
  const perms = PERMISSIONS[normalized];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

export function hasAnyPermission(role: string, permissions: string[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function getRolePermissions(role: string): string[] {
  const normalized = normalizeRole(role);
  return PERMISSIONS[normalized] ?? [];
}

// ── Role Classification ──────────────────────────────────────────────────────

const PLATFORM_ROLES: PlatformRole[] = [
  'super_admin', 'platform_admin', 'security_admin',
  'support_admin', 'support_agent', 'billing_admin', 'read_only_analyst',
];

const RESTAURANT_ROLES: RestaurantRole[] = [
  'restaurant_admin', 'manager', 'cashier', 'waiter', 'kitchen_staff',
];

export function isPlatformRole(role: string): boolean {
  const normalized = normalizeRole(role);
  return PLATFORM_ROLES.includes(normalized as PlatformRole);
}

export function isRestaurantRole(role: string): boolean {
  const normalized = normalizeRole(role);
  return RESTAURANT_ROLES.includes(normalized as RestaurantRole);
}

// ── Resource Access Checks ───────────────────────────────────────────────────

export function canAccessResource(userRole: string, userOrgId: string, resourceOrgId: string): boolean {
  if (isPlatformRole(userRole)) return true;
  return userOrgId === resourceOrgId;
}

export function canManageRole(userRole: string, targetRole: string): boolean {
  const normalized = normalizeRole(userRole);
  if (normalized === 'super_admin') return true;
  if (normalized === 'platform_admin') return true;
  if (normalized === 'restaurant_admin') {
    const target = normalizeRole(targetRole);
    return RESTAURANT_ROLES.includes(target as RestaurantRole);
  }
  if (normalized === 'manager') {
    const target = normalizeRole(targetRole);
    return ['cashier', 'waiter', 'kitchen_staff'].includes(target);
  }
  return false;
}

export function canAccessDevice(userRole: string, userOrgId: string, deviceOrgId: string): boolean {
  if (isPlatformRole(userRole)) return true;
  return userOrgId === deviceOrgId;
}

export function canAccessSupport(userRole: string): boolean {
  return hasAnyPermission(userRole, ['support:view', 'support:respond', 'support:resolve', 'support:assign']);
}

export function canViewSecurity(userRole: string): boolean {
  return hasPermission(userRole, 'security:view');
}

export function canViewAudit(userRole: string): boolean {
  return hasPermission(userRole, 'audit:view');
}

// ── Legacy Permission Checking (original API) ────────────────────────────────

export function requirePermission(permission: string) {
  return (user: TokenPayload): boolean => {
    return hasPermission(user.role, permission);
  };
}

// ── Middleware Helpers ───────────────────────────────────────────────────────

export function requireRole(allowedRoles: Role[]) {
  return (request: NextRequest): NextResponse | null => {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!allowedRoles.includes(user.role as Role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return null; // allowed
  };
}

export function requirePermissionMiddleware(permission: string) {
  return (request: NextRequest): NextResponse | null => {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!hasPermission(user.role, permission)) {
      return NextResponse.json({ error: `Permission denied: ${permission}` }, { status: 403 });
    }
    return null;
  };
}

// ── Convenience: Check if user can access specific branch ──────────────────

export function canAccessBranch(user: TokenPayload, branchId: string): boolean {
  // Super Admin can access everything
  if (user.role === 'super_admin') return true;

  // Branch Manager can access all branches in their org
  if (user.role === 'branch_manager') return true;

  // Platform roles can access everything
  if (isPlatformRole(user.role)) return true;

  // Other roles can only access their assigned branch
  return user.branch === branchId;
}

// ── Legacy canManageStaff (original API with TokenPayload) ───────────────────

export function canManageStaff(user: TokenPayload, targetStaffRole: string): boolean {
  return canManageRole(user.role, targetStaffRole);
}

// ── Get allowed roles for promotion ─────────────────────────────────────────

export function getAllowedPromotionRoles(userRole: string): string[] {
  switch (userRole) {
    case 'super_admin':
      return ROLES;
    case 'branch_manager':
      return ['branch_manager', 'head_chef', 'cashier', 'kitchen_staff', 'waiter'];
    default:
      return [];
  }
}
