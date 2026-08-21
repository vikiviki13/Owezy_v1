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

export type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'EUR' | 'AED' | 'SGD';
export type NumberFormat = 'indian' | 'international';
export type DecimalDisplay = 'automatic' | '0' | '2';
export type DateFormat = 'DD MMM YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD MMM YY';
export type TimeFormat = '12h' | '24h';
export type WeekStartsOn = 'automatic' | 'monday' | 'sunday';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface UserPreferences {
  id: UUID;
  user_id: UUID;
  currency_code: CurrencyCode;
  number_format: NumberFormat;
  decimal_display: DecimalDisplay;
  date_format: DateFormat;
  time_format: TimeFormat;
  week_starts_on: WeekStartsOn;
  timezone: string;
  timezone_mode: 'automatic' | 'manual';
  language: 'en';
  theme: ThemePreference;
  notifications_enabled: boolean;
  payment_reminders_enabled: boolean;
  pending_balance_reminders_enabled: boolean;
  app_updates_enabled: boolean;
  default_reminder_days: number;
  default_reminder_time: string;
  app_lock_enabled: boolean;
  auto_lock_duration: 'immediately' | '1m' | '5m' | '15m' | '30m';
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
  phone_number?: string;
  whatsapp_e164?: string;
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
export type ExpensePayerType = 'me' | 'friend' | 'multiple';
export type ExpenseType = 'personal' | 'for_friend' | 'paid_by_friend';

export interface ExpensePaymentContribution {
  id: UUID;
  payer_id: UUID; // use owner_id sentinel 'owner' for the current user
  amount: number;
  payment_method?: PaymentMethod;
}

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
  expense_type?: ExpenseType;
  payer_type?: ExpensePayerType;
  payer_friend_id?: UUID;
  payment_contributions?: ExpensePaymentContribution[];
  expense_date: string; // YYYY-MM-DD
  expense_time: string; // HH:mm
  occurred_at?: string; // UTC timestamp for the actual transaction moment
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
  direction?: 'from_friend' | 'to_friend';
  payment_method: PaymentMethod;
  transaction_reference?: string;
  repayment_date: string;
  repayment_time: string;
  occurred_at?: string; // UTC timestamp for the actual repayment moment
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
  theyOweMe: number;
  iOweThem: number;
  netBalance: number;
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
