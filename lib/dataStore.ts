import {
  Product, Ingredient, Order, Branch, StaffMember, AuditLog,
  CompanyProfile, CompanyStaff, PlaceZone, Expense, InventoryMovement, ProductIngredient, ProductAddOn, PrintJob
} from './mockData';
import { supabase } from './supabase';
import { queueOfflineOp, initAutoSync } from './sync';
import { ensureMirabalBranchAndMenu } from './mirabalMenuSeed';

type Listener = () => void;

export interface TableOccupancy {
  status: 'available' | 'occupied' | 'reserved';
  wholeTableOpen: boolean;
  openSeats: string[];
}

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
      if (payload.where) {
        let query: any = supabase.from(table).delete();
        Object.entries(payload.where).forEach(([col, val]) => {
          query = query.eq(col, val);
        });
        ({ error } = await query);
      } else {
        ({ error } = await supabase.from(table).delete().eq('id', payload.id));
      }
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


function toDbPrintJob(pj: PrintJob): any {
  return {
    id: pj.id,
    order_id: pj.orderId,
    type: pj.type,
    destination: pj.destination,
    printer_id: pj.printerId ?? null,
    payload: pj.payload,
    status: pj.status,
    attempts: pj.attempts,
    created_at: pj.createdAt,
    last_error: pj.lastError ?? null,
    printed_at: pj.printedAt ?? null
  };
}

function fromDbPrintJob(r: any): PrintJob {
  return {
    id: r.id,
    orderId: r.order_id,
    type: r.type,
    destination: r.destination,
    printerId: r.printer_id,
    payload: r.payload,
    status: r.status,
    attempts: r.attempts ?? 0,
    createdAt: r.created_at ? Number(r.created_at) : Date.now(),
    lastError: r.last_error,
    printedAt: r.printed_at ? Number(r.printed_at) : null
  };
}

// ─── DB Mapping Helpers ──────────────────────────────────────────────────────
function toDbOrder(o: Order): any {
  let createdNum: number;
  if (typeof o.createdAt === 'number') {
    createdNum = o.createdAt;
  } else if (typeof o.createdAt === 'string') {
    createdNum = new Date(o.createdAt).getTime();
  } else {
    createdNum = Date.now();
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
    prep_started_at: o.prepStartedAt ? (typeof o.prepStartedAt === 'number' ? o.prepStartedAt : new Date(o.prepStartedAt).getTime()) : null,
    restaurant_id: o.restaurantId ?? null,
    branch_name: o.branchName ?? null,
    user_id: o.userId ?? null,
    created_at: createdNum,
    tin_number: o.tinNumber ?? null,
    notes: o.notes ?? null,
    amount_received: o.amountReceived ?? null,
    change_amount: o.change ?? null,
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
    amountReceived: r.amount_received ? Number(r.amount_received) : undefined,
    change: r.change_amount ? Number(r.change_amount) : undefined,
    prepStartedAt: r.prep_started_at ? (typeof r.prep_started_at === 'string' ? new Date(r.prep_started_at).getTime() : Number(r.prep_started_at)) : undefined,
    restaurantId: r.restaurant_id,
    branchName: r.branch_name,
    userId: r.user_id,
    createdAt: parsedCreatedAt,
    tinNumber: r.tin_number ?? undefined,
    notes: r.notes ?? undefined,
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
    description: p.description ?? null,
    branch_id: p.branchId ?? null,
    branch_name: p.branchName ?? null,
    linked_ingredient_id: p.linkedIngredientId ?? null,
    deduct_from_inventory: p.deductFromInventory ?? false,
    inventory_deduct_amount: p.inventoryDeductAmount ?? 1,
    add_ons: p.addOns ?? [],
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
    description: r.description,
    branchId: r.branch_id,
    branchName: r.branch_name,
    linkedIngredientId: r.linked_ingredient_id ?? undefined,
    deductFromInventory: r.deduct_from_inventory ?? false,
    inventoryDeductAmount: r.inventory_deduct_amount ?? 1,
    addOns: r.add_ons ?? [],
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
    deduct_from_sales: i.deductFromSales ?? false,
    linked_product_id: i.linkedProductId ?? null,
    deduct_amount_per_sale: i.deductAmountPerSale ?? 1,
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
    deductFromSales: r.deduct_from_sales ?? false,
    linkedProductId: r.linked_product_id ?? undefined,
    deductAmountPerSale: r.deduct_amount_per_sale ?? 1,
  };
}

function toDbCompany(c: CompanyProfile): any {
  let createdNum: number;
  if (typeof c.createdAt === 'number') {
    createdNum = c.createdAt;
  } else if (typeof c.createdAt === 'string') {
    createdNum = new Date(c.createdAt).getTime();
  } else {
    createdNum = Date.now();
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
    created_at: createdNum,
    branch_id: c.branchId || null,
    branch_name: c.branchName || null,
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
    branchId: r.branch_id || null,
    branchName: r.branch_name || null,
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
    phone: s.phone ?? null,
    pin_code: s.pinCode ?? null,
    id_type: s.idType ?? null,
    id_number: s.idNumber ?? null,
    assigned_branch_id: s.assignedBranchId ?? null,
  };
}

