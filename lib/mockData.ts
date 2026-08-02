export interface Product {
  id: string;
  name: string;
  price: number; // in UGX
  category: 'pizza' | 'burger' | 'sushi' | 'drinks' | 'dessert' | 'local' | 'mains' | 'appetizers';
  image: string;
  available: boolean;
  requiresKitchen?: boolean; // false for canned drinks, water, etc.
  branchId?: string;
  branchName?: string;
  recipe?: { ingredientId: string; quantity: number }[];
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
  password?: string;
  pin?: string;
  phone?: string;
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
}

export interface CompanyStaff {
  id: string;
  companyId: string;
  name: string; // Required
  workId?: string; // Optional Work ID
  email?: string;
  department?: string;
  creditLimitUGX?: number;
  status: 'active' | 'inactive';
}

export interface PlaceZone {
  id: string;
  name: string;
  icon: string;
  description: string;
  branchId?: string;
  branchName?: string;
  tables: { tableNumber: string; seatsCount: number; shape?: 'round' | 'rectangle' }[];
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
  note?: string;
}

export interface OrderItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
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
}

export interface AuditLog {
  id: string;
  userEmail: string;
  action: string;
  details: Record<string, any>;
  ipAddress: string;
  timestamp: number;
}

export const formatUGX = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(amount).replace('UGX', 'UGX ');
};

export const MOCK_PRODUCTS: Product[] = [];

export const MOCK_BRANCHES: Branch[] = [];

export const MOCK_STAFF: StaffMember[] = [
  {
    id: 'cd91de98-cfc5-4246-a44a-fc09af98a23d',
    name: 'Nassar Walusansa (Super Admin)',
    email: 'admin@krown.ug',
    pin: '1234',
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

export const MOCK_ZONES: PlaceZone[] = [];

export const MOCK_EXPENSES: Expense[] = [];

