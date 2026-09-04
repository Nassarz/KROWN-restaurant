import { neon, NeonQueryFunction } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || '';

let _sql: NeonQueryFunction<false, false> | null = null;

function isRetryableError(e: any): boolean {
  const msg = e?.message || '';
  return msg.includes('fetch failed') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EPIPE') ||
    msg.includes('socket hang up') ||
    msg.includes('Connect Timeout') ||
    msg.includes('connect');
}

/**
 * Execute a function with automatic retry for transient Neon connection errors.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      if (!isRetryableError(e) || attempt === retries) throw e;
      await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw new Error('unreachable');
}

export function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set. Please configure your Neon database connection.');
  }
  const raw = neon(DATABASE_URL);

  // Wrap the raw sql function with retry logic
  const wrapped = ((strings: any, ...values: any[]) => {
    return withRetry(() => raw(strings, ...values));
  }) as NeonQueryFunction<false, false>;

  // Preserve the execute method if present
  if ((raw as any).execute) {
    (wrapped as any).execute = (query: any) => withRetry(() => (raw as any).execute(query));
  }

  _sql = wrapped;
  return _sql;
}

/**
 * Execute a query with retry logic for intermittent connection failures.
 * Neon HTTP connections can fail transiently — retrying once usually helps.
 */
export async function queryWithRetry<T = any>(
  fn: () => Promise<T>,
  retries: number = 2,
  delayMs: number = 300
): Promise<T> {
  return withRetry(fn, retries, delayMs);
}

/**
 * Execute a tagged template query and return typed results.
 * Use this instead of sql<Type>`...` to avoid generic constraint issues.
 */
export async function sqlQuery<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> {
  const sql = getSql();
  const result = await sql(strings, ...values);
  return result as T[];
}

/**
 * Execute a raw SQL query with parameters and return typed results.
 */
export async function sqlRaw<T = any>(
  query: string,
  params?: any[]
): Promise<T[]> {
  const sql = getSql();
  const result = await sql(query, params || []);
  return result as T[];
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const sql = getSql();
  const result = await sql(text, params);
  return result as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function insert(table: string, data: Record<string, any>): Promise<any> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  const sql = getSql();
  const result = await sql(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values
  );
  return result[0];
}

export async function upsert(table: string, data: Record<string, any>, conflictKey: string = 'id'): Promise<any> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  const updateClauses = keys.filter(k => k !== conflictKey).map((k, i) => `${k} = EXCLUDED.${k}`);
  const sql = getSql();
  const result = await sql(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})
     ON CONFLICT (${conflictKey}) DO UPDATE SET ${updateClauses.join(', ')}
     RETURNING *`,
    values
  );
  return result[0];
}

export async function update(table: string, data: Record<string, any>, whereCol: string, whereVal: any): Promise<any> {
  const keys = Object.keys(data).filter(k => k !== whereCol);
  const values = keys.map(k => data[k]);
  values.push(whereVal);
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
  const sql = getSql();
  const result = await sql(
    `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereCol} = $${keys.length + 1} RETURNING *`,
    values
  );
  return result[0];
}

export async function remove(table: string, whereCol: string, whereVal: any): Promise<void> {
  const sql = getSql();
  await sql(`DELETE FROM ${table} WHERE ${whereCol} = $1`, [whereVal]);
}

export async function removeWhere(table: string, conditions: Record<string, any>): Promise<void> {
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);
  const whereClauses = keys.map((k, i) => `${k} = $${i + 1}`);
  const sql = getSql();
  await sql(`DELETE FROM ${table} WHERE ${whereClauses.join(' AND ')}`, values);
}

export async function select(table: string, options?: {
  where?: Record<string, any>;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
  limit?: number;
  columns?: string[];
}): Promise<any[]> {
  const sql = getSql();
  const cols = options?.columns ? options.columns.join(', ') : '*';
  let queryStr = `SELECT ${cols} FROM ${table}`;
  const params: any[] = [];

  if (options?.where) {
    const keys = Object.keys(options.where);
    const whereClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    params.push(...Object.values(options.where));
    queryStr += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  if (options?.orderBy) {
    queryStr += ` ORDER BY ${options.orderBy} ${options.orderDir || 'DESC'}`;
  }

  if (options?.limit) {
    queryStr += ` LIMIT ${options.limit}`;
  }

  return await sql(queryStr, params);
}

export async function rpc(fnName: string, params: Record<string, any>): Promise<any> {
  const sql = getSql();
  const keys = Object.keys(params);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  const result = await sql(
    `SELECT * FROM ${fnName}(${placeholders.join(', ')})`,
    Object.values(params)
  );
  return result[0];
}
