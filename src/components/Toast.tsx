import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
}

const ToastCtx = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="fixed bottom-24 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 bg-[#1c1917] text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-lg max-w-sm w-full sm:w-auto animate-sheet-up"
          >
            <CheckCircle2 size={16} className="text-[var(--color-primary)] shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
