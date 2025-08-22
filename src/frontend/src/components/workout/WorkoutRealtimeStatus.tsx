import React, { useEffect, useState } from 'react';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useOfflineStore } from '../../stores/offlineStore';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

export const WorkoutRealtimeStatus: React.FC = () => {
  const { subscription } = useWorkoutStore();
  const { isOnline, isSyncing, hasOfflineChanges, syncError } = useOfflineStore();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  useEffect(() => {
    if (subscription) {
      // Monitor subscription status
      subscription.on('system', {}, (payload) => {
        if (payload.status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (payload.status === 'CHANNEL_ERROR') {
          setConnectionStatus('error');
        }
      });
    } else {
      setConnectionStatus('disconnected');
    }
  }, [subscription]);

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
    
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    
    if (syncError) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    
    if (connectionStatus === 'connected') {
      return <Wifi className="h-4 w-4 text-green-500" />;
    }
    
    return <Wifi className="h-4 w-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (syncError) return 'Sync Error';
    if (hasOfflineChanges) return 'Pending Sync';
    if (connectionStatus === 'connected') return 'Live';
    return 'Connecting...';
  };

  const getStatusColor = () => {
    if (!isOnline || syncError) return 'text-red-500';
    if (isSyncing || hasOfflineChanges) return 'text-blue-500';
    if (connectionStatus === 'connected') return 'text-green-500';
    return 'text-gray-400';
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      {getStatusIcon()}
      <span className={getStatusColor()}>
        {getStatusText()}
      </span>
    </div>
  );
};