import { describe, expect, it } from 'vitest';
import type { Friend } from '../types';
import {
  buildExpenseWhatsAppMessage,
  expenseDateError,
  expenseDateLabel,
  shiftIsoDate,
} from './expenseDraft';

const friend: Friend = {
  id: 'friend-1',
  owner_id: 'owner-1',
  name: 'Arun Kumar',
  nickname: 'Aru',
  whatsapp_number: '+919876543210',
  is_archived: false,
  created_at: '2026-08-01T09:00:00.000Z',
  updated_at: '2026-08-01T09:00:00.000Z',
};

describe('expense date helpers', () => {
  it('labels today, yesterday, and an earlier custom date', () => {
    expect(expenseDateLabel('2026-08-14', '2026-08-14')).toBe('Today, 14 Aug 2026');
    expect(expenseDateLabel('2026-08-13', '2026-08-14')).toBe('Yesterday, 13 Aug 2026');
    expect(expenseDateLabel('2026-08-10', '2026-08-14')).toBe('10 Aug 2026');
  });

  it('shifts calendar dates without UTC timezone drift', () => {
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rejects future and invalid dates', () => {
    expect(expenseDateError('2026-08-15', '2026-08-14')).toBe('Expense date cannot be in the future.');
    expect(expenseDateError('2026-02-30', '2026-08-14')).toBe('Choose a valid expense date.');
    expect(expenseDateError('2026-08-10', '2026-08-14')).toBeUndefined();
  });
});

describe('expense WhatsApp message', () => {
  it('uses the nickname, selected expense date, friend share, and updated balance', () => {
    expect(buildExpenseWhatsAppMessage({
      friend,
      amount: 450,
      reason: 'Dinner',
      expenseDate: '2026-08-10',
      pendingBalance: 1250,
    })).toBe('Hi Aru 👋\n\nI paid ₹450 for Dinner on 10 Aug 2026.\n\nYour pending balance is now ₹1,250.');
  });

  it('falls back to the friend first name when no nickname is saved', () => {
    expect(buildExpenseWhatsAppMessage({
      friend: { ...friend, nickname: undefined },
      amount: 450,
      reason: 'Dinner',
      expenseDate: '2026-08-10',
      pendingBalance: 1250,
    })).toContain('Hi Arun 👋\n');
  });
});