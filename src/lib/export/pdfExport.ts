import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ExportBundle } from './exportTypes';

function amount(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}`;
}

function friendBalance(bundle: ExportBundle, friend: ExportBundle['friends'][number]) {
  if (friend.amountIOwe > 0) return `You owe ${amount(friend.amountIOwe, bundle.currency)}`;
  if (friend.amountOwedToMe > 0) return `Owes you ${amount(friend.amountOwedToMe, bundle.currency)}`;
  return 'Settled';
}

export async function bundleToPdf(bundle: ExportBundle): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 800;
  const ensure = (height = 18) => { if (y < 50 + height) { page = pdf.addPage([595.28, 841.89]); y = 800; } };
  const text = (value: string, size = 10, strong = false, color = rgb(0.12, 0.14, 0.18)) => {
    ensure(size + 6); page.drawText(value.slice(0, 120), { x: 42, y, size, font: strong ? bold : font, color }); y -= size + 7;
  };
  const section = (value: string) => { y -= 8; text(value, 13, true, rgb(0.08, 0.38, 0.31)); y -= 2; };
  const s = bundle.summary;
  text('OWEZY', 22, true, rgb(0.08, 0.38, 0.31));
  text('Financial Statement', 16, true);
  text(`Date Range: ${bundle.range.from} – ${bundle.range.to}`);
  text(`Currency: ${bundle.currency}`);

  section('YOUR MONEY');
  text(`My Spending  ${amount(s.personalSpending, bundle.currency)}`);
  text(`Spent for Friends  ${amount(s.spentForFriends, bundle.currency)}`);
  text(`Total Paid  ${amount(s.totalPaidByMe, bundle.currency)}`);
  text(`Received Back  ${amount(s.totalReceived, bundle.currency)}`);

  section('CURRENT BALANCE');
  text(`Friends Owe You  ${amount(s.friendsOweMe, bundle.currency)}`);
  text(`You Owe Friends  ${amount(s.iOweFriends, bundle.currency)}`);
  text(`Net Balance  ${amount(Math.abs(s.netBalance), bundle.currency)}`, 12, true);
  text(s.netDirection === 'NET_RECEIVABLE' ? `You are owed ${amount(s.netBalance, bundle.currency)}` : s.netDirection === 'NET_PAYABLE' ? `You owe ${amount(Math.abs(s.netBalance), bundle.currency)}` : 'All settled', 11, true, rgb(0.08, 0.38, 0.31));

  section('FRIENDS');
  bundle.friends.forEach((friend) => {
    text(friend.friendName, 11, true);
    text(`Paid ${amount(friend.totalPaidByMe, bundle.currency)}  |  Repaid ${amount(friend.totalRepaidByFriend, bundle.currency)}  |  ${friendBalance(bundle, friend)}`);
  });

  section('EXPENSES');
  bundle.expenses.forEach((expense) => {
    const value = expense.friendName ? expense.shareAmount : expense.ownerShare;
    text(`${expense.expenseDate}  |  ${expense.expenseName}  |  ${expense.friendName || 'Myself'}  |  ${amount(value, expense.currency)}`);
  });

  section('REPAYMENTS');
  bundle.repayments.forEach((repayment) => text(`${repayment.repaymentDate}  |  ${repayment.friendName}  |  ${amount(repayment.amount, bundle.currency)}  |  ${repayment.paymentMethod}`));
  text(`Generated ${new Date(bundle.exportedAt).toLocaleDateString()}`, 8, false, rgb(0.4, 0.42, 0.45));
  return pdf.save();
}

export async function downloadPdf(filename: string, bundle: ExportBundle) {
  const bytes = await bundleToPdf(bundle);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
