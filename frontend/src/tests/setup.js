import { vi } from 'vitest';

// Mock localStorage with in-memory persistence for component tests
const localStorageData = new Map();
global.localStorage = {
  getItem: vi.fn((key) => localStorageData.has(key) ? localStorageData.get(key) : null),
  setItem: vi.fn((key, value) => localStorageData.set(key, String(value))),
  removeItem: vi.fn((key) => localStorageData.delete(key)),
  clear: vi.fn(() => localStorageData.clear()),
};

// Mock window.alert
global.alert = vi.fn();

// Mock window.prompt
global.prompt = vi.fn();

