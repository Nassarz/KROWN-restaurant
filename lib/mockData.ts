export interface ProductAddOn {
  id: string;
  name: string;          // e.g. "Extra Cheese", "Extra Beef Patty"
  priceUGX: number;      // additional price per add-on unit
  category?: string;     // optional grouping, e.g. "Toppings"
}

export interface Product {
  id: string;
  name: string;
  price: number; // in UGX
  category: string;
  image: string;
  available: boolean;
  requiresKitchen?: boolean; // false for canned drinks, water, etc.
  description?: string;
  branchId?: string;
  branchName?: string;
  recipe?: { ingredientId: string; quantity: number }[];
  linkedIngredientId?: string; // Linked inventory item for auto-deduction
  deductFromInventory?: boolean; // If true, selling this product reduces inventory
  inventoryDeductAmount?: number; // How many units to deduct per sale
  addOns?: ProductAddOn[];       // Configurable extras sold with this menu item
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  city?: string;
  manager: string;
  phone: string;
  email?: string;
  taxId?: string;
  address?: string;
  receiptHeaderNote?: string;
  receiptFooterNote?: string;
  tablesCount: number;
  dailyRevenueUGX: number;
  ordersToday: number;
  status: 'online' | 'busy' | 'maintenance';
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  pinCode?: string; // 4-digit PIN lock code
  idType?: 'National ID' | 'Passport' | 'Student ID';
  idNumber?: string;
  role: 'Super Admin' | 'Branch Manager' | 'Head Chef' | 'Senior Waiter' | 'Cashier' | 'Kitchen Staff';
  branch: string;
  assignedBranchId?: string;
  status: 'active' | 'on_shift' | 'off_shift' | 'on_leave' | 'paused' | 'banned';
  avatar: string;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  category: string;
  costPerUnitUGX: number;
  supplier: string;
  branchId?: string;
  branchName?: string;
  deductFromSales?: boolean;       // Auto-deduct when linked product sold
  linkedProductId?: string;        // Product that triggers deduction
  deductAmountPerSale?: number;    // Units to deduct per unit sold
}

export interface CompanyProfile {
  id: string;
  name: string;
  taxId: string;
  creditLimitUGX: number;
  currentBalanceUGX: number;
  contactPerson: string;
  phone: string;
  status: 'active' | 'suspended' | 'closed';
  createdAt: number;
  branchId?: string;
  branchName?: string;
}

export interface CompanyStaff {
  id: string;
  companyId: string;
  name: string; // Required
  workId?: string; // Optional Work ID
  email?: string;
  department?: string;
  creditLimitUGX?: number;
  status: 'active' | 'inactive' | 'banned';
  totalSpentUGX?: number;
}

export interface ProductIngredient {
  id: string;
  productId: string;
  ingredientId: string;
  quantityPerUnit: number;
  branchId?: string;
  createdAt?: number;
}

export interface PlaceZone {
  id: string;
  name: string;
  icon: string;
  description: string;
  branchId?: string;
  branchName?: string;
  tables: { tableNumber: string; seatsCount: number; shape?: 'round' | 'rectangle'; seats?: string[]; status?: 'available' | 'occupied' | 'reserved' }[];
}

export interface Expense {
  id: string;
  branchId?: string;
  branchName?: string;
  title: string;
  category: 'Rent & Lease' | 'Utilities & Electricity' | 'Salaries & Wages' | 'Raw Material Stock' | 'Equipment & Repairs' | 'Marketing' | 'General';
  amountUGX: number;
  vatAmountUGX: number;
  receiptUrl?: string;
  notes?: string;
  createdAt: number;
}

export interface SplitPayment {
  id: string;
  amount: number;
  paymentMethod: 'Cash' | 'MTN Mobile Money' | 'Airtel Money' | 'Credit Card' | 'Corporate Credit';
  paidAt: number;
  splitIndex: number;
  totalSplits: number;
  itemsCovered?: string[];
  seatCovered?: string;
  guestLabel?: string;
  guestItems?: { id?: string; name: string; price: number; quantity: number; amount: number }[];
  note?: string;
}

export interface OrderItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
  category?: string;
  image?: string;
  addOns?: { name: string; price: number }[];
}

export interface Order {
  id: string;
  table: string; // e.g. "Table 12"
  place?: string; // e.g. "Garden"
  seat?: string; // e.g. "Seat 2"
  type: 'Dine In' | 'Takeaway' | 'Delivery';
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  paymentStatus?: 'unpaid' | 'partially_paid' | 'paid';
  paidAmount?: number;
  splitPayments?: SplitPayment[];
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'Cash' | 'MTN Mobile Money' | 'Airtel Money' | 'Credit Card' | 'Corporate Credit';
  isCorporateCredit?: boolean;
  companyId?: string;
  companyName?: string;
  companyStaffId?: string;
  companyStaffName?: string;
  workId?: string;
  prepEstimatedMinutes?: number;
  prepStartedAt?: number;
  prepCompletedAt?: number;
  restaurantId: string;
  branchName: string;
  userId: string;
  createdAt: number;
  tinNumber?: string; // Customer TIN for VAT invoices
  notes?: string;
  amountReceived?: number;
  change?: number;
}

