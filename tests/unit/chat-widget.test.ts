import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  serializeMessages,
  deserializeMessages,
  saveConversation,
  loadConversation,
  clearConversation,
  STORAGE_KEY,
  MAX_CHARS,
  TIMEOUT_MS,
} from '../../src/components/ChatWidget';
import type { ChatMessage } from '../../src/components/ChatWidget';

describe('ChatWidget constants', () => {
  it('should export correct storage key', () => {
    expect(STORAGE_KEY).toBe('resume-chat-history');
  });

  it('should export correct max chars', () => {
    expect(MAX_CHARS).toBe(500);
  });

  it('should export correct timeout', () => {
    expect(TIMEOUT_MS).toBe(30000);
  });
});

describe('serializeMessages', () => {
  it('should serialize an empty array', () => {
    expect(serializeMessages([])).toBe('[]');
  });

  it('should serialize a single user message', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello', timestamp: 1000 },
    ];
    const result = JSON.parse(serializeMessages(messages));
    expect(result).toEqual(messages);
  });

  it('should serialize messages with sources', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'What skills?', timestamp: 1000 },
      {
        role: 'assistant',
        content: 'AWS, TypeScript',
        sources: [
          { title: 'Cloud Platforms', category: 'skills' },
          { title: 'Programming', category: 'skills' },
        ],
        timestamp: 2000,
      },
    ];
    const result = JSON.parse(serializeMessages(messages));
    expect(result).toEqual(messages);
  });

  it('should handle messages with undefined sources', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hi', timestamp: 1000 },
    ];
    const serialized = serializeMessages(messages);
    expect(serialized).not.toContain('sources');
  });
});

describe('deserializeMessages', () => {
  it('should return empty array for null input', () => {
    expect(deserializeMessages(null)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(deserializeMessages('')).toEqual([]);
  });

  it('should return empty array for invalid JSON', () => {
    expect(deserializeMessages('not json')).toEqual([]);
  });

  it('should return empty array for non-array JSON', () => {
    expect(deserializeMessages('{"key": "value"}')).toEqual([]);
  });

  it('should return empty array for array of non-objects', () => {
    expect(deserializeMessages('[1, 2, 3]')).toEqual([]);
  });

  it('should filter out messages with invalid role', () => {
    const raw = JSON.stringify([
      { role: 'user', content: 'Hi', timestamp: 1000 },
      { role: 'invalid', content: 'Bad', timestamp: 2000 },
    ]);
    const result = deserializeMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  it('should filter out messages missing content', () => {
    const raw = JSON.stringify([
      { role: 'user', timestamp: 1000 },
      { role: 'assistant', content: 'Valid', timestamp: 2000 },
    ]);
    const result = deserializeMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Valid');
  });

  it('should filter out messages missing timestamp', () => {
    const raw = JSON.stringify([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello', timestamp: 2000 },
    ]);
    const result = deserializeMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(2000);
  });

  it('should preserve sources in deserialized messages', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'Answer',
        sources: [{ title: 'Skills', category: 'skills' }],
        timestamp: 1000,
      },
    ];
    const result = deserializeMessages(JSON.stringify(messages));
    expect(result[0].sources).toEqual([{ title: 'Skills', category: 'skills' }]);
  });

  it('should handle round-trip serialization/deserialization', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'What AWS services?', timestamp: 1000 },
      {
        role: 'assistant',
        content: 'Lambda, S3, CloudFront',
        sources: [{ title: 'Cloud Platforms', category: 'skills' }],
        timestamp: 2000,
      },
    ];
    const result = deserializeMessages(serializeMessages(messages));
    expect(result).toEqual(messages);
  });
});

describe('sessionStorage helpers', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    const mockSessionStorage = {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete storage[key]; }),
    };
    vi.stubGlobal('sessionStorage', mockSessionStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('saveConversation', () => {
    it('should save messages to sessionStorage', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello', timestamp: 1000 },
      ];
      saveConversation(messages);
      expect(storage[STORAGE_KEY]).toBe(JSON.stringify(messages));
    });

    it('should overwrite previous conversation', () => {
      saveConversation([{ role: 'user', content: 'First', timestamp: 1000 }]);
      saveConversation([{ role: 'user', content: 'Second', timestamp: 2000 }]);
      const stored = JSON.parse(storage[STORAGE_KEY]);
      expect(stored).toHaveLength(1);
      expect(stored[0].content).toBe('Second');
    });

    it('should not throw when sessionStorage is unavailable', () => {
      vi.stubGlobal('sessionStorage', {
        setItem: () => { throw new Error('QuotaExceededError'); },
        getItem: () => null,
        removeItem: () => {},
      });
      expect(() => saveConversation([])).not.toThrow();
    });
  });

  describe('loadConversation', () => {
    it('should return empty array when no data stored', () => {
      expect(loadConversation()).toEqual([]);
    });

    it('should return stored messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hi', timestamp: 1000 },
        { role: 'assistant', content: 'Hello!', timestamp: 2000 },
      ];
      storage[STORAGE_KEY] = JSON.stringify(messages);
      expect(loadConversation()).toEqual(messages);
    });

    it('should not throw when sessionStorage is unavailable', () => {
      vi.stubGlobal('sessionStorage', {
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => {},
        removeItem: () => {},
      });
      expect(loadConversation()).toEqual([]);
    });
  });

  describe('clearConversation', () => {
    it('should remove stored conversation', () => {
      storage[STORAGE_KEY] = '[]';
      clearConversation();
      expect(storage[STORAGE_KEY]).toBeUndefined();
    });

    it('should not throw when sessionStorage is unavailable', () => {
      vi.stubGlobal('sessionStorage', {
        removeItem: () => { throw new Error('SecurityError'); },
        getItem: () => null,
        setItem: () => {},
      });
      expect(() => clearConversation()).not.toThrow();
    });
  });
});
