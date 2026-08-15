import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dateToIso, isoToDate } from '../lib/expenseDraft';
import { todayDate } from '../lib/utils';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function ExpenseCalendar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (date: string) => void;
}) {
  const today = todayDate();
  const [view, setView] = useState(() => {
    const base = isoToDate(selected);
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const firstWeekday = view.getDay();
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const list: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      list.push(dateToIso(new Date(view.getFullYear(), view.getMonth(), day, 12)));
    }
    return list;
  }, [view]);

  const canGoNext = view.getFullYear() < new Date(today + 'T12:00:00').getFullYear()
    || (view.getFullYear() === new Date(today + 'T12:00:00').getFullYear() && view.getMonth() < new Date(today + 'T12:00:00').getMonth());

  function shiftMonth(delta: number) {
    setView((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="size-9 rounded-full grid place-items-center hover:bg-[var(--color-surface-secondary)]"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold">
          {view.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={!canGoNext}
          className="size-9 rounded-full grid place-items-center hover:bg-[var(--color-surface-secondary)] disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-center text-xs font-medium text-[var(--color-text-muted)] py-1">
            {day}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />;
          const disabled = date > today;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(date)}
              className={`aspect-square rounded-full text-sm grid place-items-center transition-colors
                ${isSelected ? 'bg-[var(--color-primary)] text-white font-semibold'
                  : disabled ? 'text-[var(--color-text-muted)] opacity-40'
                  : date === today ? 'text-[var(--color-primary-hover)] font-semibold'
                  : 'hover:bg-[var(--color-surface-secondary)]'}`}
            >
              {date.slice(8)}
            </button>
          );
        })}
      </div>
    </div>
  );
}