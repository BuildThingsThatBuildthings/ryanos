import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

const AllTheProviders = ({ 
  children,
  initialEntries = ['/'],
  queryClient = createTestQueryClient(),
}: {
  children: React.ReactNode;
  initialEntries?: string[];
  queryClient?: QueryClient;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialEntries, queryClient, ...renderOptions } = options;
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders initialEntries={initialEntries} queryClient={queryClient}>
      {children}
    </AllTheProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient };

// Custom matchers and utilities
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

// Mock IntersectionObserver
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = vi.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  });
  window.IntersectionObserver = mockIntersectionObserver;
  return mockIntersectionObserver;
};

// Mock ResizeObserver
export const mockResizeObserver = () => {
  const mockResizeObserver = vi.fn();
  mockResizeObserver.mockReturnValue({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  });
  window.ResizeObserver = mockResizeObserver;
  return mockResizeObserver;
};

// Helper to create mock store
export const createMockStore = (initialState: any = {}) => {
  return {
    getState: vi.fn(() => initialState),
    setState: vi.fn(),
    subscribe: vi.fn(),
    destroy: vi.fn(),
  };
};

// Helper to wait for async state updates
export const waitForAsyncUpdate = () => {
  return new Promise(resolve => setTimeout(resolve, 100));
};

// Custom assertion helpers
export const expectElementToHaveAccessibleName = (
  element: HTMLElement,
  name: string
) => {
  expect(element).toHaveAccessibleName(name);
};

export const expectElementToBeVisible = (element: HTMLElement) => {
  expect(element).toBeVisible();
};

export const expectElementToHaveFocus = (element: HTMLElement) => {
  expect(element).toHaveFocus();
};

// Mock localStorage with better implementation
export const createMockLocalStorage = () => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
};

// Mock IndexedDB
export const createMockIndexedDB = () => {
  let databases: Record<string, any> = {};

  const mockDB = {
    createObjectStore: vi.fn(() => ({
      add: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(() => []),
      clear: vi.fn(),
      createIndex: vi.fn(),
    })),
    deleteObjectStore: vi.fn(),
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => mockDB.createObjectStore()),
      oncomplete: null,
      onerror: null,
    })),
    close: vi.fn(),
    version: 1,
  };

  return {
    open: vi.fn((name: string) => {
      const request = {
        result: mockDB,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: request } as any);
        }
      }, 0);
      
      return request;
    }),
    deleteDatabase: vi.fn(),
    databases,
  };
};

// Performance testing utilities
export const measureRenderTime = async (renderFn: () => void) => {
  const start = performance.now();
  renderFn();
  await waitForLoadingToFinish();
  const end = performance.now();
  return end - start;
};

// Accessibility testing utilities
export const checkAccessibility = async (container: HTMLElement) => {
  // Basic accessibility checks
  const buttons = container.querySelectorAll('button');
  buttons.forEach(button => {
    expect(button).toHaveAttribute('type');
  });

  const inputs = container.querySelectorAll('input');
  inputs.forEach(input => {
    if (input.type !== 'hidden') {
      expect(input).toHaveAccessibleName();
    }
  });

  const links = container.querySelectorAll('a');
  links.forEach(link => {
    if (link.textContent?.trim()) {
      expect(link).toHaveAccessibleName();
    }
  });
};