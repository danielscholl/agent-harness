/**
 * Jest setup file for test environment configuration.
 *
 * Handles cleanup of ink-testing-library renders to prevent
 * open handles from animated components like Spinner.
 */

import { afterAll } from '@jest/globals';

// Global cleanup after all tests complete
afterAll(() => {
  // Give React time to clean up effects
  return new Promise((resolve) => setTimeout(resolve, 100));
});
