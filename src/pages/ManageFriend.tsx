import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  Bell,
  CheckCircle2,
  Edit3,
  FileText,
  MessageCircle,
  Paperclip,
  Phone,
  Receipt,
  RotateCcw,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';
import type { PaymentMethod } from '../types';
import {
  archiveFriend,
  calculateFriendBalance,
  clearAllDues,
  clearFriendFinancialData,
  deleteFriendProfile,
  friendHasFinancialHistory,
  getFriend,
  onDBChange,
  restoreFriend,
} from '../lib/db';
import { formatCurrency, todayDate } from '../lib/utils';
import { SettingsPage, SettingsRow, SettingsSection } from '../components/SettingsUI';
import { FriendForm } from '../components/AddFriendForm';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/ToastContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';

const PAYMENT_METHODS: PaymentMethod[] = ['UPI', 'Cash', 'Bank Transfer', 'Card', 'Other'];

export function ManageFriend() {
  const { id } = useParams();
  const [, setTick] = useState(0);
  const [clearDuesOpen, setClearDuesOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => onDBChange(() => setTick((value) => value + 1)), []);
  if (!id) return null;
  const friend = getFriend(id);
  if (!friend) return <EmptyState icon={User} title="Friend not found" />;
  const friendId = id;
  const friendName = friend.name;

  const balance = calculateFriendBalance(friendId);
  const hasHistory = friendHasFinancialHistory(friendId);

  function archive() {
    archiveFriend(friendId);
    setArchiveOpen(false);
    toast(`${friendName} archived`);
    navigate('/friends');
  }

  function restore() {
    restoreFriend(friendId);
    toast(`${friendName} restored`);
  }

  function deleteWithoutHistory() {
    if (deleteFriendProfile(friendId) !== 'deleted') return;
    toast(`${friendName} deleted`);
    navigate('/friends');
  }

  return (
    <SettingsPage title="Manage Friend" description="Update contact details, settle the balance, or control how this friend’s data is stored.">
      <Card className="mb-7 rounded-2xl py-4">
        <CardContent className="flex items-center gap-4 px-4">
          <Avatar name={friend.name} src={friend.avatar_url} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold truncate">{friend.name}</h2>
              {friend.is_archived && <Badge variant="secondary">Archived</Badge>}
            </div>
            <p className="text-sm text-muted-foreground truncate">{friend.nickname || friend.whatsapp_number || 'No nickname or WhatsApp number'}</p>
          </div>
        </CardContent>
      </Card>

      <SettingsSection title="Friend Information">
        <SettingsRow icon={Edit3} title="Edit Profile" description="Photo, name, nickname and notes" to={`/friends/${id}/edit`} />
        <SettingsRow icon={MessageCircle} title="WhatsApp Number" value={friend.whatsapp_number || 'Not added'} to={`/friends/${id}/edit`} />
        <SettingsRow icon={Phone} title="Contact Details" description={friend.email || 'Phone and email'} value={friend.phone || 'Not added'} to={`/friends/${id}/edit`} />
      </SettingsSection>

      <SettingsSection title="Financial">
        <div className="min-h-[72px] px-4 py-3.5 flex items-center gap-4">
          <span className="size-9 rounded-xl flex items-center justify-center bg-secondary text-secondary-foreground"><Wallet size={18} /></span>
          <span className="flex-1">
            <span className="block text-sm text-muted-foreground">Current Pending</span>
            <span className="block text-xl font-bold amount-tabular mt-0.5">{formatCurrency(Math.max(balance.pending, 0))}</span>
          </span>
          <Badge variant={balance.pending > 0 ? 'secondary' : 'default'}>{balance.pending > 0 ? 'Pending' : 'Settled'}</Badge>
        </div>
        <SettingsRow icon={CheckCircle2} title="Clear All Dues" description={balance.pending > 0 ? 'Mark the complete outstanding balance as settled.' : 'There is no outstanding balance.'} onClick={() => setClearDuesOpen(true)} trailing={balance.pending > 0} disabled={balance.pending <= 0} />
        <SettingsRow icon={FileText} title="Export Statement" to={`/statement/${id}`} />
      </SettingsSection>

      <SettingsSection title="Data">
        {friend.is_archived
          ? <SettingsRow icon={RotateCcw} title="Restore Friend" description="Show this friend in expense and repayment selections again." onClick={restore} />
          : <SettingsRow icon={Archive} title="Archive Friend" description="Hide from new expenses while preserving all history." onClick={() => setArchiveOpen(true)} />}
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <SettingsRow icon={Trash2} title="Clear Friend Data" description="Permanently remove this friend’s financial history from your account." danger onClick={() => navigate(`/friends/${id}/clear-data`)} />
        <SettingsRow icon={User} title="Delete Friend" description="Archive the profile or permanently remove it." danger onClick={() => setDeleteOpen(true)} />
      </SettingsSection>

      <ClearDuesDialog friendId={id} friendName={friend.name} pending={balance.pending} open={clearDuesOpen} onOpenChange={setClearDuesOpen} />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia><Archive /></AlertDialogMedia>
            <AlertDialogTitle>Archive {friend.name}?</AlertDialogTitle>
            <AlertDialogDescription>All transactions, statements, repayments, and historical balances will be preserved. This friend will be hidden from new expense selections until restored.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={archive}>Archive Friend</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="text-destructive"><AlertTriangle /></AlertDialogMedia>
            <AlertDialogTitle>{hasHistory ? `${friend.name} has financial history` : `Delete ${friend.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {hasHistory
                ? 'For safety, this profile cannot be deleted while history exists. Archiving is recommended and keeps every record available.'
                : 'This removes the friend profile. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={hasHistory ? 'sm:flex-col' : undefined}>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {hasHistory ? <>
              <Button variant="destructive" onClick={() => navigate(`/friends/${id}/clear-data?delete=1`)}>Clear Data &amp; Delete</Button>
              <AlertDialogAction onClick={archive}>Archive Friend</AlertDialogAction>
            </> : <AlertDialogAction variant="destructive" onClick={deleteWithoutHistory}>Delete Friend</AlertDialogAction>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPage>
  );
}

function ClearDuesDialog({
  friendId,
  friendName,
  pending,
  open,
  onOpenChange,
}: {
  friendId: string;
  friendName: string;
  pending: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [date, setDate] = useState(todayDate());
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [notes, setNotes] = useState('');
  const toast = useToast();

  function clear() {
    const settlement = clearAllDues({
      friend_id: friendId,
      settlement_date: date,
      payment_method: method || undefined,
      notes: notes.trim() || undefined,
    });
    if (!settlement) return;
    onOpenChange(false);
    setMethod('');
    setNotes('');
    toast(`All dues cleared for ${friendName}`);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="rounded-2xl">
      <DialogHeader>
        <DialogTitle>Clear {formatCurrency(pending)} pending for {friendName}?</DialogTitle>
        <DialogDescription>This creates a settlement payment for the complete outstanding amount. Old expenses and repayments stay in history.</DialogDescription>
      </DialogHeader>
      <div className="rounded-xl bg-secondary p-4">
        <p className="text-xs text-muted-foreground">Current Pending</p>
        <p className="text-2xl font-bold amount-tabular mt-1">{formatCurrency(pending)}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="settlement-date">Settlement Date</Label>
        <Input id="settlement-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 rounded-xl" />
      </div>
      <div className="grid gap-2">
        <Label>Payment Method <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Select value={method || 'none'} onValueChange={(value) => setMethod(value === 'none' ? '' : value as PaymentMethod)}>
          <SelectTrigger className="min-h-11 w-full rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not specified</SelectItem>
            {PAYMENT_METHODS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="settlement-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea id="settlement-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Paid externally" className="rounded-xl" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={clear}>Clear Dues</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function EditFriend() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  if (!id) return null;
  const friend = getFriend(id);
  if (!friend) return <EmptyState icon={User} title="Friend not found" />;

  return <SettingsPage title="Edit Friend" description="Profile changes update this friend’s contact card only. Previous transactions are never changed.">
    <FriendForm friend={friend} onSaved={(saved) => {
      toast(`${saved.name} updated`);
      navigate(`/friends/${saved.id}/manage`);
    }} />
  </SettingsPage>;
}

export function ClearFriendData() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [confirmation, setConfirmation] = useState('');
  const navigate = useNavigate();
  const toast = useToast();
  const deleteAfterClear = params.get('delete') === '1';
  if (!id) return null;
  const friend = getFriend(id);
  if (!friend) return <EmptyState icon={User} title="Friend not found" />;
  const friendId = id;
  const friendName = friend.name;

  function clear() {
    if (confirmation !== 'CLEAR') return;
    if (deleteAfterClear) {
      deleteFriendProfile(friendId, { clearFinancialData: true });
      toast(`${friendName} and all linked financial data deleted`);
      navigate('/friends');
      return;
    }
    clearFriendFinancialData(friendId);
    toast(`Financial data cleared for ${friendName}`);
    navigate(`/friends/${friendId}/manage`);
  }

  const removedItems = [
    [Receipt, 'Expenses linked to this friend'],
    [Wallet, 'Repayments and settlement history'],
    [FileText, 'Statements generated from this history'],
    [Bell, 'Reminders linked to these transactions'],
    [Paperclip, 'Attachments related only to those transactions'],
  ] as const;

  return <SettingsPage title={deleteAfterClear ? 'Clear Data & Delete' : 'Clear Friend Data'}>
    <Card className="rounded-2xl border-destructive/40 py-0 overflow-hidden">
      <CardContent className="p-5">
        <span className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4"><AlertTriangle /></span>
        <h2 className="text-lg font-bold">This action cannot be undone.</h2>
        <p className="text-sm leading-6 text-muted-foreground mt-2">
          {deleteAfterClear
            ? `This permanently removes ${friend.name}’s financial history and then deletes the friend profile.`
            : `This permanently removes ${friend.name}’s financial history. The friend profile itself will remain.`}
        </p>
        <div className="mt-5 space-y-3">
          {removedItems.map(([Icon, label]) => <div key={label} className="flex items-center gap-3 text-sm"><Icon className="size-4 text-destructive shrink-0" /><span>{label}</span></div>)}
        </div>
      </CardContent>
      <div className="border-t border-destructive/30 bg-destructive/5 p-5">
        <Label htmlFor="clear-confirmation">Type <strong>CLEAR</strong> to continue</Label>
        <Input id="clear-confirmation" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="CLEAR" className="min-h-12 rounded-xl mt-2" />
        <Button variant="destructive" disabled={confirmation !== 'CLEAR'} onClick={clear} className="min-h-12 w-full rounded-xl mt-4">
          <Trash2 /> {deleteAfterClear ? 'Clear Data & Delete' : 'Clear Data Permanently'}
        </Button>
      </div>
    </Card>
  </SettingsPage>;
}
