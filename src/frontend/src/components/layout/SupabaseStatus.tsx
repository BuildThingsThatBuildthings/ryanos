import React, { useEffect, useState } from 'react';
import { testSupabaseConnection, validateSupabaseConfig } from '../../utils/supabase-test';
import { AlertCircle, CheckCircle, Wifi, Database } from 'lucide-react';

interface SupabaseStatusProps {
  showDetails?: boolean;
}

export const SupabaseStatus: React.FC<SupabaseStatusProps> = ({ showDetails = false }) => {
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [configStatus, setConfigStatus] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Validate configuration on mount
    const config = validateSupabaseConfig();
    setConfigStatus(config);

    // Test connection if config is valid
    if (config.isValid) {
      setIsChecking(true);
      testSupabaseConnection()
        .then(setConnectionStatus)
        .finally(() => setIsChecking(false));
    }
  }, []);

  const getStatusIcon = () => {
    if (isChecking) {
      return <Wifi className="h-4 w-4 text-blue-500 animate-pulse" />;
    }
    
    if (!configStatus?.isValid) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    
    if (connectionStatus?.connection && connectionStatus?.auth && connectionStatus?.database) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return <Database className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking...';
    if (!configStatus?.isValid) return 'Config Error';
    if (!connectionStatus) return 'Not Tested';
    
    const { connection, auth, database } = connectionStatus;
    if (connection && auth && database) return 'Connected';
    return 'Partial Connection';
  };

  const getStatusColor = () => {
    if (isChecking) return 'text-blue-500';
    if (!configStatus?.isValid || connectionStatus?.errors?.length > 0) return 'text-red-500';
    if (connectionStatus?.connection) return 'text-green-500';
    return 'text-yellow-500';
  };

  if (!showDetails) {
    return (
      <div className="flex items-center space-x-2 text-xs">
        {getStatusIcon()}
        <span className={getStatusColor()}>
          {getStatusText()}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center space-x-2 mb-3">
        {getStatusIcon()}
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          Supabase Status
        </h3>
      </div>

      {/* Configuration Status */}
      <div className="space-y-2 mb-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Configuration</h4>
        {configStatus?.errors.map((error: string, index: number) => (
          <div key={index} className="flex items-center space-x-2 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            <span>{error}</span>
          </div>
        ))}
        {configStatus?.isValid && (
          <div className="flex items-center space-x-2 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            <span>Configuration valid</span>
          </div>
        )}
      </div>

      {/* Connection Status */}
      {connectionStatus && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Services</h4>
          
          {[
            { key: 'connection', label: 'Connection' },
            { key: 'auth', label: 'Authentication' },
            { key: 'database', label: 'Database' },
            { key: 'realtime', label: 'Real-time' },
            { key: 'functions', label: 'Edge Functions' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">{label}</span>
              <div className="flex items-center space-x-1">
                {connectionStatus[key] ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-red-500" />
                )}
                <span className={connectionStatus[key] ? 'text-green-600' : 'text-red-600'}>
                  {connectionStatus[key] ? 'OK' : 'Error'}
                </span>
              </div>
            </div>
          ))}

          {/* Errors */}
          {connectionStatus.errors?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <h5 className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Errors:</h5>
              {connectionStatus.errors.map((error: string, index: number) => (
                <div key={index} className="text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};