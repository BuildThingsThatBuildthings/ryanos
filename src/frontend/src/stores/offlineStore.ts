import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SyncQueueItem } from '../types';
import { supabase, handleSupabaseError } from '../lib/supabase';

interface OfflineState {
  isOnline: boolean;
  syncQueue: SyncQueueItem[];
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncError: string | null;
  hasOfflineChanges: boolean;
}

interface OfflineActions {
  setOnlineStatus: (isOnline: boolean) => void;
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeFromSyncQueue: (id: string) => void;
  syncData: () => Promise<void>;
  clearSyncQueue: () => void;
  retryFailedSync: (itemId: string) => Promise<void>;
  clearSyncError: () => void;
  markOfflineChange: () => void;
  clearOfflineChanges: () => void;
}

const MAX_RETRY_COUNT = 3;
const SYNC_RETRY_DELAY = 1000; // 1 second

export const useOfflineStore = create<OfflineState & OfflineActions>()(
  persist(
    (set, get) => ({
      // State
      isOnline: navigator.onLine,
      syncQueue: [],
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,
      hasOfflineChanges: false,

      // Actions
      setOnlineStatus: (isOnline: boolean) => {
        set({ isOnline });
        
        // Auto-sync when coming back online
        if (isOnline && get().syncQueue.length > 0) {
          setTimeout(() => {
            get().syncData();
          }, 1000); // Wait 1 second to ensure connection is stable
        }
      },

      addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>) => {
        const newItem: SyncQueueItem = {
          ...item,
          id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        };

        set((state) => ({
          syncQueue: [...state.syncQueue, newItem],
          hasOfflineChanges: true,
        }));

        // Try to sync immediately if online
        if (get().isOnline) {
          get().syncData();
        }
      },

      removeFromSyncQueue: (id: string) => {
        set((state) => ({
          syncQueue: state.syncQueue.filter((item) => item.id !== id),
        }));
      },

      syncData: async () => {
        const { syncQueue, isOnline, isSyncing } = get();
        
        if (!isOnline || isSyncing || syncQueue.length === 0) {
          return;
        }

        set({ isSyncing: true, syncError: null });

        try {
          const itemsToSync = [...syncQueue];
          const failedItems: SyncQueueItem[] = [];

          for (const item of itemsToSync) {
            try {
              await syncSingleItem(item);
              get().removeFromSyncQueue(item.id);
            } catch (error: any) {
              console.error(`Failed to sync item ${item.id}:`, error);
              
              // Increment retry count
              const updatedItem = {
                ...item,
                retryCount: item.retryCount + 1,
              };

              if (updatedItem.retryCount < MAX_RETRY_COUNT) {
                failedItems.push(updatedItem);
              } else {
                // Max retries reached, remove from queue
                console.error(`Max retries reached for item ${item.id}, removing from queue`);
                get().removeFromSyncQueue(item.id);
              }
            }
          }

          // Update failed items with new retry counts
          if (failedItems.length > 0) {
            set((state) => ({
              syncQueue: [
                ...state.syncQueue.filter(
                  (item) => !failedItems.find((fi) => fi.id === item.id)
                ),
                ...failedItems,
              ],
            }));

            // Schedule retry for failed items
            setTimeout(() => {
              if (get().isOnline && failedItems.length > 0) {
                get().syncData();
              }
            }, SYNC_RETRY_DELAY * failedItems[0].retryCount);
          }

          set({
            lastSyncTime: new Date().toISOString(),
            isSyncing: false,
            hasOfflineChanges: get().syncQueue.length > 0,
          });

        } catch (error: any) {
          console.error('Sync failed:', error);
          set({
            syncError: handleSupabaseError(error),
            isSyncing: false,
          });
        }
      },

      clearSyncQueue: () => {
        set({ syncQueue: [], hasOfflineChanges: false });
      },

      retryFailedSync: async (itemId: string) => {
        const { syncQueue } = get();
        const item = syncQueue.find((i) => i.id === itemId);
        
        if (!item || !get().isOnline) return;

        try {
          await syncSingleItem(item);
          get().removeFromSyncQueue(itemId);
        } catch (error: any) {
          console.error(`Retry failed for item ${itemId}:`, error);
          throw error;
        }
      },

      clearSyncError: () => {
        set({ syncError: null });
      },

      markOfflineChange: () => {
        set({ hasOfflineChanges: true });
      },

      clearOfflineChanges: () => {
        set({ hasOfflineChanges: false });
      },
    }),
    {
      name: 'offline-storage',
      partialize: (state) => ({
        syncQueue: state.syncQueue,
        lastSyncTime: state.lastSyncTime,
        hasOfflineChanges: state.hasOfflineChanges,
      }),
    }
  )
);

// Helper function to sync individual items
async function syncSingleItem(item: SyncQueueItem): Promise<void> {
  const { type, action, data } = item;

  switch (type) {
    case 'workout':
      if (action === 'create') {
        const { error } = await supabase
          .from('workouts')
          .insert(data);
        if (error) throw error;
      } else if (action === 'update') {
        const { error } = await supabase
          .from('workouts')
          .update(data.updates)
          .eq('id', data.id);
        if (error) throw error;
      } else if (action === 'delete') {
        const { error } = await supabase
          .from('workouts')
          .delete()
          .eq('id', data.id);
        if (error) throw error;
      }
      break;

    case 'set':
      if (action === 'create') {
        const { error } = await supabase
          .from('workout_sets')
          .insert(data);
        if (error) throw error;
      } else if (action === 'update') {
        const { error } = await supabase
          .from('workout_sets')
          .update(data.updates)
          .eq('id', data.id);
        if (error) throw error;
      } else if (action === 'delete') {
        const { error } = await supabase
          .from('workout_sets')
          .delete()
          .eq('id', data.id);
        if (error) throw error;
      }
      break;

    case 'voice':
      if (action === 'create') {
        const { error } = await supabase
          .from('voice_sessions')
          .insert(data);
        if (error) throw error;
      } else if (action === 'update') {
        const { error } = await supabase
          .from('voice_sessions')
          .update(data.updates)
          .eq('id', data.id);
        if (error) throw error;
      }
      break;

    case 'goal':
      if (action === 'create') {
        const { error } = await supabase
          .from('goals')
          .insert(data);
        if (error) throw error;
      } else if (action === 'update') {
        const { error } = await supabase
          .from('goals')
          .update(data.updates)
          .eq('id', data.id);
        if (error) throw error;
      } else if (action === 'delete') {
        const { error } = await supabase
          .from('goals')
          .delete()
          .eq('id', data.id);
        if (error) throw error;
      }
      break;

    default:
      throw new Error(`Unknown sync item type: ${type}`);
  }
}

// Set up online/offline event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().setOnlineStatus(true);
  });

  window.addEventListener('offline', () => {
    useOfflineStore.getState().setOnlineStatus(false);
  });
}