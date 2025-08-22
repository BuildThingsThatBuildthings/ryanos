import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter, Calendar } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { WorkoutCard } from '../components/workout/WorkoutCard';
import { Modal, ModalContent, ModalHeader } from '../components/ui/Modal';
import { useWorkoutStore } from '../stores/workoutStore';
import { useAuthStore } from '../stores/authStore';
import { WorkoutStatus } from '../types';
import { WorkoutRealtimeStatus } from '../components/workout/WorkoutRealtimeStatus';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { cn } from '../utils/cn';

export const WorkoutListPage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    workouts,
    activeWorkout,
    fetchWorkouts,
    startWorkout,
    isLoading,
  } = useWorkoutStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkoutStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');

  useEffect(() => {
    if (user) {
      fetchWorkouts();
    }
  }, [fetchWorkouts, user]);

  const filteredWorkouts = workouts
    .filter(workout => {
      // Search filter
      if (searchQuery && !workout.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (statusFilter !== 'all' && workout.status !== statusFilter) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

  const handleStartWorkout = async (workoutId: string) => {
    try {
      await startWorkout(workoutId);
    } catch (error) {
      console.error('Failed to start workout:', error);
    }
  };

  const statusOptions = [
    { value: 'all', label: 'All Workouts' },
    { value: WorkoutStatus.PLANNED, label: 'Planned' },
    { value: WorkoutStatus.IN_PROGRESS, label: 'In Progress' },
    { value: WorkoutStatus.COMPLETED, label: 'Completed' },
    { value: WorkoutStatus.CANCELLED, label: 'Cancelled' },
  ];

  const sortOptions = [
    { value: 'date', label: 'Date' },
    { value: 'name', label: 'Name' },
    { value: 'status', label: 'Status' },
  ];

  const getWorkoutStatusCount = (status: WorkoutStatus) => {
    return workouts.filter(w => w.status === status).length;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="p-4 space-y-6">
        {/* Real-time Status */}
        <div className="flex justify-end mb-4">
          <WorkoutRealtimeStatus />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Workouts
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {workouts.length} total workouts
            </p>
          </div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {/* Navigate to add workout */}}
          >
            New
          </Button>
        </div>

        {/* Active Workout Alert */}
        {activeWorkout && (
          <Card className="border-primary-200 bg-primary-50 dark:bg-primary-900/20">
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 bg-primary-600 rounded-full animate-pulse" />
                <div className="flex-1">
                  <h3 className="font-semibold text-primary-900 dark:text-primary-100">
                    Workout in Progress
                  </h3>
                  <p className="text-sm text-primary-700 dark:text-primary-300">
                    {activeWorkout.name} • Tap to continue
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {/* Navigate to active workout */}}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              icon={Search}
              placeholder="Search workouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="secondary"
              icon={Filter}
              onClick={() => setShowFilters(true)}
              className={cn(
                (statusFilter !== 'all' || sortBy !== 'date') && 'bg-primary-100 text-primary-700'
              )}
            >
              Filter
            </Button>
          </div>

          {/* Quick Status Filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {statusOptions.map((option) => {
              const count = option.value === 'all' 
                ? workouts.length 
                : getWorkoutStatusCount(option.value as WorkoutStatus);
              
              return (
                <Button
                  key={option.value}
                  variant={statusFilter === option.value ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStatusFilter(option.value as WorkoutStatus | 'all')}
                  className="whitespace-nowrap"
                >
                  {option.label} ({count})
                </Button>
              );
            })}
          </div>
        </div>

        {/* Workout List */}
        <div className="space-y-4">
          {isLoading && workouts.length === 0 ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent>
                    <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredWorkouts.length > 0 ? (
            filteredWorkouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onStart={() => handleStartWorkout(workout.id)}
                onView={() => {/* Navigate to workout details */}}
                showDetails={false}
              />
            ))
          ) : (
            <Card>
              <CardContent>
                <div className="text-center py-12">
                  <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'No workouts found' 
                      : 'No workouts yet'
                    }
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'Get started by creating your first workout'
                    }
                  </p>
                  {!searchQuery && statusFilter === 'all' && (
                    <Button
                      variant="primary"
                      icon={Plus}
                      onClick={() => {/* Navigate to add workout */}}
                    >
                      Create First Workout
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Load More */}
        {filteredWorkouts.length > 0 && workouts.length > filteredWorkouts.length && (
          <div className="text-center">
            <Button
              variant="secondary"
              onClick={() => {/* Load more workouts */}}
              disabled={isLoading}
            >
              Load More Workouts
            </Button>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filter & Sort"
      >
        <ModalContent>
          <div className="space-y-6">
            {/* Status Filter */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Status
              </h3>
              <div className="space-y-2">
                {statusOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="status"
                      value={option.value}
                      checked={statusFilter === option.value}
                      onChange={(e) => setStatusFilter(e.target.value as WorkoutStatus | 'all')}
                      className="text-primary-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sort By */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Sort By
              </h3>
              <div className="space-y-2">
                {sortOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="sort"
                      value={option.value}
                      checked={sortBy === option.value}
                      onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'status')}
                      className="text-primary-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setStatusFilter('all');
                  setSortBy('date');
                  setSearchQuery('');
                }}
                fullWidth
              >
                Clear All
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowFilters(false)}
                fullWidth
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
};