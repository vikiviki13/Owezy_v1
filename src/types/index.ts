// Domain types — mirrors the Supabase table structure from the spec 1:1,
// so the local data layer (src/lib/db.ts) can be swapped for real Supabase
// calls later without touching any component.

export type UUID = string;

export interface Profile {
  id: UUID;
  full_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  default_currency: string;
  timezone?: string;
  created_at: string;
  updated_at: string;
}

export interface Friend {
  id: UUID;
  owner_id: UUID;
  name: string;
  nickname?: string;
  phone?: string;
  whatsapp_number?: string;
  email?: string;
  avatar_url?: string;
  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: UUID;
  owner_id: UUID;
  name: string;
  description?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: UUID;
  group_id: UUID;
  friend_id: UUID;
  created_at: string;
}

export type ExpenseCategory = 'Food' | 'Travel' | 'Movie' | 'Shopping' | 'Stay' | 'Other';
export type ExpenseStatus = 'pending' | 'partial' | 'settled';
export type SplitMode = 'equal' | 'custom' | 'items' | 'percentage';

export interface Expense {
  id: UUID;
  owner_id: UUID;
  title: string;
  description?: string;
  category: ExpenseCategory;
  merchant_name?: string;
  location_name?: string;
  total_amount: number;
  owner_share: number;
  recoverable_amount: number;
  expense_date: string; // YYYY-MM-DD
  expense_time: string; // HH:mm
  currency: string;
  group_id?: UUID;
  notes?: string;
  attachment_url?: string;
  split_mode: SplitMode;
  status: ExpenseStatus;
  created_at: string;
  updated_at: string;
}

export interface ExpenseParticipant {
  id: UUID;
  expense_id: UUID;
  friend_id: UUID;
  share_amount: number;
  paid_amount: number;
  pending_amount: number;
  status: ExpenseStatus;
  created_at: string;
  updated_at: string;
}

export interface ExpenseItem {
  id: UUID;
  expense_id: UUID;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface ExpenseItemAssignment {
  id: UUID;
  expense_item_id: UUID;
  friend_id: UUID; // use owner_id sentinel 'owner' for the user's own share
  share_amount: number;
}

export type AdjustmentType = 'gst' | 'service_charge' | 'discount' | 'tip' | 'delivery_fee' | 'other';
export type AdjustmentCalcType = 'equal' | 'proportional' | 'custom';

export interface ExpenseAdjustment {
  id: UUID;
  expense_id: UUID;
  adjustment_type: AdjustmentType;
  name: string;
  amount: number;
  calculation_type: AdjustmentCalcType;
}

export type PaymentMethod = 'UPI' | 'Cash' | 'Bank Transfer' | 'Card' | 'Other';

export interface Repayment {
  id: UUID;
  owner_id: UUID;
  friend_id: UUID;
  expense_id?: UUID;
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference?: string;
  repayment_date: string;
  repayment_time: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: UUID;
  owner_id: UUID;
  expense_id: UUID;
  file_url: string;
  file_type: string;
  file_name: string;
  created_at: string;
}

// Derived / view-model types (never persisted — always computed)
export interface FriendBalance {
  friend: Friend;
  totalPaidByYou: number;
  totalRepaid: number;
  pending: number;
  status: ExpenseStatus;
  lastActivityAt?: string;
}

export interface LedgerEntry {
  id: UUID;
  kind: 'expense' | 'repayment';
  date: string;
  time: string;
  title: string;
  amount: number;
  runningBalance: number;
  status?: ExpenseStatus;
  refId: UUID;
}
