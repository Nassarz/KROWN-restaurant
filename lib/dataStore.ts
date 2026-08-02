import {
  MOCK_PRODUCTS, MOCK_INGREDIENTS, MOCK_ORDERS, MOCK_BRANCHES,
  MOCK_STAFF, MOCK_AUDIT_LOGS, MOCK_COMPANIES, MOCK_COMPANY_STAFF, MOCK_ZONES, MOCK_EXPENSES,
  Product, Ingredient, Order, Branch, StaffMember, AuditLog,
  CompanyProfile, CompanyStaff, PlaceZone, Expense
} from './mockData';
import { supabase } from './supabase';
import { queueOfflineOp, initAutoSync } from './sync';

type Listener = () => void;

// ── Offline-aware write helper ────────────────────────────────────────────────
// Attempts Supabase write; queues to IndexedDB when offline so it replays later
async function safeWrite(
  table: string,
  method: 'upsert' | 'update' | 'insert' | 'delete',
  payload: any,
  conflictKey = 'id'
): Promise<void> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) {
    await queueOfflineOp({ table, method, payload, conflictKey });
    return;
  }
  try {
    let error: any = null;
    if (method === 'upsert') {
      ({ error } = await supabase.from(table).upsert(payload, { onConflict: conflictKey }));
    } else if (method === 'insert') {
      ({ error } = await supabase.from(table).insert(payload));
    } else if (method === 'update') {
      const { id, ...updates } = payload;
      ({ error } = await supabase.from(table).update(updates).eq('id', id));
    } else if (method === 'delete') {
      ({ error } = await supabase.from(table).delete().eq('id', payload.id));
    }
    if (error) {
      console.warn(`[DataStore] Supabase ${method} error on ${table}:`, error.message);
      // Queue for retry
      await queueOfflineOp({ table, method, payload, conflictKey });
    }
  } catch (e) {
    console.warn(`[DataStore] Network error on ${table}, queuing offline:`, e);
    await queueOfflineOp({ table, method, payload, conflictKey });
  }
}


// ─── DB Mapping Helpers ──────────────────────────────────────────────────────
function toDbOrder(o: Order): any {
  let createdIso: string;
  if (typeof o.createdAt === 'number') {
    createdIso = new Date(o.createdAt).toISOString();
  } else if (typeof o.createdAt === 'string') {
    createdIso = o.createdAt;
  } else {
    createdIso = new Date().toISOString();
  }

  return {
    id: o.id,
    table_number: o.table,
    place: o.place,
    seat: o.seat,
    type: o.type,
    status: o.status,
    payment_status: o.paymentStatus ?? 'unpaid',
    paid_amount: o.paidAmount ?? 0,
    split_payments: o.splitPayments ?? [],
    items: o.items,
    subtotal: o.subtotal,
    tax: o.tax,
    total: o.total,
    payment_method: o.paymentMethod ?? null,
    is_corporate_credit: o.isCorporateCredit ?? false,
    company_id: o.companyId ?? null,
    company_name: o.companyName ?? null,
    company_staff_id: o.companyStaffId ?? null,
    company_staff_name: o.companyStaffName ?? null,
    work_id: o.workId ?? null,
    prep_estimated_minutes: o.prepEstimatedMinutes ?? 15,
    prep_started_at: o.prepStartedAt ? new Date(o.prepStartedAt).toISOString() : null,
    restaurant_id: o.restaurantId ?? null,
    branch_name: o.branchName ?? null,
    user_id: o.userId ?? null,
    created_at: createdIso,
  };
}

function fromDbOrder(r: any): Order {
  let parsedCreatedAt = Date.now();
  if (r.created_at) {
    parsedCreatedAt = typeof r.created_at === 'string' ? new Date(r.created_at).getTime() : Number(r.created_at);
  }
  return {
    id: r.id,
    table: r.table_number,
    place: r.place,
    seat: r.seat,
    type: r.type,
    status: r.status,
    paymentStatus: r.payment_status || 'unpaid',
    paidAmount: r.paid_amount || 0,
    splitPayments: r.split_payments || [],
    items: r.items ?? [],
    subtotal: r.subtotal,
    tax: r.tax,
    total: r.total,
    paymentMethod: r.payment_method,
    isCorporateCredit: r.is_corporate_credit,
    companyId: r.company_id,
    companyName: r.company_name,
    companyStaffId: r.company_staff_id,
    companyStaffName: r.company_staff_name,
    workId: r.work_id,
    prepEstimatedMinutes: r.prep_estimated_minutes,
    prepStartedAt: r.prep_started_at ? (typeof r.prep_started_at === 'string' ? new Date(r.prep_started_at).getTime() : Number(r.prep_started_at)) : undefined,
    restaurantId: r.restaurant_id,
    branchName: r.branch_name,
    userId: r.user_id,
    createdAt: parsedCreatedAt,
  };
}

function toDbProduct(p: Product): any {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    image: p.image,
    available: p.available,
    requires_kitchen: p.requiresKitchen ?? true,
    branch_id: p.branchId ?? null,
    branch_name: p.branchName ?? null,
  };
}

function fromDbProduct(r: any): Product {
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    category: r.category,
    image: r.image,
    available: r.available,
    requiresKitchen: r.requires_kitchen ?? true,
    branchId: r.branch_id,
    branchName: r.branch_name,
  };
}

function toDbIngredient(i: Ingredient): any {
  return {
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    min_threshold: i.minThreshold,
    category: i.category,
    cost_per_unit_ugx: i.costPerUnitUGX,
    supplier: i.supplier,
    branch_id: i.branchId ?? null,
    branch_name: i.branchName ?? null,
  };
}

