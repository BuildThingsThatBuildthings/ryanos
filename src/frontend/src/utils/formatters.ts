import { format, formatDistance, isToday, isYesterday, isThisWeek } from 'date-fns';

// Date formatters
export const formatDate = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isToday(dateObj)) {
    return 'Today';
  }
  
  if (isYesterday(dateObj)) {
    return 'Yesterday';
  }
  
  if (isThisWeek(dateObj)) {
    return format(dateObj, 'EEEE'); // Monday, Tuesday, etc.
  }
  
  return format(dateObj, 'MMM d, yyyy');
};

export const formatTime = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'h:mm a');
};

export const formatDateTime = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return `${formatDate(dateObj)} at ${formatTime(dateObj)}`;
};

export const formatRelativeTime = (date: string | Date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatDistance(dateObj, new Date(), { addSuffix: true });
};

// Duration formatters
export const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  
  return `${secs}s`;
};

export const formatDurationLong = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  
  if (hours > 0) {
    parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  }
  
  if (secs > 0) {
    parts.push(`${secs} second${secs > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
};

// Number formatters
export const formatNumber = (num: number, decimals = 0) => {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatWeight = (weight: number, unit = 'kg') => {
  return `${formatNumber(weight, 1)} ${unit}`;
};

export const formatVolume = (volume: number, unit = 'kg') => {
  if (volume >= 1000) {
    return `${formatNumber(volume / 1000, 1)}k ${unit}`;
  }
  return `${formatNumber(volume)} ${unit}`;
};

export const formatPercentage = (value: number, total: number) => {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
};

// Text formatters
export const truncate = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

export const capitalize = (text: string) => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export const formatEnumValue = (value: string) => {
  return value
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
};

// Exercise formatters
export const formatSet = (reps?: number, weight?: number, time?: number) => {
  const parts = [];
  
  if (weight) {
    parts.push(`${weight}kg`);
  }
  
  if (reps) {
    parts.push(`${reps} reps`);
  }
  
  if (time) {
    parts.push(formatDuration(time));
  }
  
  return parts.join(' × ');
};

export const formatSetSummary = (sets: Array<{ reps?: number; weight?: number; time?: number }>) => {
  const totalSets = sets.length;
  const avgWeight = sets.reduce((sum, set) => sum + (set.weight || 0), 0) / totalSets;
  const totalReps = sets.reduce((sum, set) => sum + (set.reps || 0), 0);
  const totalTime = sets.reduce((sum, set) => sum + (set.time || 0), 0);
  
  const parts = [`${totalSets} sets`];
  
  if (avgWeight > 0) {
    parts.push(`${formatWeight(avgWeight)} avg`);
  }
  
  if (totalReps > 0) {
    parts.push(`${totalReps} total reps`);
  }
  
  if (totalTime > 0) {
    parts.push(formatDuration(totalTime));
  }
  
  return parts.join(' • ');
};

// Validation helpers
export const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string) => {
  return password.length >= 8;
};

// File size formatter
export const formatFileSize = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// Color utilities
export const getContrastColor = (backgroundColor: string) => {
  // Simple contrast calculation
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  return brightness > 128 ? '#000000' : '#ffffff';
};

// Progress calculation
export const calculateProgress = (current: number, target: number) => {
  if (target === 0) return 0;
  return Math.min((current / target) * 100, 100);
};

export const formatProgress = (current: number, target: number) => {
  const percentage = calculateProgress(current, target);
  return `${current}/${target} (${Math.round(percentage)}%)`;
};