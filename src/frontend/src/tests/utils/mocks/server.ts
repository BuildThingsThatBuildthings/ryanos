import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server with request handlers
export const server = setupServer(...handlers);

// Helper to reset handlers
export const resetServer = () => {
  server.resetHandlers();
};

// Helper to use custom handlers for specific tests
export const useCustomHandlers = (...customHandlers: any[]) => {
  server.use(...customHandlers);
};