function fromDbIngredient(r: any): Ingredient {
  return {
    id: r.id,
    name: r.name,
    quantity: r.quantity,
    unit: r.unit,
    minThreshold: r.min_threshold,
    category: r.category,
    costPerUnitUGX: r.cost_per_unit_ugx,
    supplier: r.supplier,
    branchId: r.branch_id,
    branchName: r.branch_name,
  };
}

function toDbCompany(c: CompanyProfile): any {
  let createdIso: string;
  if (typeof c.createdAt === 'number') {
    createdIso = new Date(c.createdAt).toISOString();
  } else if (typeof c.createdAt === 'string') {
    createdIso = c.createdAt;
  } else {
    createdIso = new Date().toISOString();
  }
  return {
    id: c.id,
    name: c.name,
    tax_id: c.taxId,
    credit_limit_ugx: c.creditLimitUGX,
    current_balance_ugx: c.currentBalanceUGX,
    contact_person: c.contactPerson,
    phone: c.phone,
    status: c.status,
    created_at: createdIso,
  };
}

function fromDbCompany(r: any): CompanyProfile {
  let parsedCreatedAt = Date.now();
  if (r.created_at) {
    parsedCreatedAt = typeof r.created_at === 'string' ? new Date(r.created_at).getTime() : Number(r.created_at);
  }
  return {
    id: r.id,
    name: r.name,
    taxId: r.tax_id,
    creditLimitUGX: r.credit_limit_ugx,
    currentBalanceUGX: r.current_balance_ugx,
    contactPerson: r.contact_person,
    phone: r.phone,
    status: r.status,
    createdAt: parsedCreatedAt,
  };
}

function toDbCompanyStaff(s: CompanyStaff): any {
  return {
    id: s.id,
    company_id: s.companyId,
    name: s.name,
    work_id: s.workId,
    email: s.email,
    department: s.department,
    credit_limit_ugx: s.creditLimitUGX,
    status: s.status,
  };
}

function fromDbCompanyStaff(r: any): CompanyStaff {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    workId: r.work_id,
    email: r.email,
    department: r.department,
    creditLimitUGX: r.credit_limit_ugx,
    status: r.status,
  };
}

function toDbStaff(s: StaffMember): any {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    branch: s.branch,
    status: s.status,
    avatar: s.avatar,
  };
}

function fromDbStaff(r: any): StaffMember {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    password: r.password,
    pin: r.pin,
    phone: r.phone,
    idType: r.id_type,
    idNumber: r.id_number,
    role: r.role,
    branch: r.branch,
    assignedBranchId: r.assigned_branch_id,
    status: r.status,
    avatar: r.avatar,
  };
}

function toDbZone(z: PlaceZone): any {
  return {
    id: z.id,
    name: z.name,
    icon: z.icon,
    description: z.description,
    branch_id: z.branchId ?? null,
    branch_name: z.branchName ?? null,
    tables: z.tables ?? [],
  };
}

function fromDbZone(r: any): PlaceZone {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    description: r.description,
    branchId: r.branch_id,
    branchName: r.branch_name,
    tables: r.tables ?? [],
  };
}

function toDbExpense(e: Expense): any {
  let createdIso: string;
  if (typeof e.createdAt === 'number') {
    createdIso = new Date(e.createdAt).toISOString();
  } else if (typeof e.createdAt === 'string') {
    createdIso = e.createdAt;
  } else {
    createdIso = new Date().toISOString();
  }
  return {
    id: e.id,
    branch_id: e.branchId ?? null,
    branch_name: e.branchName ?? null,
    title: e.title,
    category: e.category,
    amount_ugx: e.amountUGX,
    vat_amount_ugx: e.vatAmountUGX,
    receipt_url: e.receiptUrl ?? null,
    notes: e.notes ?? null,
    created_at: createdIso,
  };
}