function fromDbStaff(r: any): StaffMember {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    pinCode: r.pin_code || r.pinCode,
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
  let createdNum: number;
  if (typeof e.createdAt === 'number') {
    createdNum = e.createdAt;
  } else if (typeof e.createdAt === 'string') {
    createdNum = new Date(e.createdAt).getTime();
  } else {
    createdNum = Date.now();
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
    created_at: createdNum,
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

function toDbMovement(m: InventoryMovement): any {
  return {
    id: m.id,
    ingredient_id: m.ingredientId,
    ingredient_name: m.ingredientName,
    type: m.type,
    quantity_change: m.quantityChange,
    quantity_before: m.quantityBefore,
    quantity_after: m.quantityAfter,
    order_id: m.orderId ?? null,
    product_name: m.productName ?? null,
    branch_id: m.branchId ?? null,
    branch_name: m.branchName ?? null,
    performed_by: m.performedBy ?? 'System POS',
    created_at: m.createdAt || Date.now(),
  };
}

function fromDbMovement(r: any): InventoryMovement {
  return {
    id: r.id,
    ingredientId: r.ingredient_id,
    ingredientName: r.ingredient_name,
    type: r.type || 'sale_deduction',
    quantityChange: Number(r.quantity_change) || 0,
    quantityBefore: Number(r.quantity_before) || 0,
    quantityAfter: Number(r.quantity_after) || 0,
    orderId: r.order_id,
    productName: r.product_name,
    branchId: r.branch_id,
    branchName: r.branch_name,
    performedBy: r.performed_by,
    createdAt: r.created_at ? (typeof r.created_at === 'string' ? new Date(r.created_at).getTime() : Number(r.created_at)) : Date.now(),
  };
}

function toDbAuditLog(l: AuditLog): any {
  return {
    id: l.id,
    user_email: l.userEmail,
    action: l.action,
    details: l.details || {},
    ip_address: l.ipAddress || l.pcInfo || '',
    created_at: l.timestamp || Date.now(),
    staff_id: l.userId || null,
    branch_id: l.branchId || null,
    branch_name: l.branchName || null,
  };
}

function fromDbAuditLog(r: any): AuditLog {
  const dt = r.details || {};
  return {
    id: r.id,
    userEmail: r.user_email || dt.userEmail || dt.email || 'System',
    userId: r.staff_id || r.user_id || dt.userId || dt.staffId,
    userName: dt.userName || dt.name || (r.user_email ? r.user_email.split('@')[0] : 'Staff'),
    role: dt.role || dt.staffRole,
    action: r.action || 'ACTIVITY',
    section: dt.section || dt.portal || 'System',
    pcInfo: r.ip_address || dt.pcInfo || dt.device,
    details: dt,
    ipAddress: r.ip_address,
    timestamp: r.created_at ? (typeof r.created_at === 'string' ? new Date(r.created_at).getTime() : Number(r.created_at)) : Date.now(),
    branchId: r.branch_id || dt.branchId,
    branchName: r.branch_name || dt.branchName || dt.branch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

class DataStoreEngine {
  private products: Product[] = [];
  private productIngredients: ProductIngredient[] = [];
  private ingredients: Ingredient[] = [];
  private inventoryMovements: InventoryMovement[] = [];
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
  private customCategories: string[] = [];
  private printJobs: PrintJob[] = [];
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
        const sCats = localStorage.getItem('krown_categories');
        if (sCats) this.customCategories = JSON.parse(sCats);
        const sJobs = localStorage.getItem('krown_print_jobs');
        if (sJobs) this.printJobs = JSON.parse(sJobs);
      } catch (e) {
        console.warn('[DataStore] loadLocal parse warning:', e);
      }
    }
  }

  private async initSupabase() {
    await this.fetchAll();
    try { ensureMirabalBranchAndMenu(); } catch (e) { console.warn('Mirabal menu seed warning:', e); }
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
        { data: movements },
        { data: prodIngs },
        { data: printJobs },
      ] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('ingredients').select('*'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('branches').select('*'),
        supabase.from('staff').select('id, name, email, phone, id_type, id_number, role, branch, assigned_branch_id, status, avatar, created_at'),
        supabase.from('companies').select('*'),
        supabase.from('company_staff').select('*'),
        supabase.from('zones').select('*'),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory_movements').select('*').order('created_at', { ascending: false }).limit(300)
          .then(r => { if (r.error) { console.warn('[DataStore] inventory_movements not ready:', r.error.message); return { data: [] }; } return r; }),
        supabase.from('product_ingredients').select('*')
          .then(r => { if (r.error) { console.warn('[DataStore] product_ingredients not ready:', r.error.message); return { data: [] }; } return r; }),
        supabase.from('print_jobs').select('*').order('created_at', { ascending: false }).limit(100)
          .then(r => { if (r.error) { console.warn('[DataStore] print_jobs not ready:', r.error.message); return { data: [] }; } return r; }),
      ]);

      if (products) {
        this.products = products.map(fromDbProduct);
      }

      if (ingredients) {
        this.ingredients = ingredients.map(fromDbIngredient);
      }

      if (movements) {
        this.inventoryMovements = movements.map(fromDbMovement);
      }

      if (prodIngs && prodIngs.length > 0) {
        this.productIngredients = prodIngs.map((r: any) => ({
          id: r.id,
          productId: r.product_id,
          ingredientId: r.ingredient_id,
          quantityPerUnit: Number(r.quantity_per_unit) || 1,
          branchId: r.branch_id,
          createdAt: Number(r.created_at) || Date.now()
        }));
      }

      if (orders) {
        this.orders = orders.map(fromDbOrder);
      }

      if (branches) {
        this.branches = branches.map(fromDbBranch);
      }

      if (staff && staff.length > 0) {
        const dbStaffList = staff.map(fromDbStaff);
        const map = new Map<string, StaffMember>();
        this.staff.forEach(s => map.set(s.id, s));
        dbStaffList.forEach(s => map.set(s.id, s));
        this.staff = Array.from(map.values());
      }

      if (companies) {
        this.companies = companies.map(fromDbCompany);
      }

      if (companyStaff) {
        this.companyStaff = companyStaff.map(fromDbCompanyStaff);
      }

      if (zones) {
        this.zones = zones.map(fromDbZone);
      }

      if (auditLogs) {
        this.auditLogs = auditLogs.map(fromDbAuditLog);
      }

      if (expenses) {
        this.expenses = expenses.map(fromDbExpense);
      }

      if (printJobs) {
        this.printJobs = printJobs.map(fromDbPrintJob);
      }

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements' }, (p) => this.handleRealtime('inventory_movements', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, (p) => this.handleRealtime('zones', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, (p) => this.handleRealtime('companies', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_staff' }, (p) => this.handleRealtime('company_staff', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, (p) => this.handleRealtime('staff', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (p) => this.handleRealtime('expenses', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, (p) => this.handleRealtime('audit_logs', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, (p) => this.handleRealtime('print_jobs', p))
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
      case 'inventory_movements':
        this.inventoryMovements = apply(this.inventoryMovements, fromDbMovement);
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
        this.auditLogs = apply(this.auditLogs, fromDbAuditLog);
        break;
      case 'print_jobs':
        this.printJobs = apply(this.printJobs, fromDbPrintJob).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
    }
    this.persistLocal();
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
      localStorage.setItem('krown_categories',  JSON.stringify(this.customCategories));
      localStorage.setItem('krown_print_jobs',  JSON.stringify(this.printJobs));
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
      const b = this.branches.find(x => x.id === branchId || x.name.toLowerCase() === branchId.toLowerCase());
      const targetId = b ? b.id : branchId;
      const bName = b ? b.name.toLowerCase() : branchId.toLowerCase();
      
      const filtered = this.products.filter(p =>
        p.branchId === targetId ||
        (p.branchName && p.branchName.toLowerCase() === bName) ||
        (bName.includes('mirabal') && (p.branchName?.toLowerCase().includes('mirabal') || p.branchId === 'branch-mirabal'))
      );

      if (filtered.length === 0 && bName.includes('mirabal')) {
        return this.products.filter(p => p.branchId === 'branch-mirabal' || p.branchName?.toLowerCase() === 'mirabal');
      }

      return filtered;
    }
    return this.products;
  }

  public getIngredients(branchId?: string): Ingredient[] {
    if (branchId && branchId !== 'all') {
      return this.ingredients.filter(i => i.branchId === branchId);
    }
    return this.ingredients;
  }

  public getInventoryMovements(branchId?: string): InventoryMovement[] {
    if (branchId && branchId !== 'all') {
      return this.inventoryMovements.filter(m => m.branchId === branchId);
    }
    return this.inventoryMovements;
  }

  public recordInventoryDeductions(items: any[], orderId: string, branchId?: string, branchName?: string) {
    // 1. Client-side update for real-time offline-first UI speed
    items.forEach((item: any) => {
      const soldQty = Number(item.quantity) || 1;
      // Find all ingredients consumed by this product from product_ingredients mapping table
      const recipe = this.productIngredients.filter(pi => pi.productId === item.id);
      const recipeIngredientIds = new Set(recipe.map(pi => pi.ingredientId));
      // Also honor ingredients with deductFromSales + linkedProductId (auto-deduct mode)
      const linked = this.ingredients.filter(ing =>
        ing.deductFromSales && (ing.linkedProductId === item.id || ing.linkedProductId === item.productId)
      );
      const targets = [
        ...recipe.map(pi => ({ ingredientId: pi.ingredientId, qtyPerSale: pi.quantityPerUnit })),
        ...linked.map(ing => ({ ingredientId: ing.id, qtyPerSale: ing.deductAmountPerSale ?? 1 })),
      ].filter((t, idx, arr) => arr.findIndex(x => x.ingredientId === t.ingredientId) === idx);

      targets.forEach(({ ingredientId, qtyPerSale }) => {
        const ingredient = this.ingredients.find(ing => ing.id === ingredientId);
        if (ingredient) {
          const deductQty = qtyPerSale * soldQty;
          const qtyBefore = Number(ingredient.quantity) || 0;
          const qtyAfter = Math.max(0, qtyBefore - deductQty);

          // Update local state
          this.ingredients = this.ingredients.map(ing =>
            ing.id === ingredient.id ? { ...ing, quantity: qtyAfter } : ing
          );

          // Write updated stock to Supabase
          safeWrite('ingredients', 'update', { id: ingredient.id, quantity: qtyAfter });

          // Record inventory movement log
          const mov: InventoryMovement = {
            id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            type: 'sale_deduction',
            quantityChange: -deductQty,
            quantityBefore: qtyBefore,
            quantityAfter: qtyAfter,
            orderId,
            productName: item.name,
            branchId,
            branchName,
            performedBy: 'POS Sale Auto-Deduct',
            createdAt: Date.now()
          };
          this.inventoryMovements = [mov, ...this.inventoryMovements];
          safeWrite('inventory_movements', 'upsert', toDbMovement(mov));
        }
      });
    });

    // 2. Server-side RPC invocation for transactional database guarantees
    const rpcPayload = items.map(item => ({
      productId: item.id,
      quantity: Number(item.quantity) || 1
    }));
    supabase.rpc('deduct_inventory_for_items', { order_items: rpcPayload }).then(({ error }) => {
      if (error) {
        console.warn('[DataStore] deduct_inventory_for_items RPC error:', error.message);
      }
    });
  }

  public globalSearch(query: string, branchId?: string) {
    const q = query.trim().toLowerCase();
    if (!q) return { products: [], ingredients: [], staff: [], companies: [], orders: [], branches: [] };

    const prods = this.getProducts(branchId).filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    const ings = this.getIngredients(branchId).filter(i => i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q) || (i.supplier || '').toLowerCase().includes(q));
    const stf = this.getStaff(branchId).filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || (s.branch || '').toLowerCase().includes(q));
    const comps = this.getCompanies().filter(c => c.name.toLowerCase().includes(q) || c.taxId.toLowerCase().includes(q) || c.contactPerson.toLowerCase().includes(q));
    const ords = this.getOrders(branchId).filter(o => o.id.toLowerCase().includes(q) || o.table.toLowerCase().includes(q) || (o.companyName || '').toLowerCase().includes(q) || (o.tinNumber || '').toLowerCase().includes(q));
    const brs = this.branches.filter(b => b.name.toLowerCase().includes(q) || b.location.toLowerCase().includes(q) || (b.city || '').toLowerCase().includes(q));

    return { products: prods, ingredients: ings, staff: stf, companies: comps, orders: ords, branches: brs };
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

  public getPrintJobs(orderId?: string): PrintJob[] {
    if (orderId) {
      return this.printJobs.filter(pj => pj.orderId === orderId);
    }
    return this.printJobs;
  }

  public addPrintJob(pj: Omit<PrintJob, 'attempts' | 'createdAt' | 'printedAt' | 'lastError'>): PrintJob {
    const newJob: PrintJob = {
      ...pj,
      attempts: 0,
      createdAt: Date.now(),
      printedAt: null,
      lastError: null
    };
    this.printJobs = [newJob, ...this.printJobs];
    safeWrite('print_jobs', 'insert', toDbPrintJob(newJob));
    this.persistLocal();
    return newJob;
  }

  public updatePrintJobStatus(id: string, status: PrintJob['status'], details?: { attempts?: number; lastError?: string | null; printedAt?: number | null }) {
    let updatedJob: PrintJob | null = null;
    this.printJobs = this.printJobs.map(pj => {
      if (pj.id === id) {
        const u = {
          ...pj,
          status,
          attempts: details?.attempts !== undefined ? details.attempts : pj.attempts,
          lastError: details?.lastError !== undefined ? details.lastError : pj.lastError,
          printedAt: details?.printedAt !== undefined ? details.printedAt : pj.printedAt
        };
        updatedJob = u;
        return u;
      }
      return pj;
    });
    if (updatedJob) {
      safeWrite('print_jobs', 'upsert', toDbPrintJob(updatedJob));
    }
    this.persistLocal();
  }

  public getCustomCategories(): string[] {
    return this.customCategories;
  }

  public addCustomCategory(cat: string) {
    const cleaned = cat.trim();
    if (cleaned) {
      const exists = this.customCategories.some(c => c.toLowerCase() === cleaned.toLowerCase());
      if (!exists) {
        this.customCategories = [...this.customCategories, cleaned];
        this.persistLocal();
      }
    }
  }

  public deleteCustomCategory(cat: string) {
    this.customCategories = this.customCategories.filter(c => c.toLowerCase() !== cat.trim().toLowerCase());
    this.persistLocal();
  }

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

  public updateStaffRole(id: string, role: StaffMember['role'], branchId?: string) {
    let targetStaff: StaffMember | null = null;
    this.staff = this.staff.map(s => {
      if (s.id === id) {
        const updated = { ...s, role, assignedBranchId: branchId ?? s.assignedBranchId };
        targetStaff = updated;
        safeWrite('staff', 'update', { id, role, assigned_branch_id: branchId ?? s.assignedBranchId });
        return updated;
      }
      return s;
    });
    this.logAudit('Admin', 'UPDATE_STAFF_ROLE', { staffId: id, newRole: role, branchId });
    this.save();
    return targetStaff;
  }

  public deleteStaff(id: string) {
    this.staff = this.staff.filter(s => s.id !== id);
    this.logAudit('Admin', 'DELETE_STAFF', { staffId: id });
    this.save();
    safeWrite('staff', 'delete', { id });
  }

  public updateStaffStatus(id: string, status: StaffMember['status']) {
    let targetStaff: StaffMember | null = null;
    this.staff = this.staff.map(s => {
      if (s.id === id) {
        const updated = { ...s, status };
        targetStaff = updated;
        safeWrite('staff', 'update', { id, status });
        return updated;
      }
      return s;
    });
    this.logAudit('Admin', 'UPDATE_STAFF_STATUS', { staffId: id, status });
    this.save();
    return targetStaff;
  }


  public getAuditLogs(branchId?: string): AuditLog[] {
    if (branchId && branchId !== 'all') {
      const branchObj = this.branches.find(b => b.id === branchId || b.name.toLowerCase() === branchId.toLowerCase());
      const bName = branchObj ? branchObj.name.toLowerCase() : branchId.toLowerCase();
      return this.auditLogs.filter(l =>
        l.branchId === branchId ||
        (l.branchName && l.branchName.toLowerCase() === bName) ||
        (l.details && (l.details.branchId === branchId || (l.details.branch && String(l.details.branch).toLowerCase() === bName)))
      );
    }
    return this.auditLogs;
  }

  public getCompanies(branchId?: string): CompanyProfile[] {
    if (branchId && branchId !== 'all') {
      return this.companies.filter(c => c.branchId === branchId);
    }
    return this.companies;
  }

  public getCompanyStaff(companyId?: string): CompanyStaff[] {
    if (companyId) return this.companyStaff.filter(s => s.companyId === companyId);
    return this.companyStaff;
  }

  public getZones(branchId?: string): PlaceZone[] {
    if (branchId && branchId !== 'all') {
      return this.zones.filter(z => z.branchId === branchId);
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
  public createOrder(orderData: {
    table: string; place?: string; seat?: string;
    type: 'Dine In' | 'Takeaway' | 'Delivery';
    items: any[]; subtotal: number; tax: number; total: number;
    paymentMethod: Order['paymentMethod'];
    isCorporateCredit?: boolean; companyId?: string; companyName?: string;
    companyStaffId?: string; companyStaffName?: string; workId?: string;
    restaurantId?: string; branchName?: string; userId?: string;
    tinNumber?: string; notes?: string;
  }): Order {
    const prepETA = this.calculatePrepETA(orderData.items);
    const branchObj = this.branches.find(b => b.id === orderData.restaurantId);
    const newOrder: Order = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString(36)}`,
      table: orderData.table,
      place: orderData.place || 'Main Dining Hall',
      seat: orderData.seat || 'Whole Table',
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
      restaurantId: orderData.restaurantId || this.branches[0]?.id || '',
      branchName: orderData.branchName || branchObj?.name || this.branches[0]?.name || '',
      userId: orderData.userId || 'demo-user',
      createdAt: Date.now(),
      tinNumber: orderData.tinNumber,
      notes: orderData.notes,
    };

    // Corporate Credit: update company balance
    if (newOrder.isCorporateCredit && newOrder.companyId) {
      this.companies = this.companies.map(c => {
        if (c.id === newOrder.companyId) {
          const updated = { ...c, currentBalanceUGX: c.currentBalanceUGX + newOrder.total };
          safeWrite('companies', 'update', { id: c.id, current_balance_ugx: updated.currentBalanceUGX });
          return updated;
        }
        return c;
      });
    }

    // Auto-deduct inventory for linked products and ingredients
    this.recordInventoryDeductions(
      orderData.items,
      newOrder.id,
      newOrder.restaurantId,
      newOrder.branchName
    );

    this.orders = [newOrder, ...this.orders];
    
    // TABLE MANAGEMENT RULE: Set table to Occupied (RED) on Dine In order placement
    if (newOrder.type === 'Dine In' && newOrder.table) {
      this.updateTableOccupancy(newOrder.table, 'occupied');
    }

    this.logAudit('POS Operator', 'PLACE_ORDER', {
      orderId: newOrder.id, total: newOrder.total,
      place: newOrder.place, table: newOrder.table,
      paymentMethod: newOrder.paymentMethod,
      branchName: newOrder.branchName
    });
    this.save();
    safeWrite('orders', 'upsert', toDbOrder(newOrder));
    return newOrder;
  }

  public placeOrder(orderData: any): Order {
    return this.createOrder(orderData);
  }

  // ── DRAFT / ONGOING ORDERS ─────────────────────────────────────────────────
  /** Add items to an existing open order */
  public addItemsToOrder(orderId: string, newItems: any[]): Order | null {
    let targetOrder: Order | null = null;
    this.orders = this.orders.map(o => {
      if (o.id === orderId) {
        const mergedItems = [...o.items];
        newItems.forEach((newItem: any) => {
          const existing = mergedItems.find(i => i.id === newItem.id || i.name === newItem.name);
          if (existing) {
            existing.quantity = (existing.quantity || 1) + (newItem.quantity || 1);
          } else {
            mergedItems.push({ ...newItem });
          }
        });
        const grandTotal = mergedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const tax = 0;
        const subtotal = grandTotal;
        const updated: Order = { ...o, items: mergedItems, subtotal, tax, total: grandTotal };
        targetOrder = updated;

        // Auto-deduct inventory for the newly added items
        this.recordInventoryDeductions(newItems, updated.id, updated.restaurantId, updated.branchName);

        // Ensure table status remains occupied
        if (updated.type === 'Dine In' && updated.table) {
          this.updateTableOccupancy(updated.table, 'occupied');
        }

        safeWrite('orders', 'upsert', toDbOrder(updated));
        return updated;
      }
      return o;
    });
    this.logAudit('Waiter/Cashier', 'ADD_ITEMS_TO_ORDER', { orderId, itemCount: newItems.length });
    this.save();
    return targetOrder;
  }

  /** Get open (unpaid) order for a table within the SAME seating scope.
   *  - Passing a specific seat matches ONLY that seat's open bill.
   *  - 'Whole Table' (or no seat) matches ONLY whole-table open bills.
   *  This is the intelligence rule: a free seat never borrows another seat's bill. */
  public getOpenOrderByTable(tableNumber: string, seat?: string): Order | null {
    const seatScope = seat && seat !== 'Whole Table' ? seat : '';
    return this.orders.find(o => {
      if (!o || o.table !== tableNumber) return false;
      if (o.paymentStatus === 'paid' || o.status === 'cancelled' || o.status === 'completed') return false;
      const oSeat = o.seat || '';
      if (seatScope) {
        // Same-seat scope
        if (oSeat === 'Whole Table' || oSeat === '') return false; // whole-table bill ≠ this seat
        return oSeat === seatScope;
      }
      // Whole-table scope
      return oSeat === 'Whole Table' || oSeat === '';
    }) || null;
  }

  /** Derived occupancy: a table is Occupied if it has an open whole-table bill
   *  OR at least one occupied seat. Each open per-seat bill occupies its seat.
   *  Stored 'reserved' status (from Admin zoning) takes priority. */
  public getTableOccupancy(tableNumber: string): TableOccupancy {
    const stored = this.zones
      .flatMap(z => z.tables || [])
      .find(t => t.tableNumber === tableNumber);
    if (stored?.status === 'reserved') {
      return { status: 'reserved', wholeTableOpen: false, openSeats: [] };
    }
    const open = this.orders.filter(o =>
      o.table === tableNumber &&
      o.paymentStatus !== 'paid' &&
      o.status !== 'cancelled' &&
      o.status !== 'completed'
    );
    const wholeTableOpen = open.some(o => (o.seat || '') === 'Whole Table' || (o.seat || '') === '');
    const openSeats = open
      .filter(o => (o.seat || '') !== 'Whole Table' && (o.seat || '') !== '')
      .map(o => o.seat as string);
    return {
      status: (wholeTableOpen || openSeats.length > 0) ? 'occupied' : 'available',
      wholeTableOpen,
      openSeats,
    };
  }

  /** Get open order by ID */
  public getOpenOrderById(orderId: string): Order | null {
    return this.orders.find(o =>
      (o.id === orderId || o.id.includes(orderId)) &&
      o.paymentStatus !== 'paid' &&
      o.status !== 'cancelled' &&
      o.status !== 'completed'
    ) || null;
  }

  /** Update customer TIN on an order */
  public updateOrderCustomerTin(orderId: string, tin: string): Order | null {
    let targetOrder: Order | null = null;
    this.orders = this.orders.map(o => {
      if (o.id === orderId) {
        const updated = { ...o, tinNumber: tin };
        targetOrder = updated;
        safeWrite('orders', 'update', { id: orderId, tin_number: tin });
        return updated;
      }
      return o;
    });
    this.save();
    return targetOrder;
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
    tinNumber?: string;
    amountReceived?: number;
    change?: number;
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
          tinNumber: paymentData.tinNumber ?? o.tinNumber,
          amountReceived: paymentData.amountReceived ?? o.amountReceived,
          change: paymentData.change ?? o.change,
          paymentStatus: 'paid',
          paidAmount: o.total,
          status: o.status === 'pending' ? 'preparing' : o.status
        };
        targetOrder = updated;

        if (updated.isCorporateCredit && updated.companyId) {
          this.companies = this.companies.map(c => {
            if (c.id === updated.companyId) {
              const uComp = { ...c, currentBalanceUGX: c.currentBalanceUGX + updated.total };
              safeWrite('companies', 'update', { id: c.id, current_balance_ugx: uComp.currentBalanceUGX });
              return uComp;
            }
            return c;
          });
        }

        const bId = o.restaurantId || '';
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

        // TABLE MANAGEMENT RULE: Table returns to Available (GREEN) ONLY when Cashier completes payment settlement
        if (updated.table) {
          const hasRemainingUnpaid = this.orders.some(other =>
            other.id !== updated.id &&
            other.table === updated.table &&
            other.paymentStatus !== 'paid' &&
            other.status !== 'completed' &&
            other.status !== 'cancelled'
          );
          if (!hasRemainingUnpaid) {
            this.updateTableOccupancy(updated.table, 'available');
          }
        }

        safeWrite('orders', 'upsert', toDbOrder(updated));
        return updated;
      }
      return o;
    });

    this.logAudit('Cashier', 'PAY_ORDER', { orderId, paymentMethod: paymentData.paymentMethod });
    this.save();
    return targetOrder;
  }

  /** Settle Corporate Credit Balance by payment amount */
  public settleCompanyBalance(companyId: string, amountPaid: number, paymentMethod: any, notes?: string): CompanyProfile | null {
    let updatedComp: CompanyProfile | null = null;
    this.companies = this.companies.map(c => {
      if (c.id === companyId) {
        const newBalance = Math.max(0, c.currentBalanceUGX - amountPaid);
        const updated = { ...c, currentBalanceUGX: newBalance };
        updatedComp = updated;
        safeWrite('companies', 'update', { id: companyId, current_balance_ugx: newBalance });
        return updated;
      }
      return c;
    });
    this.logAudit('Cashier/Admin', 'SETTLE_CORPORATE_BALANCE', { companyId, amountPaid, paymentMethod, notes });
    this.save();
    return updatedComp;
  }

  public updateTableOccupancy(tableNumber: string, status: 'available' | 'occupied' | 'reserved') {
    this.zones = this.zones.map(z => {
      const hasTable = (z.tables || []).some(t => t.tableNumber === tableNumber);
      if (hasTable) {
        const updatedTables = (z.tables || []).map(t =>
          t.tableNumber === tableNumber ? { ...t, status } : t
        );
        const updatedZone = { ...z, tables: updatedTables };
        safeWrite('zones', 'upsert', toDbZone(updatedZone));
        return updatedZone;
      }
      return z;
    });
    this.save();
  }

  public addSplitPayment(orderId: string, split: {
    amount: number;
    paymentMethod: Order['paymentMethod'];
    splitIndex: number;
    totalSplits: number;
    seatCovered?: string;
    itemsCovered?: string[];
    guestLabel?: string;
    guestItems?: { id?: string; name: string; price: number; quantity: number; amount: number }[];
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
          itemsCovered: split.itemsCovered,
          guestLabel: split.guestLabel,
          guestItems: split.guestItems,
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

        const bId = o.restaurantId || '';
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

        safeWrite('orders', 'upsert', toDbOrder(updated));
        return updated;
      }
      return o;
    });

    this.logAudit('Cashier', 'SPLIT_PAY_ORDER', { orderId, splitIndex: split.splitIndex, amount: split.amount });
    this.save();
    return targetOrder;
  }

  /** Clear all sales, orders, and receipts for a specific branch */
  public clearBranchSales(branchId: string, branchName?: string) {
    const bName = branchName?.toLowerCase() || 'mirabal';
    this.orders = this.orders.filter(o => o.branchId !== branchId && o.branchName?.toLowerCase() !== bName);
    this.printJobs = this.printJobs.filter(pj => pj.branchId !== branchId && pj.branchName?.toLowerCase() !== bName);

    this.branches = this.branches.map(b => {
      if (b.id === branchId || b.name.toLowerCase() === bName) {
        return { ...b, dailyRevenueUGX: 0, ordersToday: 0 };
      }
      return b;
    });

    this.save();
    safeWrite('orders', 'delete', { where: { branch_id: branchId } });
    safeWrite('print_jobs', 'delete', { where: { branch_id: branchId } });
  }

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  public addProduct(data: {
    name: string; price: number; category: any; image: string;
    available?: boolean; requiresKitchen?: boolean; description?: string; branchId?: string; branchName?: string;
    deductFromInventory?: boolean; inventoryDeductAmount?: number;
    addOns?: ProductAddOn[];
  }): Product {
    const p: Product = {
      id: `prod-${Date.now()}`,
      name: data.name, price: Number(data.price),
      category: data.category || 'mains',
      image: data.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      available: data.available ?? true,
      requiresKitchen: data.requiresKitchen ?? true,
      description: data.description,
      branchId: data.branchId,
      branchName: data.branchName,
      deductFromInventory: data.deductFromInventory ?? false,
      inventoryDeductAmount: data.inventoryDeductAmount ?? 1,
      addOns: data.addOns ?? [],
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
    deductFromSales?: boolean; linkedProductId?: string; deductAmountPerSale?: number;
  }): Ingredient {
    const ing: Ingredient = {
      id: `ing-${Date.now()}`,
      name: data.name, quantity: Number(data.quantity),
      unit: data.unit || 'Units', minThreshold: data.minThreshold || 5,
      category: data.category || 'Pantry',
      costPerUnitUGX: data.costPerUnitUGX || 15000,
      supplier: data.supplier || 'Local Supplier',
      branchId: data.branchId,
      branchName: data.branchName,
      deductFromSales: data.deductFromSales ?? false,
      linkedProductId: data.linkedProductId,
      deductAmountPerSale: data.deductAmountPerSale ?? 1,
    };
    this.ingredients = [ing, ...this.ingredients];
    this.logAudit('Manager/Admin', 'ADD_INGREDIENT', { name: ing.name, branch: ing.branchName });
    this.save();
    safeWrite('ingredients', 'upsert', toDbIngredient(ing));
    return ing;
  }

  public updateIngredient(id: string, updates: Partial<Ingredient>) {
    this.ingredients = this.ingredients.map(ing => {
      if (ing.id === id) {
        const updated = { ...ing, ...updates };
        safeWrite('ingredients', 'upsert', toDbIngredient(updated));
        return updated;
      }
      return ing;
    });
    this.logAudit('Manager/Admin', 'UPDATE_INGREDIENT', { ingredientId: id, ...updates });
    this.save();
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

  public deleteIngredient(id: string) {
    this.ingredients = this.ingredients.filter(ing => ing.id !== id);
    this.logAudit('Manager/Admin', 'DELETE_INGREDIENT', { ingredientId: id });
    this.save();
    safeWrite('ingredients', 'delete', { id });
  }

  // ── STAFF ─────────────────────────────────────────────────────────────────
  public addStaffMember(data: {
    name: string; email: string; phone?: string;
    idType?: 'National ID' | 'Passport' | 'Student ID'; idNumber?: string;
    role: StaffMember['role']; branch: string; assignedBranchId?: string; avatar?: string;
  }): StaffMember {
    const s: StaffMember = {
      id: `usr-${Date.now()}`,
      name: data.name, email: data.email,
      phone: data.phone, idType: data.idType, idNumber: data.idNumber,
      role: data.role, branch: data.branch, assignedBranchId: data.assignedBranchId || undefined,
      status: 'active',
      avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    };
    this.staff = [s, ...this.staff];
    this.logAudit('Admin/Manager', 'ADD_STAFF', { email: data.email, role: data.role, branch: data.branch });
    this.save();
    safeWrite('staff', 'upsert', toDbStaff(s));
    return s;
  }

  public resetStaffPassword(id: string) {
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
  public addCompany(data: { name: string; taxId: string; creditLimitUGX: number; contactPerson: string; phone: string; branchId?: string; branchName?: string; }): CompanyProfile {
    const c: CompanyProfile = {
      id: `comp-${Date.now()}`,
      name: data.name, taxId: data.taxId || 'URA-000000',
      creditLimitUGX: Number(data.creditLimitUGX) || 10000000,
      currentBalanceUGX: 0, contactPerson: data.contactPerson || 'N/A',
      phone: data.phone || '+256 700 000 000', status: 'active', createdAt: Date.now(),
      branchId: data.branchId, branchName: data.branchName
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

  public updateCompanyStatus(id: string, newStatus: 'active' | 'suspended' | 'closed') {
    this.toggleCompanyStatus(id, newStatus);
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

  public updateCompanyStaffStatus(id: string, newStatus: 'active' | 'inactive' | 'banned') {
    this.companyStaff = this.companyStaff.map(s => {
      if (s.id === id) {
        const updated = { ...s, status: newStatus };
        safeWrite('company_staff', 'update', { id, status: newStatus });
        return updated;
      }
      return s;
    });
    this.logAudit('Admin/Manager', 'UPDATE_COMPANY_STAFF_STATUS', { companyStaffId: id, newStatus });
    this.save();
  }

  public deleteCompanyStaff(id: string) {
    this.companyStaff = this.companyStaff.filter(s => s.id !== id);
    this.logAudit('Admin/Manager', 'DELETE_COMPANY_STAFF', { companyStaffId: id });
    this.save();
    safeWrite('company_staff', 'delete', { id });
  }

  /** Get payment method breakdown for orders */
  public getPaymentBreakdown(orders: Order[]): Record<string, { total: number; count: number; percentage: number }> {
    const breakdown: Record<string, { total: number; count: number; percentage: number }> = {
      'Cash': { total: 0, count: 0, percentage: 0 },
      'MTN Mobile Money': { total: 0, count: 0, percentage: 0 },
      'Airtel Money': { total: 0, count: 0, percentage: 0 },
      'Credit Card': { total: 0, count: 0, percentage: 0 },
      'Bank Transfer': { total: 0, count: 0, percentage: 0 },
      'Corporate Credit': { total: 0, count: 0, percentage: 0 },
    };

    let totalPaidSum = 0;
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid' || o.status === 'completed' || o.paymentStatus === 'partially_paid');

    paidOrders.forEach(o => {
      if (o.splitPayments && o.splitPayments.length > 0) {
        o.splitPayments.forEach((sp: any) => {
          const pm = sp.paymentMethod || 'Cash';
          if (!breakdown[pm]) breakdown[pm] = { total: 0, count: 0, percentage: 0 };
          breakdown[pm].total += (sp.amount || 0);
          breakdown[pm].count += 1;
          totalPaidSum += (sp.amount || 0);
        });
      } else {
        const pm = o.paymentMethod || 'Cash';
        if (!breakdown[pm]) breakdown[pm] = { total: 0, count: 0, percentage: 0 };
        const amt = o.paidAmount || o.total || 0;
        breakdown[pm].total += amt;
        breakdown[pm].count += 1;
        totalPaidSum += amt;
      }
    });

    if (totalPaidSum > 0) {
      Object.keys(breakdown).forEach(k => {
        breakdown[k].percentage = Math.round((breakdown[k].total / totalPaidSum) * 100);
      });
    }

    return breakdown;
  }

  /** Check if a company staff member is allowed to make purchases */
  public isCompanyStaffAllowed(staffId: string): boolean {
    const s = this.companyStaff.find(cs => cs.id === staffId);
    if (!s) return false;
    if (s.status === 'banned' || s.status === 'inactive') return false;
    const company = this.companies.find(c => c.id === s.companyId);
    if (!company || company.status === 'suspended' || company.status === 'closed') return false;
    return true;
  }

  // ── RECIPES / PRODUCT INGREDIENTS ──────────────────────────────────────────
  public getProductIngredients(productId?: string): ProductIngredient[] {
    if (productId) {
      return this.productIngredients.filter(pi => pi.productId === productId);
    }
    return this.productIngredients;
  }

  public async saveProductIngredients(productId: string, ingredients: { ingredientId: string, quantityPerUnit: number }[], branchId?: string) {
    // Delete local memory recipe mappings for this product
    this.productIngredients = this.productIngredients.filter(pi => pi.productId !== productId);
    safeWrite('product_ingredients', 'delete', { where: { product_id: productId } });

    // Insert new recipe mappings
    const newItems = ingredients.map(i => {
      const item: ProductIngredient = {
        id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId,
        ingredientId: i.ingredientId,
        quantityPerUnit: Number(i.quantityPerUnit),
        branchId,
        createdAt: Date.now()
      };
      return item;
    });

    this.productIngredients = [...this.productIngredients, ...newItems];
    this.persistLocal();
    this.notify();

    for (const item of newItems) {
      safeWrite('product_ingredients', 'upsert', {
        id: item.id,
        product_id: item.productId,
        ingredient_id: item.ingredientId,
        quantity_per_unit: item.quantityPerUnit,
        branch_id: item.branchId || null,
        created_at: item.createdAt
      });
    }
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
  public logAudit(
    userEmail: string,
    action: string,
    details: any,
    branchId?: string,
    branchName?: string,
    section?: string,
    pcInfo?: string
  ) {
    const fallbackActorEmail = this.staff.some(s => s.email?.toLowerCase() === String(userEmail).toLowerCase())
      ? String(userEmail).toLowerCase()
      : '';

    const createLog = (actorEmail: string): { row: any; entry: AuditLog } => {
      const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const staffRow = this.staff.find(s => s.email?.toLowerCase() === actorEmail.toLowerCase() || s.id === userEmail);
      
      const bId = branchId || staffRow?.assignedBranchId || undefined;
      const bName = branchName || staffRow?.branch || undefined;

      const devicePlatform = typeof navigator !== 'undefined'
        ? `${navigator.platform || 'PC'} (${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser'})`
        : 'Windows PC';

      const pc = pcInfo || details?.pcInfo || devicePlatform;
      const sec = section || details?.section || 'System';

      const enrichedDetails = {
        ...(details || {}),
        userId: staffRow?.id,
        userName: staffRow?.name,
        role: staffRow?.role,
        branchId: bId,
        branchName: bName,
        section: sec,
        pcInfo: pc,
      };

      const entry: AuditLog = {
        id,
        userEmail: actorEmail || staffRow?.email || userEmail || 'System',
        userId: staffRow?.id,
        userName: staffRow?.name,
        role: staffRow?.role,
        action,
        section: sec,
        pcInfo: pc,
        details: enrichedDetails,
        ipAddress: pc,
        timestamp: Date.now(),
        branchId: bId,
        branchName: bName,
      };

      const row = toDbAuditLog(entry);
      return { row, entry };
    };

    const commit = (actorEmail: string) => {
      const { row, entry } = createLog(actorEmail);
      this.auditLogs = [entry, ...this.auditLogs.slice(0, 999)];
      safeWrite('audit_logs', 'insert', row);
    };

    try {
      supabase.auth.getSession().then(({ data }) => {
        commit(data?.session?.user?.email || fallbackActorEmail);
      }).catch(() => commit(fallbackActorEmail));
    } catch {
      commit(fallbackActorEmail);
    }
  }

  /** Settle corporate staff spending totals from orders */
  public getCompanyStaffSpending(companyId: string): Array<{staffId: string; staffName: string; workId?: string; totalSpent: number; orders: Order[]}> {
    const staffList = this.companyStaff.filter(s => s.companyId === companyId);
    const companyOrders = this.orders.filter(o => o.companyId === companyId && (o.paymentStatus === 'paid' || o.status === 'completed'));
    return staffList.map(s => {
      const staffOrders = companyOrders.filter(o => o.companyStaffId === s.id);
      const totalSpent = staffOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      return { staffId: s.id, staffName: s.name, workId: s.workId, totalSpent, orders: staffOrders };
    });
  }
}

export const dataStore = new DataStoreEngine();
