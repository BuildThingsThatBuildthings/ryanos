import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Mic, Target, User, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useWorkoutStore } from '../../stores/workoutStore';

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const BottomNavigation: React.FC = () => {
  const location = useLocation();
  const { activeWorkout } = useWorkoutStore();

  const navigationItems: NavigationItem[] = [
    {
      path: '/',
      label: 'Home',
      icon: Home,
    },
    {
      path: '/workouts',
      label: 'Workouts',
      icon: Dumbbell,
      badge: activeWorkout ? 1 : undefined,
    },
    {
      path: '/add-workout',
      label: 'Add',
      icon: Plus,
    },
    {
      path: '/voice',
      label: 'Voice',
      icon: Mic,
    },
    {
      path: '/goals',
      label: 'Goals',
      icon: Target,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-bottom z-40">
      <div className="flex items-center justify-around px-2 py-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-w-[60px] touch-target relative',
                  isActive
                    ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                )
              }
            >
              <div className="relative">
                <Icon className="h-6 w-6" />
                {item.badge && (
                  <span className="absolute -top-2 -right-2 h-4 w-4 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium mt-1 leading-none">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};