function fromDbExpense(r: any): Expense {
  return {
    id: r.id,
    branchId: r.branch_id,
    branchName: r.branch_name,
    title: r.title,
    category: r.category,
    amountUGX: r.amount_ugx,
    vatAmountUGX: r.vat_amount_ugx,
    receiptUrl: r.receipt_url,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

function toDbBranch(b: Branch): any {
  return {
    id: b.id,
    name: b.name,
    location: b.location,
    city: b.city || 'Kampala',
    manager: b.manager || 'Branch Manager',
    phone: b.phone || '+256 700 000 000',
    email: b.email || 'info@krownpos.com',
    tax_id: b.taxId || 'URA-100293481',
    address: b.address || b.location,
    receipt_header_note: b.receiptHeaderNote || `Welcome to ${b.name}`,
    receipt_footer_note: b.receiptFooterNote || 'Thank you for dining with us! Powered by Krown Enterprise POS',
    tables_count: b.tablesCount || 20,
    daily_revenue_ugx: b.dailyRevenueUGX || 0,
    orders_today: b.ordersToday || 0,
    status: b.status || 'online'
  };
}

function fromDbBranch(r: any): Branch {
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    city: r.city || 'Kampala',
    manager: r.manager || r.manager_name || 'Branch Manager',
    phone: r.phone || '+256 700 000 000',
    email: r.email || 'info@krownpos.com',
    taxId: r.tax_id || 'URA-100293481',
    address: r.address || r.location,
    receiptHeaderNote: r.receipt_header_note || `Welcome to ${r.name}`,
    receiptFooterNote: r.receipt_footer_note || 'Thank you for dining with us! Powered by Krown Enterprise POS',
    tablesCount: Number(r.tables_count) || 20,
    dailyRevenueUGX: Number(r.daily_revenue_ugx) || 0,
    ordersToday: Number(r.orders_today) || 0,
    status: r.status || 'online'
  };
}

// ─────────────────────────────────────────────────────────────────────────────

class DataStoreEngine {
  private products: Product[] = [];
  private ingredients: Ingredient[] = [];
  private orders: Order[] = [];
  private branches: Branch[] = [];
  private staff: StaffMember[] = [];
  private auditLogs: AuditLog[] = [];
  private companies: CompanyProfile[] = [];
  private companyStaff: CompanyStaff[] = [];
  private zones: PlaceZone[] = [];
  private expenses: Expense[] = [];
  private listeners: Set<Listener> = new Set();
  private seeded = false;
  private onlineStaffPresence: Array<{ staffId: string; email?: string; branch?: string; assignedBranchId?: string }> = [];

  constructor() {
    this.loadLocal();
    if (typeof window !== 'undefined') {
      this.initSupabase();
      initAutoSync();
    }
  }

  public setOnlineStaffPresence(presence: Array<{ staffId: string; email?: string; branch?: string; assignedBranchId?: string }>) {
    this.onlineStaffPresence = presence;
    this.notify();
  }

  public isBranchOnline(branchId: string, branchName: string): boolean {
    if (!this.onlineStaffPresence || this.onlineStaffPresence.length === 0) {
      return false;
    }
    return this.onlineStaffPresence.some(p =>
      (p.assignedBranchId && p.assignedBranchId === branchId) ||
      (p.branch && (p.branch === branchName || branchName.toLowerCase().includes(p.branch.toLowerCase()) || p.branch.toLowerCase().includes(branchName.toLowerCase())))
    );
  }


  private loadLocal() {
    if (typeof window !== 'undefined') {
      try {
        const sStaff = localStorage.getItem('krown_staff');
        if (sStaff) this.staff = JSON.parse(sStaff);
        const sOrders = localStorage.getItem('krown_orders');
        if (sOrders) this.orders = JSON.parse(sOrders);
        const sProds = localStorage.getItem('krown_products');
        if (sProds) this.products = JSON.parse(sProds);
      } catch (e) {
        console.warn('[DataStore] loadLocal parse warning:', e);
      }
    }
  }

  private async initSupabase() {
    await this.fetchAll();
    this.subscribeRealtime();
  }

  private async fetchAll() {
    try {
      const [
        { data: products },
        { data: ingredients },
        { data: orders },
        { data: branches },
        { data: staff },
        { data: companies },
        { data: companyStaff },
        { data: zones },
        { data: auditLogs },
        { data: expenses },
      ] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('ingredients').select('*'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('branches').select('*'),
        supabase.from('staff').select('*'),
        supabase.from('companies').select('*'),
        supabase.from('company_staff').select('*'),
        supabase.from('zones').select('*'),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
      ]);

      if (products)     this.products     = products.map(fromDbProduct);
      if (ingredients)  this.ingredients  = ingredients.map(fromDbIngredient);
      if (orders)       this.orders       = orders.map(fromDbOrder);
      if (branches)     this.branches     = branches.map(fromDbBranch);
      if (staff && staff.length > 0) {
        const dbStaffList = staff.map(fromDbStaff);
        const map = new Map<string, StaffMember>();
        this.staff.forEach(s => map.set(s.id, s));
        dbStaffList.forEach(s => map.set(s.id, s));
        this.staff = Array.from(map.values());
      }
      if (companies)    this.companies    = companies.map(fromDbCompany);
      if (companyStaff) this.companyStaff = companyStaff.map(fromDbCompanyStaff);
      if (zones)        this.zones        = zones.map(fromDbZone);
      if (auditLogs)    this.auditLogs    = auditLogs as AuditLog[];
      if (expenses)     this.expenses     = expenses.map(fromDbExpense);

      this.persistLocal();
    } catch (e) {
      console.warn('[Supabase] fetchAll error:', e);
    }
  }

  private subscribeRealtime() {
    supabase.channel('krown-pos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, (p) => this.handleRealtime('branches', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p) => this.handleRealtime('orders', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (p) => this.handleRealtime('products', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, (p) => this.handleRealtime('ingredients', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, (p) => this.handleRealtime('zones', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, (p) => this.handleRealtime('companies', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_staff' }, (p) => this.handleRealtime('company_staff', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, (p) => this.handleRealtime('staff', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (p) => this.handleRealtime('expenses', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, (p) => this.handleRealtime('audit_logs', p))
      .subscribe();
  }

  private handleRealtime(table: string, payload: any) {
    const { eventType, new: newRec, old: oldRec } = payload;
    const apply = <T extends { id: string }>(arr: T[], parse: (r: any) => T): T[] => {
      if (eventType === 'INSERT') return [parse(newRec), ...arr.filter(x => x.id !== newRec.id)];
      if (eventType === 'UPDATE') return arr.map(x => x.id === newRec.id ? parse(newRec) : x);
      if (eventType === 'DELETE') return arr.filter(x => x.id !== oldRec?.id);
      return arr;
    };

    switch (table) {
      case 'branches':
        this.branches = apply(this.branches, fromDbBranch);
        break;
      case 'orders':
        this.orders = apply(this.orders, fromDbOrder).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      case 'products':
        this.products = apply(this.products, fromDbProduct);
        break;
      case 'ingredients':
        this.ingredients = apply(this.ingredients, fromDbIngredient);
        break;
      case 'zones':
        this.zones = apply(this.zones, fromDbZone);
        break;
      case 'companies':
        this.companies = apply(this.companies, fromDbCompany);
        break;
      case 'company_staff':
        this.companyStaff = apply(this.companyStaff, fromDbCompanyStaff);
        break;
      case 'staff':
        this.staff = apply(this.staff, fromDbStaff);
        break;
      case 'expenses':
        this.expenses = apply(this.expenses, fromDbExpense);
        break;
      case 'audit_logs':
        this.auditLogs = apply(this.auditLogs, r => (r as AuditLog));
        break;
    }
    this.persistLocal();
  }

  private async seedAll() {
    console.log('[Supabase] Seeding database with initial data...');
    try {
      await Promise.all([
        supabase.from('products').upsert(MOCK_PRODUCTS.map(toDbProduct), { onConflict: 'id' }),
        supabase.from('ingredients').upsert(MOCK_INGREDIENTS.map(toDbIngredient), { onConflict: 'id' }),
        supabase.from('branches').upsert(MOCK_BRANCHES.map(toDbBranch), { onConflict: 'id' }),
        supabase.from('staff').upsert(MOCK_STAFF.map(toDbStaff), { onConflict: 'id' }),
        supabase.from('companies').upsert(MOCK_COMPANIES.map(toDbCompany), { onConflict: 'id' }),
        supabase.from('company_staff').upsert(MOCK_COMPANY_STAFF.map(toDbCompanyStaff), { onConflict: 'id' }),
        supabase.from('zones').upsert(MOCK_ZONES.map(toDbZone), { onConflict: 'id' }),
        supabase.from('orders').upsert(MOCK_ORDERS.map(toDbOrder), { onConflict: 'id' }),
        supabase.from('expenses').upsert(MOCK_EXPENSES.map(toDbExpense), { onConflict: 'id' }),
      ]);
      await this.fetchAll();
    } catch (e) {
      console.warn('[Supabase] Seed error:', e);
    }
  }

  private persistLocal() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('krown_products',    JSON.stringify(this.products));
      localStorage.setItem('krown_ingredients', JSON.stringify(this.ingredients));
      localStorage.setItem('krown_orders',      JSON.stringify(this.orders));
      localStorage.setItem('krown_branches',    JSON.stringify(this.branches));
      localStorage.setItem('krown_staff',       JSON.stringify(this.staff));
      localStorage.setItem('krown_audit',       JSON.stringify(this.auditLogs));
      localStorage.setItem('krown_companies',   JSON.stringify(this.companies));
      localStorage.setItem('krown_cstaff',      JSON.stringify(this.companyStaff));
      localStorage.setItem('krown_zones',       JSON.stringify(this.zones));
      localStorage.setItem('krown_expenses',    JSON.stringify(this.expenses));
    } catch { /* ignore */ }
    this.notify();
  }

  private save() { this.persistLocal(); }

  public subscribe(l: Listener) {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }
  private notify() { this.listeners.forEach(cb => cb()); }

  // ── Scoped Getters (with optional branch & date filters) ───────────────────
  public getProducts(branchId?: string): Product[] {
    if (branchId && branchId !== 'all') {
      return this.products.filter(p => !p.branchId || p.branchId === branchId);
    }
    return this.products;
  }

  public getIngredients(branchId?: string): Ingredient[] {
    if (branchId && branchId !== 'all') {
      return this.ingredients.filter(i => !i.branchId || i.branchId === branchId);
    }
    return this.ingredients;
  }

  public getOrders(branchId?: string, startDate?: number, endDate?: number): Order[] {
    let res = this.orders;
    if (branchId && branchId !== 'all') {
      const b = this.branches.find(x => x.id === branchId);
      res = res.filter(o => o.restaurantId === branchId || (b && o.branchName === b.name));
    }
    if (startDate) {
      res = res.filter(o => o.createdAt >= startDate);
    }
    if (endDate) {
      res = res.filter(o => o.createdAt <= endDate);
    }
    return res;
  }

  public getBranches(): Branch[] { return this.branches; }

  public getStaff(branchId?: string): StaffMember[] {
    if (branchId && branchId !== 'all') {
      const b = this.branches.find(x => x.id === branchId);
      return this.staff.filter(s => s.assignedBranchId === branchId || s.branch === branchId || (b && s.branch === b.name));
    }
    return this.staff;
  }

  /** Push fresh staff data from Supabase into local store and notify subscribers */
  public syncStaffFromDB(freshStaff: StaffMember[]) {
    const map = new Map<string, StaffMember>();
    this.staff.forEach(s => map.set(s.id, s));
    freshStaff.forEach(s => map.set(s.id, s));
    this.staff = Array.from(map.values());
    this.persistLocal();
    this.notify();
  }

  public addStaff(s: StaffMember) {
    this.staff = [s, ...this.staff.filter(x => x.id !== s.id)];
    this.persistLocal();
    this.notify();
    safeWrite('staff', 'upsert', toDbStaff(s), 'id');
  }


  public getAuditLogs(branchId?: string): AuditLog[] {
    return this.auditLogs;
  }

  public getCompanies(): CompanyProfile[] { return this.companies; }

  public getCompanyStaff(companyId?: string): CompanyStaff[] {
    if (companyId) return this.companyStaff.filter(s => s.companyId === companyId);
    return this.companyStaff;
  }

  public getZones(branchId?: string): PlaceZone[] {
    if (branchId && branchId !== 'all') {
      return this.zones.filter(z => !z.branchId || z.branchId === branchId);
    }
    return this.zones;
  }

  public getExpenses(branchId?: string, startDate?: number, endDate?: number): Expense[] {
    let res = this.expenses;
    if (branchId && branchId !== 'all') {
      res = res.filter(e => e.branchId === branchId);
    }
    if (startDate) {
      res = res.filter(e => e.createdAt >= startDate);
    }
    if (endDate) {
      res = res.filter(e => e.createdAt <= endDate);
    }
    return res;
  }

  // ── Prep time estimator ───────────────────────────────────────────────────
  public calculatePrepETA(items: any[]): number {
    if (!items?.length) return 15;
    let max = 10;
    items.forEach(item => {
      const cat = item.category || '';
      const t = cat === 'local' ? 25 : cat === 'pizza' ? 20 : cat === 'mains' ? 22 :
                cat === 'burger' ? 15 : cat === 'sushi' ? 15 : cat === 'appetizers' ? 10 :
                cat === 'drinks' ? 5 : cat === 'dessert' ? 10 : 12;
      if (t > max) max = t;
    });
    return max;
  }

  // ── ORDERS ────────────────────────────────────────────────────────────────
  public placeOrder(orderData: {
    table: string; place?: string; seat?: string;
    type: 'Dine In' | 'Takeaway' | 'Delivery';
    items: any[]; subtotal: number; tax: number; total: number;
    paymentMethod: 'Cash' | 'MTN Mobile Money' | 'Airtel Money' | 'Credit Card' | 'Corporate Credit';
    isCorporateCredit?: boolean; companyId?: string; companyName?: string;
    companyStaffId?: string; companyStaffName?: string; workId?: string;
    restaurantId?: string; userId?: string;
  }): Order {
    const prepETA = this.calculatePrepETA(orderData.items);
    const newOrder: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString(36)}`,
      table: orderData.table,
      place: orderData.place || 'Main Dining Hall',
      seat: orderData.seat || 'General Table',
      type: orderData.type,
      status: 'pending',
      items: orderData.items,
      subtotal: orderData.subtotal,
      tax: orderData.tax,
      total: orderData.total,
      paymentMethod: orderData.paymentMethod,
      isCorporateCredit: orderData.paymentMethod === 'Corporate Credit' || orderData.isCorporateCredit,
      companyId: orderData.companyId,
      companyName: orderData.companyName,
      companyStaffId: orderData.companyStaffId,
      companyStaffName: orderData.companyStaffName,
      workId: orderData.workId,
      prepEstimatedMinutes: prepETA,
      prepStartedAt: Date.now(),
      restaurantId: orderData.restaurantId || 'rest-1',
      branchName: 'Krown Kampala Central',
      userId: orderData.userId || 'demo-user',
      createdAt: Date.now()
    };

    // Corporate Credit: update company balance
    if (newOrder.isCorporateCredit && newOrder.companyId) {
      this.companies = this.companies.map(c => {
        if (c.id === newOrder.companyId) {
          const updated = { ...c, currentBalanceUGX: c.currentBalanceUGX + newOrder.total };
          supabase.from('companies').update({ current_balance_ugx: updated.currentBalanceUGX })
            .eq('id', c.id).then(({ error }) => {
              if (error) console.warn('[Supabase] company balance update error:', error.message);
            });
          return updated;
        }
        return c;
      });
    }

    this.orders = [newOrder, ...this.orders];
    this.logAudit('POS Operator', 'PLACE_ORDER', {
      orderId: newOrder.id, total: newOrder.total,
      place: newOrder.place, table: newOrder.table,
      paymentMethod: newOrder.paymentMethod
    });
    this.save();
    safeWrite('orders', 'upsert', toDbOrder(newOrder));
    return newOrder;
  }

  public updateOrderStatus(orderId: string, newStatus: Order['status']) {
    this.orders = this.orders.map(o => {
      if (o.id === orderId) {
        const updated = { ...o, status: newStatus };
        safeWrite('orders', 'update', { id: orderId, status: newStatus, updated_at: Date.now() });
        return updated;
      }
      return o;
    });
    this.logAudit('Staff', 'UPDATE_ORDER_STATUS', { orderId, newStatus });
    this.save();
  }

  public payOrder(orderId: string, paymentData: {
    paymentMethod: Order['paymentMethod'];
    isCorporateCredit?: boolean;
    companyId?: string;
    companyName?: string;
    companyStaffId?: string;
    companyStaffName?: string;
    workId?: string;
  }): Order | null {
    let targetOrder: Order | null = null;
    this.orders = this.orders.map(o => {
      if (o.id === orderId) {
        const updated: Order = {
          ...o,
          paymentMethod: paymentData.paymentMethod,
          isCorporateCredit: paymentData.isCorporateCredit ?? (paymentData.paymentMethod === 'Corporate Credit'),
          companyId: paymentData.companyId ?? o.companyId,
          companyName: paymentData.companyName ?? o.companyName,
          companyStaffId: paymentData.companyStaffId ?? o.companyStaffId,
          companyStaffName: paymentData.companyStaffName ?? o.companyStaffName,
          workId: paymentData.workId ?? o.workId,
          paymentStatus: 'paid',
          paidAmount: o.total,
          status: o.status === 'pending' ? 'preparing' : o.status
        };
        targetOrder = updated;

        if (updated.isCorporateCredit && updated.companyId) {
          this.companies = this.companies.map(c => {
            if (c.id === updated.companyId) {
              const uComp = { ...c, currentBalanceUGX: c.currentBalanceUGX + updated.total };
              supabase.from('companies').update({ current_balance_ugx: uComp.currentBalanceUGX })
                .eq('id', c.id).then(({ error }) => {
                  if (error) console.warn('[Supabase] company balance update error:', error.message);
                });
              return uComp;
            }
            return c;
          });
        }

        const bId = o.restaurantId || 'rest-1';
        this.branches = this.branches.map(b => {
          if (b.id === bId || b.name === o.branchName) {
            return {
              ...b,
              dailyRevenueUGX: (b.dailyRevenueUGX || 0) + o.total,
              ordersToday: (b.ordersToday || 0) + 1
            };
          }
          return b;
        });

        supabase.from('orders').update(toDbOrder(updated))
          .eq('id', orderId).then(({ error }) => {
            if (error) console.warn('[Supabase] order pay error:', error.message);
          });
        return updated;
      }
      return o;
    });

    this.logAudit('Cashier', 'PAY_ORDER', { orderId, paymentMethod: paymentData.paymentMethod });
    this.save();
    return targetOrder;
  }

  public addSplitPayment(orderId: string, split: {
    amount: number;
    paymentMethod: Order['paymentMethod'];
    splitIndex: number;
    totalSplits: number;
    seatCovered?: string;
    itemsCovered?: string[];
  }): Order | null {
    let targetOrder: Order | null = null;
    this.orders = this.orders.map(o => {
      if (o.id === orderId) {
        const existingSplits = o.splitPayments || [];
        const newSplit: any = {
          id: `split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          amount: split.amount,
          paymentMethod: split.paymentMethod,
          paidAt: Date.now(),
          splitIndex: split.splitIndex,
          totalSplits: split.totalSplits,
          seatCovered: split.seatCovered,
          itemsCovered: split.itemsCovered
        };
        const updatedSplits = [...existingSplits, newSplit];
        const newPaidAmount = (o.paidAmount || 0) + split.amount;
        const isFullyPaid = newPaidAmount >= o.total - 1;
        const newPaymentStatus: 'paid' | 'partially_paid' = isFullyPaid ? 'paid' : 'partially_paid';

        const updated: Order = {
          ...o,
          splitPayments: updatedSplits,
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus,
          paymentMethod: split.paymentMethod
        };
        targetOrder = updated;

        const bId = o.restaurantId || 'rest-1';
        this.branches = this.branches.map(b => {
          if (b.id === bId || b.name === o.branchName) {
            return {
              ...b,
              dailyRevenueUGX: (b.dailyRevenueUGX || 0) + split.amount,
              ordersToday: isFullyPaid ? (b.ordersToday || 0) + 1 : (b.ordersToday || 0)
            };
          }
          return b;
        });

        supabase.from('orders').update(toDbOrder(updated))
          .eq('id', orderId).then(({ error }) => {
            if (error) console.warn('[Supabase] order split pay error:', error.message);
          });
        return updated;
      }
      return o;
    });

    this.logAudit('Cashier', 'SPLIT_PAY_ORDER', { orderId, splitIndex: split.splitIndex, amount: split.amount });
    this.save();
    return targetOrder;
  }

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  public addProduct(data: { name: string; price: number; category: any; image: string; requiresKitchen?: boolean; branchId?: string; branchName?: string }): Product {
    const p: Product = {
      id: `prod-${Date.now()}`,
      name: data.name, price: Number(data.price),
      category: data.category || 'mains',
      image: data.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      available: true,
      requiresKitchen: data.requiresKitchen ?? true,
      branchId: data.branchId,
      branchName: data.branchName
    };
    this.products = [p, ...this.products];
    this.logAudit('Manager/Admin', 'ADD_PRODUCT', { name: p.name, price: p.price, branch: p.branchName });
    this.save();
    safeWrite('products', 'upsert', toDbProduct(p));
    return p;
  }

  public updateProduct(id: string, updates: Partial<Product>) {
    this.products = this.products.map(p => {
      if (p.id === id) {
        const updated = { ...p, ...updates };
        safeWrite('products', 'upsert', toDbProduct(updated));
        return updated;
      }
      return p;
    });
    this.logAudit('Manager/Admin', 'EDIT_PRODUCT', { productId: id, ...updates });
    this.save();
  }

  public toggleProductAvailability(id: string) {
    this.products = this.products.map(p => {
      if (p.id === id) {
        const updated = { ...p, available: !p.available };
        safeWrite('products', 'update', { id, available: updated.available });
        return updated;
      }
      return p;
    });
    this.logAudit('Manager/Admin', 'TOGGLE_PRODUCT_AVAILABILITY', { productId: id });
    this.save();
  }

  // ── INGREDIENTS ───────────────────────────────────────────────────────────
  public addIngredient(data: {
    name: string; quantity: number; unit: string;
    category?: string; minThreshold?: number; costPerUnitUGX?: number; supplier?: string;
    branchId?: string; branchName?: string;
  }): Ingredient {
    const ing: Ingredient = {
      id: `ing-${Date.now()}`,
      name: data.name, quantity: Number(data.quantity),
      unit: data.unit || 'Units', minThreshold: data.minThreshold || 5,
      category: data.category || 'Pantry',
      costPerUnitUGX: data.costPerUnitUGX || 15000,
      supplier: data.supplier || 'Local Supplier',
      branchId: data.branchId,
      branchName: data.branchName
    };
    this.ingredients = [ing, ...this.ingredients];
    this.logAudit('Manager/Admin', 'ADD_INGREDIENT', { name: ing.name, branch: ing.branchName });
    this.save();
    safeWrite('ingredients', 'upsert', toDbIngredient(ing));
    return ing;
  }

  public updateIngredientQuantity(id: string, newQuantity: number) {
    this.ingredients = this.ingredients.map(ing => {
      if (ing.id === id) {
        const updated = { ...ing, quantity: Math.max(0, newQuantity) };
        safeWrite('ingredients', 'update', { id, quantity: updated.quantity });
        return updated;
      }
      return ing;
    });
    this.logAudit('Manager/Admin', 'UPDATE_INVENTORY_QTY', { ingredientId: id, newQuantity });
    this.save();
  }

  // ── STAFF ─────────────────────────────────────────────────────────────────
  public addStaffMember(data: {
    name: string; email: string; password?: string; pin?: string; phone?: string;
    idType?: 'National ID' | 'Passport' | 'Student ID'; idNumber?: string;
    role: StaffMember['role']; branch: string; assignedBranchId?: string; avatar?: string;
  }): StaffMember {
    const s: StaffMember = {
      id: `usr-${Date.now()}`,
      name: data.name, email: data.email,
      password: data.password || 'password123',
      pin: data.pin || '1234',
      phone: data.phone, idType: data.idType, idNumber: data.idNumber,
      role: data.role, branch: data.branch, assignedBranchId: data.assignedBranchId || 'rest-1',
      status: 'active',
      avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    };
    this.staff = [s, ...this.staff];
    this.logAudit('Admin/Manager', 'ADD_STAFF', { email: data.email, role: data.role, branch: data.branch });
    this.save();
    safeWrite('staff', 'upsert', toDbStaff(s));
    return s;
  }

  public updateStaffStatus(id: string, newStatus: StaffMember['status']) {
    this.staff = this.staff.map(s => {
      if (s.id === id) {
        const updated = { ...s, status: newStatus };
        safeWrite('staff', 'update', { id, status: newStatus });
        return updated;
      }
      return s;
    });
    this.logAudit('Admin/Manager', 'UPDATE_STAFF_STATUS', { staffId: id, newStatus });
    this.save();
  }

  public resetStaffPassword(id: string, newPassword?: string, newPin?: string) {
    this.staff = this.staff.map(s => {
      if (s.id === id) {
        const updated = { 
          ...s, 
          password: newPassword || s.password || 'password123',
          pin: newPin || s.pin || '1234'
        };
        safeWrite('staff', 'update', { id, password: updated.password, pin: updated.pin });
        return updated;
      }
      return s;
    });
    this.logAudit('Admin/Manager', 'RESET_STAFF_PASSWORD', { staffId: id });
    this.save();
  }

  public assignSuperAdminRole(id: string) {
    this.staff = this.staff.map(s => {
      if (s.id === id) {
        const updated = { ...s, role: 'Super Admin' as const, assignedBranchId: 'all', branch: 'Global HQ' };
        safeWrite('staff', 'update', { id, role: 'Super Admin', assigned_branch_id: 'all', branch: 'Global HQ' });
        return updated;
      }
      return s;
    });
    this.logAudit('Super Admin', 'PROMOTE_TO_SUPER_ADMIN', { staffId: id });
    this.save();
  }

  public deleteStaffMember(id: string) {
    this.staff = this.staff.filter(s => s.id !== id);
    this.save();
    safeWrite('staff', 'delete', { id });
    this.logAudit('Admin/Manager', 'DELETE_STAFF', { staffId: id });
  }

  // ── COMPANIES ─────────────────────────────────────────────────────────────
  public addCompany(data: { name: string; taxId: string; creditLimitUGX: number; contactPerson: string; phone: string; }): CompanyProfile {
    const c: CompanyProfile = {
      id: `comp-${Date.now()}`,
      name: data.name, taxId: data.taxId || 'URA-000000',
      creditLimitUGX: Number(data.creditLimitUGX) || 10000000,
      currentBalanceUGX: 0, contactPerson: data.contactPerson || 'N/A',
      phone: data.phone || '+256 700 000 000', status: 'active', createdAt: Date.now()
    };
    this.companies = [c, ...this.companies];
    this.logAudit('Admin/Manager', 'ADD_COMPANY_PROFILE', { name: c.name });
    this.save();
    safeWrite('companies', 'upsert', toDbCompany(c));
    return c;
  }

  public toggleCompanyStatus(id: string, newStatus: 'active' | 'suspended' | 'closed') {
    this.companies = this.companies.map(c => {
      if (c.id === id) {
        const updated = { ...c, status: newStatus };
        safeWrite('companies', 'update', { id, status: newStatus });
        return updated;
      }
      return c;
    });
    this.logAudit('Admin/Manager', 'TOGGLE_COMPANY_STATUS', { companyId: id, newStatus });
    this.save();
  }

  // ── COMPANY STAFF ─────────────────────────────────────────────────────────
  public addCompanyStaff(data: { companyId: string; name: string; workId?: string; email?: string; department?: string; creditLimitUGX?: number; }): CompanyStaff {
    const s: CompanyStaff = {
      id: `cstaff-${Date.now()}`,
      companyId: data.companyId, name: data.name,
      workId: data.workId || `ID-${Math.floor(1000 + Math.random() * 9000)}`,
      email: data.email || '', department: data.department || 'General Staff',
      creditLimitUGX: data.creditLimitUGX || 500000, status: 'active'
    };
    this.companyStaff = [s, ...this.companyStaff];
    this.logAudit('Admin/Manager', 'ADD_COMPANY_STAFF', { companyId: data.companyId, staffName: s.name });
    this.save();
    safeWrite('company_staff', 'upsert', toDbCompanyStaff(s));
    return s;
  }

  // ── ZONES ─────────────────────────────────────────────────────────────────
  public addPlaceZone(data: { name: string; icon: string; description: string; branchId?: string; branchName?: string; tables: { tableNumber: string; seatsCount: number }[]; }): PlaceZone {
    const z: PlaceZone = {
      id: `zone-${Date.now()}`,
      name: data.name, icon: data.icon || '📍',
      description: data.description || 'Seating area',
      branchId: data.branchId,
      branchName: data.branchName,
      tables: data.tables || []
    };
    this.zones = [...this.zones, z];
    this.logAudit('Admin/Manager', 'ADD_PLACE_ZONE', { name: z.name, branch: z.branchName });
    this.save();
    safeWrite('zones', 'upsert', toDbZone(z));
    return z;
  }

  public updatePlaceZone(updatedZone: PlaceZone) {
    this.zones = this.zones.map(z => z.id === updatedZone.id ? updatedZone : z);
    this.save();
    safeWrite('zones', 'upsert', toDbZone(updatedZone));
    this.logAudit('Admin/Manager', 'UPDATE_PLACE_ZONE', { zoneId: updatedZone.id });
  }

  public deletePlaceZone(id: string) {
    this.zones = this.zones.filter(z => z.id !== id);
    this.save();
    safeWrite('zones', 'delete', { id });
    this.logAudit('Admin/Manager', 'DELETE_PLACE_ZONE', { zoneId: id });
  }

  public addTableToZone(zoneId: string, tableNumber: string, seatsCount: number = 4, shape: 'round' | 'rectangle' = 'round') {
    this.zones = this.zones.map(z => {
      if (z.id === zoneId) {
        const existing = z.tables || [];
        if (existing.some(t => t.tableNumber.toUpperCase() === tableNumber.toUpperCase())) {
          return z;
        }
        const updatedTables = [...existing, { tableNumber, seatsCount, shape }];
        const updatedZone = { ...z, tables: updatedTables };
        safeWrite('zones', 'upsert', toDbZone(updatedZone));
        return updatedZone;
      }
      return z;
    });
    this.logAudit('Admin/Manager', 'ADD_TABLE_TO_ZONE', { zoneId, tableNumber, seatsCount });
    this.save();
  }

  public addSeatToTable(zoneId: string, tableNumber: string) {
    this.zones = this.zones.map(z => {
      if (z.id === zoneId) {
        const updatedTables = (z.tables || []).map(t => {
          if (t.tableNumber === tableNumber) {
            return { ...t, seatsCount: Math.min(24, t.seatsCount + 1) };
          }
          return t;
        });
        const updatedZone = { ...z, tables: updatedTables };
        safeWrite('zones', 'upsert', toDbZone(updatedZone));
        return updatedZone;
      }
      return z;
    });
    this.logAudit('Admin/Manager', 'ADD_SEAT', { zoneId, tableNumber });
    this.save();
  }

  public removeSeatFromTable(zoneId: string, tableNumber: string) {
    this.zones = this.zones.map(z => {
      if (z.id === zoneId) {
        const updatedTables = (z.tables || []).map(t => {
          if (t.tableNumber === tableNumber) {
            return { ...t, seatsCount: Math.max(1, t.seatsCount - 1) };
          }
          return t;
        });
        const updatedZone = { ...z, tables: updatedTables };
        safeWrite('zones', 'upsert', toDbZone(updatedZone));
        return updatedZone;
      }
      return z;
    });
    this.logAudit('Admin/Manager', 'REMOVE_SEAT', { zoneId, tableNumber });
    this.save();
  }

  public deleteTableFromZone(zoneId: string, tableNumber: string) {
    this.zones = this.zones.map(z => {
      if (z.id === zoneId) {
        const updatedTables = (z.tables || []).filter(t => t.tableNumber !== tableNumber);
        const updatedZone = { ...z, tables: updatedTables };
        safeWrite('zones', 'upsert', toDbZone(updatedZone));
        return updatedZone;
      }
      return z;
    });
    this.logAudit('Admin/Manager', 'DELETE_TABLE', { zoneId, tableNumber });
    this.save();
  }

  // ── EXPENSES ──────────────────────────────────────────────────────────────
  public addExpense(data: {
    branchId?: string; branchName?: string; title: string;
    category: Expense['category']; amountUGX: number; vatAmountUGX?: number; notes?: string; receiptUrl?: string;
  }): Expense {
    const exp: Expense = {
      id: `exp-${Date.now()}`,
      branchId: data.branchId,
      branchName: data.branchName || 'Krown Kampala Central',
      title: data.title,
      category: data.category,
      amountUGX: Number(data.amountUGX),
      vatAmountUGX: data.vatAmountUGX ?? Math.round(Number(data.amountUGX) * 0.18),
      notes: data.notes,
      receiptUrl: data.receiptUrl,
      createdAt: Date.now()
    };
    this.expenses = [exp, ...this.expenses];
    this.logAudit('Admin/Manager', 'ADD_EXPENSE', { title: exp.title, amount: exp.amountUGX });
    this.save();
    safeWrite('expenses', 'upsert', toDbExpense(exp));
    return exp;
  }

  // ── BRANCHES ──────────────────────────────────────────────────────────────
  public addBranch(data: {
    name: string; location: string; city?: string; manager: string; phone: string;
    email?: string; taxId?: string; address?: string; receiptHeaderNote?: string; receiptFooterNote?: string;
    tablesCount?: number;
  }): Branch {
    const b: Branch = {
      id: `br-${Date.now()}`,
      name: data.name,
      location: data.location,
      city: data.city || 'Kampala',
      manager: data.manager || 'Branch Manager',
      phone: data.phone || '+256 700 000 000',
      email: data.email || 'info@krownpos.com',
      taxId: data.taxId || 'URA-100293481',
      address: data.address || data.location,
      receiptHeaderNote: data.receiptHeaderNote || `Welcome to ${data.name}`,
      receiptFooterNote: data.receiptFooterNote || 'Thank you for dining with us! Powered by Krown Enterprise POS',
      tablesCount: data.tablesCount || 20,
      dailyRevenueUGX: 0,
      ordersToday: 0,
      status: 'online'
    };
    this.branches = [...this.branches, b];
    this.logAudit('Super Admin', 'ADD_BRANCH', { name: b.name });
    this.save();
    safeWrite('branches', 'upsert', toDbBranch(b));
    return b;
  }

  public updateBranchStatus(id: string, newStatus: Branch['status']) {
    this.branches = this.branches.map(b => {
      if (b.id === id) {
        const updated = { ...b, status: newStatus };
        safeWrite('branches', 'update', { id, status: newStatus });
        return updated;
      }
      return b;
    });
    this.logAudit('Super Admin', 'UPDATE_BRANCH_STATUS', { branchId: id, newStatus });
    this.save();
  }

  public deleteBranch(id: string) {
    this.branches = this.branches.filter(b => b.id !== id);
    this.save();
    safeWrite('branches', 'delete', { id });
    this.logAudit('Super Admin', 'DELETE_BRANCH', { branchId: id });
  }

  // ── AUDIT LOGS ────────────────────────────────────────────────────────────
  public logAudit(userEmail: string, action: string, details: any) {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userEmail, action, details,
      ipAddress: '197.239.4.12',
      timestamp: Date.now()
    };
    this.auditLogs = [log, ...this.auditLogs.slice(0, 499)];

    supabase.from('audit_logs').insert({
      id: log.id,
      user_email: log.userEmail,
      action: log.action,
      details: log.details,
      ip_address: log.ipAddress,
      created_at: log.timestamp,
    }).then(({ error }) => {
      if (error) console.warn('[Supabase] logAudit error:', error.message);
    });
  }
}

export const dataStore = new DataStoreEngine();
