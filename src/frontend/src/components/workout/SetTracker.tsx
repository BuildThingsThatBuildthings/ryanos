import React, { useState, useEffect } from 'react';
import { Plus, Minus, Clock, Check, Edit3, Trash2 } from 'lucide-react';
import { WorkoutSet, Exercise } from '../../types';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';

interface SetTrackerProps {
  set: WorkoutSet;
  exercise?: Exercise;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  onComplete: () => void;
  isEditing?: boolean;
  onEditToggle: () => void;
  autoStartRestTimer?: boolean;
  restTimerDuration?: number;
  onRestTimerStart?: (duration: number) => void;
}

export const SetTracker: React.FC<SetTrackerProps> = ({
  set,
  exercise,
  onUpdate,
  onDelete,
  onComplete,
  isEditing = false,
  onEditToggle,
  autoStartRestTimer = true,
  restTimerDuration = 90,
  onRestTimerStart,
}) => {
  const [localSet, setLocalSet] = useState(set);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalSet(set);
    setHasChanges(false);
  }, [set]);

  const handleFieldChange = (field: keyof WorkoutSet, value: any) => {
    const updatedSet = { ...localSet, [field]: value };
    setLocalSet(updatedSet);
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdate(localSet);
    setHasChanges(false);
    onEditToggle();
  };

  const handleCancel = () => {
    setLocalSet(set);
    setHasChanges(false);
    onEditToggle();
  };

  const handleComplete = () => {
    if (hasChanges) {
      onUpdate(localSet);
    }
    onComplete();
    
    // Start rest timer if enabled and not already completed
    if (autoStartRestTimer && !set.completed && onRestTimerStart) {
      onRestTimerStart(restTimerDuration);
    }
  };

  const incrementValue = (field: 'reps' | 'weight', step = 1) => {
    const currentValue = localSet[field] || 0;
    handleFieldChange(field, Math.max(0, currentValue + step));
  };

  const decrementValue = (field: 'reps' | 'weight', step = 1) => {
    const currentValue = localSet[field] || 0;
    handleFieldChange(field, Math.max(0, currentValue - step));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={cn(
      'transition-all duration-200',
      set.completed && 'bg-success-50 dark:bg-success-900/20 border-success-200',
      isEditing && 'ring-2 ring-primary-500 ring-offset-2'
    )}>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Set {set.setNumber}
            </span>
            {set.completed && (
              <Check className="h-4 w-4 text-success-600" />
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Edit3}
              onClick={onEditToggle}
              className={cn(isEditing && 'bg-primary-100 text-primary-700')}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={onDelete}
              className="text-error-600 hover:text-error-700"
            />
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            {/* Weight Input */}
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Weight</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Minus}
                  onClick={() => decrementValue('weight', 2.5)}
                  className="h-8 w-8 p-0"
                />
                <Input
                  type="number"
                  value={localSet.weight || ''}
                  onChange={(e) => handleFieldChange('weight', parseFloat(e.target.value) || 0)}
                  className="text-center h-8"
                  placeholder="0"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  onClick={() => incrementValue('weight', 2.5)}
                  className="h-8 w-8 p-0"
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">kg</span>
            </div>

            {/* Reps Input */}
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Reps</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Minus}
                  onClick={() => decrementValue('reps')}
                  className="h-8 w-8 p-0"
                />
                <Input
                  type="number"
                  value={localSet.reps || ''}
                  onChange={(e) => handleFieldChange('reps', parseInt(e.target.value) || 0)}
                  className="text-center h-8"
                  placeholder="0"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  onClick={() => incrementValue('reps')}
                  className="h-8 w-8 p-0"
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">reps</span>
            </div>

            {/* Time Input (for time-based exercises) */}
            {exercise?.category === 'cardio' && (
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Time</span>
                <Input
                  type="number"
                  value={localSet.time || ''}
                  onChange={(e) => handleFieldChange('time', parseInt(e.target.value) || 0)}
                  className="text-center h-8"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">sec</span>
              </div>
            )}

            {/* RPE Input */}
            <div className="grid grid-cols-3 gap-2 items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">RPE</span>
              <Input
                type="number"
                min="1"
                max="10"
                value={localSet.rpe || ''}
                onChange={(e) => handleFieldChange('rpe', parseInt(e.target.value) || 0)}
                className="text-center h-8"
                placeholder="1-10"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">/10</span>
            </div>

            {/* Notes */}
            <div>
              <Input
                placeholder="Notes (optional)"
                value={localSet.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                className="h-8"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges}
                fullWidth
              >
                Save
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancel}
                fullWidth
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Display Values */}
            <div className="grid grid-cols-2 gap-4">
              {localSet.weight && (
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {localSet.weight}kg
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Weight</div>
                </div>
              )}
              
              {localSet.reps && (
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {localSet.reps}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Reps</div>
                </div>
              )}
              
              {localSet.time && (
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {formatTime(localSet.time)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Time</div>
                </div>
              )}
              
              {localSet.rpe && (
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {localSet.rpe}/10
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">RPE</div>
                </div>
              )}
            </div>

            {/* Volume Calculation */}
            {localSet.weight && localSet.reps && (
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Volume: {(localSet.weight * localSet.reps).toLocaleString()}kg
                </div>
              </div>
            )}

            {/* Notes */}
            {localSet.notes && (
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</div>
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {localSet.notes}
                </div>
              </div>
            )}

            {/* Complete Button */}
            {!set.completed && (
              <Button
                variant="success"
                icon={Check}
                onClick={handleComplete}
                fullWidth
                className="mt-3"
              >
                Complete Set
              </Button>
            )}

            {/* Rest Timer Info */}
            {set.completed && autoStartRestTimer && (
              <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="h-3 w-3" />
                <span>Rest timer: {restTimerDuration}s</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};