import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(({ title, description, variant = 'default' }: ToastOptions) => {
    const id = String(++toastId);

    // Log toast message (simple implementation)
    const message = description ? `${title}\n${description}` : title;

    if (variant === 'destructive') {
      console.error(`[Toast Error] ${message}`);
    } else {
      console.log(`[Toast] ${message}`);
    }

    return { id };
  }, []);

  const dismiss = useCallback((id?: string) => {
    setToasts((prev) => (id ? prev.filter((t) => t.id !== id) : []));
  }, []);

  return { toast, toasts, dismiss };
}
