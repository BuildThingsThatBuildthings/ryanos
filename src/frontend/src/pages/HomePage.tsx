import React, { useEffect, useState } from 'react';
import { format, isToday, isYesterday, addDays } from 'date-fns';
import { Play, TrendingUp, Calendar, Target, Award, Plus } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { WorkoutCard } from '../components/workout/WorkoutCard';
import { VoiceButton } from '../components/voice/VoiceButton';
import { useWorkoutStore } from '../stores/workoutStore';
import { useAuthStore } from '../stores/authStore';
import { WorkoutStatus } from '../types';
import { WorkoutRealtimeStatus } from '../components/workout/WorkoutRealtimeStatus';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { cn } from '../utils/cn';

export const HomePage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    workouts,
    activeWorkout,
    fetchWorkouts,
    startWorkout,
    isLoading,
    fetchExercises,
  } = useWorkoutStore();

  const [todaysWorkout, setTodaysWorkout] = useState(null);
  const [yesterdaysWorkout, setYesterdaysWorkout] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState({
    workoutsCompleted: 0,
    totalVolume: 0,
    totalTime: 0,
    streak: 0,
  });

  useEffect(() => {
    if (user) {
      fetchWorkouts();
      fetchExercises();
    }
  }, [fetchWorkouts, fetchExercises, user]);

  useEffect(() => {
    if (workouts.length > 0) {
      // Find today's workout
      const today = workouts.find(w => 
        isToday(new Date(w.date)) && w.status !== WorkoutStatus.CANCELLED
      );
      setTodaysWorkout(today);

      // Find yesterday's workout
      const yesterday = workouts.find(w => 
        isYesterday(new Date(w.date)) && w.status === WorkoutStatus.COMPLETED
      );
      setYesterdaysWorkout(yesterday);

      // Calculate weekly stats
      const oneWeekAgo = addDays(new Date(), -7);
      const weeklyWorkouts = workouts.filter(w => 
        new Date(w.date) >= oneWeekAgo && w.status === WorkoutStatus.COMPLETED
      );

      const stats = weeklyWorkouts.reduce((acc, workout) => {
        const volume = workout.sets.reduce((sum, set) => 
          sum + (set.weight || 0) * (set.reps || 0), 0
        );
        const duration = workout.startTime && workout.endTime 
          ? Math.floor((new Date(workout.endTime).getTime() - new Date(workout.startTime).getTime()) / 1000 / 60)
          : 0;

        return {
          workoutsCompleted: acc.workoutsCompleted + 1,
          totalVolume: acc.totalVolume + volume,
          totalTime: acc.totalTime + duration,
          streak: acc.streak, // This would need more complex logic
        };
      }, { workoutsCompleted: 0, totalVolume: 0, totalTime: 0, streak: 3 });

      setWeeklyStats(stats);
    }
  }, [workouts]);

  const handleStartWorkout = async (workoutId: string) => {
    try {
      await startWorkout(workoutId);
      // Navigate to workout view would happen here
    } catch (error) {
      console.error('Failed to start workout:', error);
    }
  };

  const quickStats = [
    {
      label: 'Weekly Workouts',
      value: weeklyStats.workoutsCompleted,
      icon: Calendar,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    {
      label: 'Volume (kg)',
      value: weeklyStats.totalVolume.toLocaleString(),
      icon: TrendingUp,
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
    {
      label: 'Time (min)',
      value: weeklyStats.totalTime,
      icon: Target,
      color: 'text-warning-600',
      bgColor: 'bg-warning-50',
    },
    {
      label: 'Streak',
      value: `${weeklyStats.streak} days`,
      icon: Award,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="p-4 space-y-6">
        {/* Real-time Status */}
        <div className="flex justify-end mb-4">
          <WorkoutRealtimeStatus />
        </div>

        {/* Welcome Section */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Ready to crush your fitness goals today?
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          {quickStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="text-center">
                <CardContent>
                  <div className={cn('inline-flex p-2 rounded-lg mb-2', stat.bgColor)}>
                    <Icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {stat.value}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Active Workout */}
        {activeWorkout && (
          <Card className="border-primary-200 bg-primary-50 dark:bg-primary-900/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-primary-600 rounded-full animate-pulse" />
                <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                  Workout in Progress
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <WorkoutCard
                workout={activeWorkout}
                onView={() => {/* Navigate to active workout */}}
                className="bg-white dark:bg-gray-800"
              />
            </CardContent>
          </Card>
        )}

        {/* Today's Workout */}
        {!activeWorkout && (
          <Card>
            <CardHeader
              title="Today's Workout"
              subtitle={format(new Date(), 'EEEE, MMMM d')}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  onClick={() => {/* Navigate to add workout */}}
                >
                  Add
                </Button>
              }
            />
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : todaysWorkout ? (
                <WorkoutCard
                  workout={todaysWorkout}
                  onStart={() => handleStartWorkout(todaysWorkout.id)}
                  onView={() => {/* Navigate to workout details */}}
                />
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No workout planned for today
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Create a new workout or use voice logging to get started
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="primary"
                      icon={Plus}
                      onClick={() => {/* Navigate to add workout */}}
                    >
                      Plan Workout
                    </Button>
                    <VoiceButton size="md" showStatus={false} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Yesterday's Summary */}
        {yesterdaysWorkout && (
          <Card>
            <CardHeader
              title="Yesterday's Workout"
              subtitle="Great job completing your session!"
            />
            <CardContent>
              <WorkoutCard
                workout={yesterdaysWorkout}
                onView={() => {/* Navigate to workout details */}}
                showDetails={false}
              />
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader title="Quick Actions" />
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => {/* Navigate to add workout */}}
                fullWidth
              >
                New Workout
              </Button>
              <Button
                variant="secondary"
                icon={Target}
                onClick={() => {/* Navigate to goals */}}
                fullWidth
              >
                View Goals
              </Button>
            </div>
            
            <div className="mt-4 flex justify-center">
              <VoiceButton 
                size="lg" 
                onTranscript={(transcript) => {
                  console.log('Voice input:', transcript);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Progress Overview */}
        <Card>
          <CardHeader
            title="This Week's Progress"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {/* Navigate to detailed progress */}}
              >
                View All
              </Button>
            }
          />
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Workout Goal</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {weeklyStats.workoutsCompleted}/5
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(weeklyStats.workoutsCompleted / 5) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Days Active</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {weeklyStats.workoutsCompleted}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Time</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {Math.round(weeklyStats.totalTime / 60)}h
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Volume</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {Math.round(weeklyStats.totalVolume / 1000)}k
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};