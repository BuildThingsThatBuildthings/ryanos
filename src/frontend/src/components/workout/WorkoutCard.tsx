import React, { useState } from 'react';
import { format } from 'date-fns';
import { Play, Clock, Calendar, ChevronDown, ChevronUp, Target, Zap } from 'lucide-react';
import { Workout, WorkoutStatus } from '../../types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface WorkoutCardProps {
  workout: Workout;
  onStart?: () => void;
  onView?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({
  workout,
  onStart,
  onView,
  showDetails = false,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetails);

  const statusColors = {
    [WorkoutStatus.PLANNED]: 'bg-gray-100 text-gray-800 border-gray-200',
    [WorkoutStatus.IN_PROGRESS]: 'bg-primary-100 text-primary-800 border-primary-200',
    [WorkoutStatus.COMPLETED]: 'bg-success-100 text-success-800 border-success-200',
    [WorkoutStatus.CANCELLED]: 'bg-error-100 text-error-800 border-error-200',
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return null;
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
    
    return `${duration} min`;
  };

  const getWorkoutStats = () => {
    const completedSets = workout.sets.filter(set => set.completed);
    const totalSets = workout.sets.length;
    const totalVolume = workout.sets.reduce((sum, set) => {
      return sum + (set.weight || 0) * (set.reps || 0);
    }, 0);

    return {
      completedSets: completedSets.length,
      totalSets,
      totalVolume,
      completion: totalSets > 0 ? Math.round((completedSets.length / totalSets) * 100) : 0,
    };
  };

  const stats = getWorkoutStats();

  return (
    <Card
      variant="hover"
      className={cn('w-full', className)}
      onClick={onView}
    >
      <CardHeader>
        <div className="flex items-start justify-between w-full">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {workout.name}
              </h3>
              <span className={cn(
                'px-2 py-1 text-xs font-medium rounded-full border',
                statusColors[workout.status]
              )}>
                {workout.status.replace('_', ' ')}
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(workout.date), 'MMM d, yyyy')}</span>
              </div>
              
              {(workout.startTime || workout.endTime) && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(workout.startTime, workout.endTime)}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            {workout.status === WorkoutStatus.PLANNED && onStart && (
              <Button
                size="sm"
                icon={Play}
                onClick={(e) => {
                  e.stopPropagation();
                  onStart();
                }}
              >
                Start
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              icon={isExpanded ? ChevronUp : ChevronDown}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            />
          </div>
        </div>
      </CardHeader>

      {/* Quick Stats */}
      <CardContent padding={false}>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {stats.completedSets}/{stats.totalSets}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Sets</div>
            </div>
            
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {stats.totalVolume.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Volume</div>
            </div>
            
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {stats.completion}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Complete</div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.completion}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>

      {/* Expanded Details */}
      {isExpanded && (
        <CardContent>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            {workout.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {workout.description}
              </p>
            )}
            
            {/* Exercise List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Exercises ({workout.sets.length} sets)
              </h4>
              
              <div className="space-y-1">
                {workout.sets.slice(0, 5).map((set, index) => (
                  <div
                    key={set.id}
                    className="flex items-center justify-between py-1 text-sm"
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      Set {set.setNumber}
                    </span>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500">
                      {set.weight && (
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {set.weight}kg
                        </span>
                      )}
                      {set.reps && (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {set.reps} reps
                        </span>
                      )}
                      {set.completed && (
                        <span className="text-success-600 text-xs">✓</span>
                      )}
                    </div>
                  </div>
                ))}
                
                {workout.sets.length > 5 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
                    +{workout.sets.length - 5} more sets
                  </div>
                )}
              </div>
            </div>
            
            {workout.notes && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </h5>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {workout.notes}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};