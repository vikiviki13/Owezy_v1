import type {
  Attachment, Expense, ExpenseAdjustment, ExpenseItem, ExpenseItemAssignment,
  ExpenseParticipant, Friend, Group, GroupMember, Profile, Repayment, UserPreferences,
} from '../../types';
import type { Tombstone } from '../../services/sync/types';

export type ExportRangePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom';
export type BalanceDirection = 'OWES_ME' | 'I_OWE' | 'SETTLED';

export interface ExportDateRange {
  from: string;
  to: string;
  label: string;
}

export interface ExportSourceData {
  profile: Profile;
  preferences: UserPreferences;
  friends: Friend[];
  groups: Group[];
  groupMembers: GroupMember[];
  expenses: Expense[];
  expenseParticipants: ExpenseParticipant[];
  expenseItems: ExpenseItem[];
  expenseItemAssignments: ExpenseItemAssignment[];
  expenseAdjustments: ExpenseAdjustment[];
  repayments: Repayment[];
  attachments: Attachment[];
  deleted: Tombstone[];
}

export interface FinancialSummary {
  personalSpending: number;
  spentForFriends: number;
  paidByFriendsForMe: number;
  totalPaidByMe: number;
  totalReceived: number;
  friendsOweMe: number;
  iOweFriends: number;
  netBalance: number;
  netDirection: 'NET_RECEIVABLE' | 'NET_PAYABLE' | 'SETTLED';
  expenseCount: number;
  friendCount: number;
  repaymentCount: number;
  currency: string;
  dateFrom: string;
  dateTo: string;
}

export interface FriendReport {
  friendId: string;
  friendName: string;
  totalExpenses: number;
  myShare: number;
  friendShare: number;
  totalPaidByMe: number;
  totalPaidByFriend: number;
  totalRepaidByFriend: number;
  totalRepaidToFriend: number;
  creditAmount: number;
  amountOwedToMe: number;
  amountIOwe: number;
  netBalance: number;
  balanceDirection: BalanceDirection;
  lastTransactionDate?: string;
  lastRepaymentDate?: string;
  status: 'pending' | 'partial' | 'settled';
}

export interface CategoryReport {
  category: string;
  yourShare: number;
  friendsShare: number;
  total: number;
}

export interface ExpenseReport {
  recordType: 'expense';
  expenseId: string;
  expenseName: string;
  expenseTitle: string;
  category: string;
  friendName: string;
  friendId: string;
  groupName: string;
  totalAmount: number;
  ownerShare: number;
  recoverableAmount: number;
  shareAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentAmount: number;
  paymentDirection: string;
  paymentMethod: string;
  payer: string;
  expenseDate: string;
  expenseTime: string;
  currency: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepaymentReport {
  recordType: 'repayment';
  repaymentId: string;
  friendId: string;
  friendName: string;
  amount: number;
  direction: string;
  paymentMethod: string;
  repaymentDate: string;
  repaymentTime: string;
  transactionReference: string;
  notes: string;
}

export interface ExportBundle {
  schemaVersion: 1;
  exportType: 'report' | 'full_backup' | 'statement' | 'balances';
  app: 'Owezy';
  exportedAt: string;
  range: ExportDateRange;
  currency: string;
  summary: FinancialSummary;
  friends: FriendReport[];
  categories: CategoryReport[];
  expenses: ExpenseReport[];
  repayments: RepaymentReport[];
  source: ExportSourceData;
}
