import React from 'react';
import { Menu, Bell, Wifi, WifiOff, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../stores/authStore';
import { useOfflineStore } from '../../stores/offlineStore';

interface HeaderProps {
  title?: string;
  showMenu?: boolean;
  showProfile?: boolean;
  showOfflineStatus?: boolean;
  onMenuClick?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showMenu = true,
  showProfile = true,
  showOfflineStatus = true,
  onMenuClick,
  className,
}) => {
  const { user } = useAuthStore();
  const { isOnline, syncQueue } = useOfflineStore();

  return (
    <header className={cn(
      'bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 safe-area-top',
      className
    )}>
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {showMenu && (
            <Button
              variant="ghost"
              size="sm"
              icon={Menu}
              onClick={onMenuClick}
              className="lg:hidden"
            />
          )}
          
          <div>
            {title ? (
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h1>
            ) : (
              <div>
                <h1 className="text-lg font-bold text-gradient">
                  FitTrack
                </h1>
                {user && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Welcome back, {user.name.split(' ')[0]}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Offline Status */}
          {showOfflineStatus && (
            <div className="flex items-center gap-2">
              {!isOnline && (
                <div className="flex items-center gap-1 px-2 py-1 bg-warning-100 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300 rounded-lg">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-xs font-medium">Offline</span>
                </div>
              )}
              
              {syncQueue.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-lg">
                  <span className="text-xs font-medium">
                    {syncQueue.length} pending
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            icon={Bell}
            className="relative"
          >
            {/* Notification badge */}
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary-600 rounded-full"></span>
          </Button>

          {/* Profile */}
          {showProfile && user && (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="h-6 w-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
                {user.name}
              </span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};