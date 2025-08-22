import React from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

// Toast component setup
export const ToastProvider: React.FC = () => {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        className: '',
        duration: 4000,
        style: {
          background: 'transparent',
          padding: 0,
          boxShadow: 'none',
        },
      }}
    />
  );
};

interface CustomToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onDismiss: () => void;
}

const CustomToast: React.FC<CustomToastProps> = ({ message, type, onDismiss }) => {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const colors = {
    success: 'bg-success-50 border-success-200 text-success-800',
    error: 'bg-error-50 border-error-200 text-error-800',
    warning: 'bg-warning-50 border-warning-200 text-warning-800',
    info: 'bg-primary-50 border-primary-200 text-primary-800',
  };

  const iconColors = {
    success: 'text-success-600',
    error: 'text-error-600',
    warning: 'text-warning-600',
    info: 'text-primary-600',
  };

  const Icon = icons[type];

  return (
    <div className={cn(
      'flex items-center gap-3 p-4 rounded-lg border shadow-lg max-w-md w-full',
      colors[type]
    )}>
      <Icon className={cn('h-5 w-5 flex-shrink-0', iconColors[type])} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Toast utility functions
export const showToast = {
  success: (message: string) => {
    toast.custom((t) => (
      <CustomToast
        message={message}
        type="success"
        onDismiss={() => toast.dismiss(t.id)}
      />
    ));
  },

  error: (message: string) => {
    toast.custom((t) => (
      <CustomToast
        message={message}
        type="error"
        onDismiss={() => toast.dismiss(t.id)}
      />
    ));
  },

  warning: (message: string) => {
    toast.custom((t) => (
      <CustomToast
        message={message}
        type="warning"
        onDismiss={() => toast.dismiss(t.id)}
      />
    ));
  },

  info: (message: string) => {
    toast.custom((t) => (
      <CustomToast
        message={message}
        type="info"
        onDismiss={() => toast.dismiss(t.id)}
      />
    ));
  },

  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, {
      loading,
      success,
      error,
    });
  },
};