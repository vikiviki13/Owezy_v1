import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../../lib/cn';

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 shadow-sm outline-none transition-[background-color,box-shadow] duration-200 ease-out',
        'data-[state=checked]:bg-[var(--color-primary)] data-[state=unchecked]:bg-[var(--color-border)]',
        'hover:data-[state=checked]:bg-[var(--color-primary-hover)] hover:data-[state=unchecked]:bg-[var(--color-text-muted)]/60',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.28)] ring-0 transition-transform duration-200 ease-out',
          'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
          'motion-reduce:transition-none',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
