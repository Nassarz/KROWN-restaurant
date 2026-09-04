import { getSql } from '@/lib/neon-server';
import type { TenantContext } from '@/lib/tenant';
import { setTenantContext } from '@/lib/tenant';
import { generateId } from '@/lib/id';

export interface ZoneInput {
  name: string;
  icon?: string;
  description?: string;
  branchId?: string;
  branchName?: string;
  tables?: TableData[];
}

export interface TableData {
  number: string;
  seatsCount: number;
  shape?: 'square' | 'round' | 'rectangle';
  status?: 'available' | 'occupied' | 'reserved';
}

export interface TableUpdate {
  seatsCount?: number;
  shape?: 'square' | 'round' | 'rectangle';
  status?: 'available' | 'occupied' | 'reserved';
}

export interface Zone {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  branch_id: string | null;
  branch_name: string | null;
  tables: TableData[];
  organization_id: string;
  created_at: any;
  updated_at: any;
}

export async function listZones(ctx: TenantContext, branchId?: string): Promise<Zone[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  if (branchId) {
    const rows = await sql`
      SELECT * FROM zones
      WHERE branch_id = ${branchId} AND organization_id = ${ctx.organizationId}
      ORDER BY name ASC
    ` as Zone[];
    return rows;
  }

  const rows = await sql`
    SELECT * FROM zones
    WHERE organization_id = ${ctx.organizationId}
    ORDER BY name ASC
  ` as Zone[];
  return rows;
}

export async function getZone(ctx: TenantContext, zoneId: string): Promise<Zone | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`
    SELECT * FROM zones WHERE id = ${zoneId} AND organization_id = ${ctx.organizationId} LIMIT 1
  ` as Zone[];
  return rows.length > 0 ? rows[0] : null;
}

export async function createZone(ctx: TenantContext, input: ZoneInput): Promise<Zone> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const id = generateId();
  const tables = input.tables ?? [];

  const rows = await sql`
    INSERT INTO zones (id, name, icon, description, branch_id, branch_name, tables, organization_id, created_at, updated_at)
    VALUES (
      ${id},
      ${input.name},
      ${input.icon ?? null},
      ${input.description ?? null},
      ${input.branchId ?? ctx.branchId},
      ${input.branchName ?? null},
      ${JSON.stringify(tables)}::jsonb,
      ${ctx.organizationId},
      NOW(),
      NOW()
    )
    RETURNING *
  ` as Zone[];
  return rows[0];
}

export async function updateZone(
  ctx: TenantContext,
  zoneId: string,
  updates: Partial<Pick<ZoneInput, 'name' | 'icon' | 'description' | 'branchId' | 'branchName'>>
): Promise<Zone | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    values.push(updates.name);
  }
  if (updates.icon !== undefined) {
    setClauses.push(`icon = $${paramIdx++}`);
    values.push(updates.icon);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIdx++}`);
    values.push(updates.description);
  }
  if (updates.branchId !== undefined) {
    setClauses.push(`branch_id = $${paramIdx++}`);
    values.push(updates.branchId);
  }
  if (updates.branchName !== undefined) {
    setClauses.push(`branch_name = $${paramIdx++}`);
    values.push(updates.branchName);
  }

  if (setClauses.length === 0) {
    return getZone(ctx, zoneId);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(zoneId);

  const result = await sql(
    `UPDATE zones SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values
  ) as Zone[];

  return result.length > 0 ? result[0] : null;
}

export async function deleteZone(ctx: TenantContext, zoneId: string): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  await sql`DELETE FROM zones WHERE id = ${zoneId} AND organization_id = ${ctx.organizationId}`;
}

export async function addTable(
  ctx: TenantContext,
  zoneId: string,
  tableNumber: string,
  seatsCount: number,
  shape: 'square' | 'round' | 'rectangle' = 'square'
): Promise<Zone | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const zone = await getZone(ctx, zoneId);
  if (!zone) throw new Error('Zone not found');

  const tables = Array.isArray(zone.tables) ? [...zone.tables] : [];
  const exists = tables.find((t) => t.number === tableNumber);
  if (exists) throw new Error(`Table ${tableNumber} already exists in zone`);

  tables.push({ number: tableNumber, seatsCount, shape, status: 'available' });

  const rows = await sql`
    UPDATE zones
    SET tables = ${JSON.stringify(tables)}::jsonb, updated_at = NOW()
    WHERE id = ${zoneId}
    RETURNING *
  ` as Zone[];
  return rows.length > 0 ? rows[0] : null;
}

