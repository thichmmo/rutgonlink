import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export const ADMIN_ROLES = ['owner', 'support', 'finance', 'ops', 'viewer'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export type AdminPermission =
  | 'overview.read'
  | 'users.read'
  | 'users.write'
  | 'users.roles'
  | 'links.read'
  | 'links.write'
  | 'domains.read'
  | 'domains.write'
  | 'billing.read'
  | 'billing.write'
  | 'logs.read'
  | 'system.read'
  | 'system.write'

const ALL_PERMISSIONS: AdminPermission[] = [
  'overview.read',
  'users.read',
  'users.write',
  'users.roles',
  'links.read',
  'links.write',
  'domains.read',
  'domains.write',
  'billing.read',
  'billing.write',
  'logs.read',
  'system.read',
  'system.write',
]

const READ_PERMISSIONS: AdminPermission[] = [
  'overview.read',
  'users.read',
  'links.read',
  'domains.read',
  'billing.read',
  'logs.read',
  'system.read',
]

const ROLE_PERMISSIONS: Record<AdminRole, Set<AdminPermission>> = {
  owner: new Set(ALL_PERMISSIONS),
  support: new Set([
    ...READ_PERMISSIONS,
    'users.write',
    'links.write',
    'domains.write',
  ]),
  finance: new Set(['overview.read', 'users.read', 'billing.read', 'billing.write', 'logs.read']),
  ops: new Set([
    'overview.read',
    'users.read',
    'links.read',
    'links.write',
    'domains.read',
    'domains.write',
    'logs.read',
    'system.read',
    'system.write',
  ]),
  viewer: new Set(READ_PERMISSIONS),
}

export type AdminContext = {
  id: string
  email: string
  role: AdminRole
  permissions: AdminPermission[]
}

function normalizeAdminRole(role: string | null): AdminRole | null {
  return ADMIN_ROLES.includes(role as AdminRole) ? (role as AdminRole) : null
}

export function hasAdminPermission(admin: AdminContext, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[admin.role].has(permission)
}

export async function getAdminContext(permission?: AdminPermission): Promise<AdminContext | null> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email) return null

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true, adminRole: true },
  })
  if (!user || user.status !== 'active') return null

  // ADMIN_EMAIL luôn là owner để tránh tự khóa admin trong lúc migrate role.
  const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const role = email === envAdminEmail ? 'owner' : normalizeAdminRole(user.adminRole)
  if (!role) return null

  const admin: AdminContext = {
    id: user.id,
    email: user.email,
    role,
    permissions: [...ROLE_PERMISSIONS[role]],
  }

  if (permission && !hasAdminPermission(admin, permission)) return null
  return admin
}

export async function requireAdmin(permission: AdminPermission) {
  const admin = await getAdminContext(permission)
  if (!admin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true as const, admin }
}
