// KROWN POS — Notification Service
// Create, list, read, delete notifications

import { getSql, queryWithRetry } from '@/lib/neon-server';
import { TenantContext, setTenantContext } from '@/lib/tenant';
import { generateId } from '@/lib/id';
import { logAudit } from '@/lib/audit';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  organization_id?: string;
  recipient_id: string;
  type: string;
  title: string;
  message?: string;
  read: boolean;
  read_at?: string;
  link_url?: string;
  link_type?: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  metadata: any;
  created_at: string;
}

// ── Service Methods ────────────────────────────────────────────────────────

export async function createNotification(
  ctx: TenantContext | null,
  input: {
    organization_id?: string;
    recipient_id: string;
    type: string;
    title: string;
    message?: string;
    link_url?: string;
    link_type?: string;
    priority?: Notification['priority'];
    metadata?: any;
  }
): Promise<Notification> {
  const sql = getSql();
  if (ctx) await setTenantContext(sql, ctx.organizationId);

  const id = generateId();
  const orgId = input.organization_id || ctx?.organizationId || null;

  await sql`
    INSERT INTO notifications (id, organization_id, recipient_id, type, title, message, link_url, link_type, priority, metadata)
    VALUES (${id}, ${orgId}, ${input.recipient_id}, ${input.type}, ${input.title}, ${input.message || null}, ${input.link_url || null}, ${input.link_type || null}, ${input.priority || 'normal'}, ${JSON.stringify(input.metadata || {})})
  `;

  const rows = await sql`SELECT * FROM notifications WHERE id = ${id}`;
  return rows[0] as Notification;
}

export async function listNotifications(
  ctx: TenantContext,
  recipientId: string,
  filters?: { type?: string; unread_only?: boolean; limit?: number; offset?: number }
): Promise<Notification[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  let rows;
  if (filters?.unread_only) {
    rows = await sql`SELECT * FROM notifications WHERE recipient_id = ${recipientId} AND organization_id = ${ctx.organizationId} AND read = FALSE ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else if (filters?.type) {
    rows = await sql`SELECT * FROM notifications WHERE recipient_id = ${recipientId} AND organization_id = ${ctx.organizationId} AND type = ${filters.type} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else {
    rows = await sql`SELECT * FROM notifications WHERE recipient_id = ${recipientId} AND organization_id = ${ctx.organizationId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  }

  return rows as Notification[];
}

export async function markAsRead(ctx: TenantContext, notificationId: string): Promise<Notification> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM notifications WHERE id = ${notificationId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Notification not found');

  await sql`UPDATE notifications SET read = TRUE, read_at = NOW() WHERE id = ${notificationId} AND organization_id = ${ctx.organizationId}`;

  const rows = await sql`SELECT * FROM notifications WHERE id = ${notificationId}`;
  return rows[0] as Notification;
}

export async function markAllAsRead(ctx: TenantContext, recipientId: string): Promise<number> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const result = await sql`
    UPDATE notifications SET read = TRUE, read_at = NOW()
    WHERE recipient_id = ${recipientId} AND organization_id = ${ctx.organizationId} AND read = FALSE
  `;

  return (result as any).length || 0;
}

export async function getUnreadCount(ctx: TenantContext, recipientId: string): Promise<number> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`
    SELECT COUNT(*)::int as count FROM notifications
    WHERE recipient_id = ${recipientId} AND organization_id = ${ctx.organizationId} AND read = FALSE
  `;

  return (rows[0] as any).count;
}

export async function deleteNotification(ctx: TenantContext, notificationId: string): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM notifications WHERE id = ${notificationId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Notification not found');

  await sql`DELETE FROM notifications WHERE id = ${notificationId} AND organization_id = ${ctx.organizationId}`;

  await logAudit(ctx.userId, 'notification.delete', { notificationId }, ctx.organizationId, ctx.branchId);
}

export async function getNotificationStats(ctx: TenantContext): Promise<{
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  total: number;
  unread: number;
}> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const typeRows = await sql`SELECT type, COUNT(*)::int as count FROM notifications WHERE organization_id = ${ctx.organizationId} GROUP BY type`;
  const priorityRows = await sql`SELECT priority, COUNT(*)::int as count FROM notifications WHERE organization_id = ${ctx.organizationId} GROUP BY priority`;
  const totalRows = await sql`SELECT COUNT(*)::int as count FROM notifications WHERE organization_id = ${ctx.organizationId}`;
  const unreadRows = await sql`SELECT COUNT(*)::int as count FROM notifications WHERE organization_id = ${ctx.organizationId} AND read = FALSE`;

  const byType: Record<string, number> = {};
  for (const row of typeRows as any[]) byType[row.type] = row.count;

  const byPriority: Record<string, number> = {};
  for (const row of priorityRows as any[]) byPriority[row.priority] = row.count;

  return {
    byType,
    byPriority,
    total: (totalRows[0] as any).count,
    unread: (unreadRows[0] as any).count,
  };
}
