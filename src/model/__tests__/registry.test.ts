/**
 * Unit tests for provider registry.
 */

import { describe, it, expect } from '@jest/globals';
import {
  PROVIDER_REGISTRY,
  getProviderFactory,
  isProviderSupported,
  getSupportedProviders,
} from '../registry.js';

describe('Provider Registry', () => {
  describe('PROVIDER_REGISTRY', () => {
    it('has openai provider registered', () => {
      expect(PROVIDER_REGISTRY.openai).toBeDefined();
    });

    it('openai factory is a function', () => {
      expect(typeof PROVIDER_REGISTRY.openai).toBe('function');
    });
  });

  describe('getProviderFactory', () => {
    it('returns factory for supported provider', () => {
      const factory = getProviderFactory('openai');
      expect(factory).toBeDefined();
      expect(typeof factory).toBe('function');
    });

    it('returns undefined for unsupported provider', () => {
      const factory = getProviderFactory('anthropic');
      expect(factory).toBeUndefined();
    });
  });

  describe('isProviderSupported', () => {
    it('returns true for openai', () => {
      expect(isProviderSupported('openai')).toBe(true);
    });

    it('returns false for anthropic (not yet implemented)', () => {
      expect(isProviderSupported('anthropic')).toBe(false);
    });

    it('returns false for gemini (not yet implemented)', () => {
      expect(isProviderSupported('gemini')).toBe(false);
    });

    it('returns false for azure (not yet implemented)', () => {
      expect(isProviderSupported('azure')).toBe(false);
    });

    it('returns false for local (not yet implemented)', () => {
      expect(isProviderSupported('local')).toBe(false);
    });

    it('returns false for foundry (not yet implemented)', () => {
      expect(isProviderSupported('foundry')).toBe(false);
    });

    it('returns false for github (not yet implemented)', () => {
      expect(isProviderSupported('github')).toBe(false);
    });
  });

  describe('getSupportedProviders', () => {
    it('returns array of supported provider names', () => {
      const providers = getSupportedProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers).toContain('openai');
    });

    it('only includes registered providers', () => {
      const providers = getSupportedProviders();
      expect(providers).not.toContain('anthropic');
      expect(providers).not.toContain('gemini');
      expect(providers).not.toContain('azure');
      expect(providers).not.toContain('local');
    });

    it('returns at least one provider', () => {
      const providers = getSupportedProviders();
      expect(providers.length).toBeGreaterThan(0);
    });
  });
});