export interface AuditLog {
  id: string;
  userEmail: string;
  userId?: string;
  userName?: string;
  role?: string;
  action: string;
  section?: string;
  pcInfo?: string;
  details: Record<string, any>;
  ipAddress?: string;
  timestamp: number;
  branchId?: string;
  branchName?: string;
}

export interface InventoryMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: 'sale_deduction' | 'manual_add' | 'manual_deduct' | 'purchase' | 'waste';
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  orderId?: string;
  productName?: string;
  branchId?: string;
  branchName?: string;
  performedBy?: string;
  createdAt: number;
}

export const formatUGX = (amount: number): string => {
  const formatted = Math.round(amount).toLocaleString('en-UG');
  return `USh ${formatted}`;
};

export const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash', color: 'green' },
  { id: 'MTN Mobile Money', label: 'MTN MoMo', color: 'yellow' },
  { id: 'Airtel Money', label: 'Airtel Money', color: 'red' },
  { id: 'Credit Card', label: 'Card', color: 'blue' },
  { id: 'Corporate Credit', label: 'Corporate Credit', color: 'orange' },
] as const;

export const MOCK_PRODUCTS: Product[] = [];

export const MOCK_BRANCHES: Branch[] = [];

export const MOCK_STAFF: StaffMember[] = [
  {
    id: 'cd91de98-cfc5-4246-a44a-fc09af98a23d',
    name: 'Nassar Walusansa (Super Admin)',
    email: 'admin@krown.ug',
    role: 'Super Admin',
    branch: 'Global HQ',
    assignedBranchId: 'all',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
  }
];

export const MOCK_INGREDIENTS: Ingredient[] = [];

export const MOCK_ORDERS: Order[] = [];

export const MOCK_AUDIT_LOGS: AuditLog[] = [];

export const MOCK_FINANCIAL_SUMMARY = {
  currency: 'UGX',
  grossSalesUGX: 0,
  taxVAT18PercentUGX: 0,
  serviceCharge5PercentUGX: 0,
  netRevenueUGX: 0,
  totalOrders: 0,
  averageOrderValueUGX: 0,
  paymentMethods: [
    { name: 'MTN Mobile Money', amountUGX: 0, percentage: 0 },
    { name: 'Airtel Money', amountUGX: 0, percentage: 0 },
    { name: 'Credit / Debit Card', amountUGX: 0, percentage: 0 },
    { name: 'Cash', amountUGX: 0, percentage: 0 }
  ],
  revenueTrend7Days: []
};

export const MOCK_COMPANIES: CompanyProfile[] = [];

export const MOCK_COMPANY_STAFF: CompanyStaff[] = [];

export const MOCK_ZONES: PlaceZone[] = [
  {
    id: 'zone-1',
    name: 'F&B Section',
    icon: '🌿',
    description: 'Main F&B Dining Area',
    tables: [
      { tableNumber: 'E11', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E12', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E13', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E14', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E15', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E16', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E17', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E18', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E19', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E110', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'E111', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
    ]
  },
  {
    id: 'zone-2',
    name: 'F&B Lower Section',
    icon: '🍃',
    description: 'Lower Terrace Dining Area',
    tables: [
      { tableNumber: 'L1', shape: 'rectangle', seatsCount: 6, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5', 'Seat 6'] },
      { tableNumber: 'L2', shape: 'rectangle', seatsCount: 6, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5', 'Seat 6'] },
      { tableNumber: 'L3', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
      { tableNumber: 'L4', shape: 'round', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
    ]
  },
  {
    id: 'zone-3',
    name: 'B Section',
    icon: '🍷',
    description: 'Bar & Lounge Dining',
    tables: [
      { tableNumber: 'B1', shape: 'round', seatsCount: 2, seats: ['Seat 1', 'Seat 2'] },
      { tableNumber: 'B2', shape: 'round', seatsCount: 2, seats: ['Seat 1', 'Seat 2'] },
      { tableNumber: 'B3', shape: 'rectangle', seatsCount: 4, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'] },
    ]
  },
  {
    id: 'zone-4',
    name: 'Joiner Section',
    icon: '✨',
    description: 'Large Group Tables',
    tables: [
      { tableNumber: 'J1', shape: 'rectangle', seatsCount: 8, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5', 'Seat 6', 'Seat 7', 'Seat 8'] },
      { tableNumber: 'J2', shape: 'rectangle', seatsCount: 8, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5', 'Seat 6', 'Seat 7', 'Seat 8'] },
    ]
  },
  {
    id: 'zone-5',
    name: 'VIP Lounge',
    icon: '👑',
    description: 'Executive Private Dining',
    tables: [
      { tableNumber: 'VIP-1', shape: 'rectangle', seatsCount: 6, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5', 'Seat 6'] },
      { tableNumber: 'VIP-2', shape: 'rectangle', seatsCount: 6, seats: ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4', 'Seat 5', 'Seat 6'] },
    ]
  }
];

export const MOCK_EXPENSES: Expense[] = [];

export interface PrintJob {
  id: string;
  orderId: string;
  type: 'KITCHEN_TICKET' | 'BILL' | 'CUSTOMER_RECEIPT';
  destination: string;
  printerId?: string;
  payload: string;
  status: 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED';
  attempts: number;
  createdAt: number;
  lastError?: string | null;
  printedAt?: number | null;
}
