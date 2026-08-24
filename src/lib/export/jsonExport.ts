import type { ExportBundle } from './exportTypes';

export function bundleToBackup(bundle: ExportBundle) {
  const source = bundle.source;
  return {
    schema_version: 1,
    export_type: 'full_backup',
    app: 'Owezy',
    exported_at: bundle.exportedAt,
    currency: bundle.currency,
    profile: {
      full_name: source.profile.full_name,
      email: source.profile.email,
      phone: source.profile.phone,
      avatar_url: source.profile.avatar_url,
      default_currency: source.profile.default_currency,
      timezone: source.profile.timezone,
    },
    preferences: source.preferences,
    friends: source.friends,
    groups: source.groups,
    group_members: source.groupMembers,
    expenses: source.expenses,
    expense_participants: source.expenseParticipants,
    expense_items: source.expenseItems,
    expense_item_assignments: source.expenseItemAssignments,
    expense_adjustments: source.expenseAdjustments,
    repayments: source.repayments,
    payment_contributions: source.expenses.flatMap((expense) => (expense.payment_contributions || []).map((payment) => ({ expense_id: expense.id, ...payment }))),
    attachments: source.attachments.map((attachment) => ({
      attachment_id: attachment.id,
      expense_id: attachment.expense_id,
      file_name: attachment.file_name,
      mime_type: attachment.file_type,
      created_at: attachment.created_at,
      included: false,
      note: 'Attachment file not included in backup.',
    })),
    financial_summary: {
      personal_spending: bundle.summary.personalSpending,
      spent_for_friends: bundle.summary.spentForFriends,
      paid_by_friends_for_me: bundle.summary.paidByFriendsForMe,
      total_paid_by_me: bundle.summary.totalPaidByMe,
      total_received: bundle.summary.totalReceived,
      friends_owe_me: bundle.summary.friendsOweMe,
      i_owe_friends: bundle.summary.iOweFriends,
      net_balance: bundle.summary.netBalance,
      net_direction: bundle.summary.netDirection,
      currency: bundle.currency,
      date_from: bundle.range.from,
      date_to: bundle.range.to,
      expense_count: bundle.summary.expenseCount,
      friend_count: bundle.summary.friendCount,
      repayment_count: bundle.summary.repaymentCount,
    },
  };
}

export function downloadJson(filename: string, bundle: ExportBundle) {
  const content = JSON.stringify(bundleToBackup(bundle), null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
