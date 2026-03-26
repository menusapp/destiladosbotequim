import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

const Toaster = () => <SonnerToaster position="top-right" richColors closeButton />;

// Wrapper that silences success toasts to reduce UI clutter
// Keeps: error, warning, info, and bare toast calls
const toast = Object.assign(
  (...args: Parameters<typeof sonnerToast>) => sonnerToast(...args),
  {
    success: ((() => {}) as unknown as typeof sonnerToast.success),
    error: sonnerToast.error,
    warning: sonnerToast.warning,
    info: sonnerToast.info,
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    message: sonnerToast.message,
    dismiss: sonnerToast.dismiss,
  }
);

export { Toaster, toast };