export async function updateTable(
  ctx: TenantContext,
  zoneId: string,
  tableNumber: string,
  updates: TableUpdate
): Promise<Zone | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const zone = await getZone(ctx, zoneId);
  if (!zone) throw new Error('Zone not found');

  const tables = Array.isArray(zone.tables) ? [...zone.tables] : [];
  const idx = tables.findIndex((t) => t.number === tableNumber);
  if (idx === -1) throw new Error(`Table ${tableNumber} not found in zone`);

  tables[idx] = { ...tables[idx], ...updates };

  const rows = await sql`
    UPDATE zones
    SET tables = ${JSON.stringify(tables)}::jsonb, updated_at = NOW()
    WHERE id = ${zoneId}
    RETURNING *
  ` as Zone[];
  return rows.length > 0 ? rows[0] : null;
}

export async function deleteTable(
  ctx: TenantContext,
  zoneId: string,
  tableNumber: string
): Promise<Zone | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const zone = await getZone(ctx, zoneId);
  if (!zone) throw new Error('Zone not found');

  const tables = Array.isArray(zone.tables) ? [...zone.tables] : [];
  const filtered = tables.filter((t) => t.number !== tableNumber);

  const rows = await sql`
    UPDATE zones
    SET tables = ${JSON.stringify(filtered)}::jsonb, updated_at = NOW()
    WHERE id = ${zoneId}
    RETURNING *
  ` as Zone[];
  return rows.length > 0 ? rows[0] : null;
}

export async function addSeat(
  ctx: TenantContext,
  zoneId: string,
  tableNumber: string
): Promise<Zone | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const zone = await getZone(ctx, zoneId);
  if (!zone) throw new Error('Zone not found');

  const tables = Array.isArray(zone.tables) ? [...zone.tables] : [];
  const idx = tables.findIndex((t) => t.number === tableNumber);
  if (idx === -1) throw new Error(`Table ${tableNumber} not found in zone`);

  tables[idx] = { ...tables[idx], seatsCount: tables[idx].seatsCount + 1 };

  const rows = await sql`
    UPDATE zones
    SET tables = ${JSON.stringify(tables)}::jsonb, updated_at = NOW()
    WHERE id = ${zoneId}
    RETURNING *
  ` as Zone[];
  return rows.length > 0 ? rows[0] : null;
}

export async function removeSeat(
  ctx: TenantContext,
  zoneId: string,
  tableNumber: string
): Promise<Zone | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const zone = await getZone(ctx, zoneId);
  if (!zone) throw new Error('Zone not found');

  const tables = Array.isArray(zone.tables) ? [...zone.tables] : [];
  const idx = tables.findIndex((t) => t.number === tableNumber);
  if (idx === -1) throw new Error(`Table ${tableNumber} not found in zone`);

  if (tables[idx].seatsCount <= 1) throw new Error('Table must have at least 1 seat');
  tables[idx] = { ...tables[idx], seatsCount: tables[idx].seatsCount - 1 };

  const rows = await sql`
    UPDATE zones
    SET tables = ${JSON.stringify(tables)}::jsonb, updated_at = NOW()
    WHERE id = ${zoneId}
    RETURNING *
  ` as Zone[];
  return rows.length > 0 ? rows[0] : null;
}

export async function updateOccupancy(
  ctx: TenantContext,
  tableNumber: string,
  status: 'available' | 'occupied' | 'reserved'
): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const zones = await listZones(ctx);

  for (const zone of zones) {
    const tables = Array.isArray(zone.tables) ? [...zone.tables] : [];
    const idx = tables.findIndex((t) => t.number === tableNumber);
    if (idx !== -1) {
      tables[idx] = { ...tables[idx], status };
      await sql`
        UPDATE zones
        SET tables = ${JSON.stringify(tables)}::jsonb, updated_at = NOW()
        WHERE id = ${zone.id}
      `;
      return;
    }
  }
}
