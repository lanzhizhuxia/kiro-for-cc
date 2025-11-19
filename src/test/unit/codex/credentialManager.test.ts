import * as vscode from 'vscode';
import { CodexCredentialManager } from '../../../features/codex/credentialManager';

/**
 * 单元测试：CodexCredentialManager
 *
 * 测试API密钥的安全存储和管理功能
 */
describe('CodexCredentialManager Unit Tests', () => {
    let credentialManager: CodexCredentialManager;
    let mockContext: vscode.ExtensionContext;
    let mockSecretStorage: MockSecretStorage;

    // Mock SecretStorage implementation
    class MockSecretStorage implements vscode.SecretStorage {
        private storage = new Map<string, string>();
        private _onDidChange = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
        readonly onDidChange = this._onDidChange.event;

        async get(key: string): Promise<string | undefined> {
            return this.storage.get(key);
        }

        async store(key: string, value: string): Promise<void> {
            this.storage.set(key, value);
            this._onDidChange.fire({ key });
        }

        async delete(key: string): Promise<void> {
            this.storage.delete(key);
            this._onDidChange.fire({ key });
        }

        // Helper method for testing
        clear(): void {
            this.storage.clear();
        }
    }

    beforeEach(() => {
        mockSecretStorage = new MockSecretStorage();
        mockContext = {
            secrets: mockSecretStorage
        } as any;
        credentialManager = new CodexCredentialManager(mockContext);
    });

    afterEach(() => {
        credentialManager.dispose();
        mockSecretStorage.clear();
    });

    describe('storeApiKey()', () => {
        it('should store valid API key', async () => {
            const validKey = 'valid-api-key-12345';
            await credentialManager.storeApiKey(validKey);

            const stored = await credentialManager.getApiKey();
            expect(stored).toBe(validKey);
        });

        it('should reject key shorter than 10 characters', async () => {
            const shortKey = '123456789'; // 9 characters
            await expect(credentialManager.storeApiKey(shortKey)).rejects.toThrow(/Invalid API key format/);
        });

        it('should reject key with whitespace', async () => {
            const keyWithSpace = 'invalid key with spaces';
            await expect(credentialManager.storeApiKey(keyWithSpace)).rejects.toThrow(/Invalid API key format/);
        });

        it('should reject key with newline', async () => {
            const keyWithNewline = 'invalid-key-with\nNewline';
            await expect(credentialManager.storeApiKey(keyWithNewline)).rejects.toThrow(/Invalid API key format/);
        });

        it('should reject key with tab', async () => {
            const keyWithTab = 'invalid-key-with\tTab';
            await expect(credentialManager.storeApiKey(keyWithTab)).rejects.toThrow(/Invalid API key format/);
        });

        it('should reject empty key', async () => {
            await expect(credentialManager.storeApiKey('')).rejects.toThrow(/Invalid API key format/);
        });

        it('should trigger onDidChange event', async () => {
            let eventFired = false;
            credentialManager.onDidChange(() => {
                eventFired = true;
            });

            await credentialManager.storeApiKey('valid-api-key-12345');
            expect(eventFired).toBe(true);
        });
    });

    describe('getApiKey()', () => {
        it('should return stored API key', async () => {
            const key = 'test-api-key-12345';
            await credentialManager.storeApiKey(key);

            const retrieved = await credentialManager.getApiKey();
            expect(retrieved).toBe(key);
        });

        it('should return undefined if no key stored', async () => {
            const retrieved = await credentialManager.getApiKey();
            expect(retrieved).toBeUndefined();
        });
    });

    describe('hasApiKey()', () => {
        it('should return true if API key exists', async () => {
            await credentialManager.storeApiKey('test-api-key-12345');

            const hasKey = await credentialManager.hasApiKey();
            expect(hasKey).toBe(true);
        });

        it('should return false if no API key exists', async () => {
            const hasKey = await credentialManager.hasApiKey();
            expect(hasKey).toBe(false);
        });
    });

    describe('deleteApiKey()', () => {
        it('should delete stored API key', async () => {
            await credentialManager.storeApiKey('test-api-key-12345');
            expect(await credentialManager.hasApiKey()).toBe(true);

            await credentialManager.deleteApiKey();
            expect(await credentialManager.hasApiKey()).toBe(false);
        });

        it('should trigger onDidChange event', async () => {
            await credentialManager.storeApiKey('test-api-key-12345');

            let eventFired = false;
            credentialManager.onDidChange(() => {
                eventFired = true;
            });

            await credentialManager.deleteApiKey();
            expect(eventFired).toBe(true);
        });

        it('should delete old API key backup as well', async () => {
            // Store and rotate key
            await credentialManager.storeApiKey('old-api-key-12345');
            await credentialManager.rotateApiKey('new-api-key-67890');

            // Delete should remove both current and old keys
            await credentialManager.deleteApiKey();

            const currentKey = await mockSecretStorage.get('kfc.codex.apiKey');
            const oldKey = await mockSecretStorage.get('kfc.codex.apiKey.old');

            expect(currentKey).toBeUndefined();
            expect(oldKey).toBeUndefined();
        });
    });

    describe('rotateApiKey()', () => {
        it('should rotate API key and backup old one', async () => {
            const oldKey = 'old-api-key-12345';
            const newKey = 'new-api-key-67890';

            await credentialManager.storeApiKey(oldKey);
            await credentialManager.rotateApiKey(newKey);

            const currentKey = await credentialManager.getApiKey();
            const backedUpKey = await mockSecretStorage.get('kfc.codex.apiKey.old');

            expect(currentKey).toBe(newKey);
            expect(backedUpKey).toBe(oldKey);
        });

        it('should validate new key format', async () => {
            await credentialManager.storeApiKey('old-api-key-12345');

            await expect(credentialManager.rotateApiKey('short')).rejects.toThrow(/Invalid API key format/);
        });

        it('should work when no previous key exists', async () => {
            const newKey = 'new-api-key-67890';
            await credentialManager.rotateApiKey(newKey);

            const currentKey = await credentialManager.getApiKey();
            expect(currentKey).toBe(newKey);
        });

        it('should trigger onDidChange event', async () => {
            await credentialManager.storeApiKey('old-api-key-12345');

            let eventFired = false;
            credentialManager.onDidChange(() => {
                eventFired = true;
            });

            await credentialManager.rotateApiKey('new-api-key-67890');
            expect(eventFired).toBe(true);
        });
    });

    describe('rollbackApiKey()', () => {
        it('should rollback to old API key', async () => {
            const oldKey = 'old-api-key-12345';
            const newKey = 'new-api-key-67890';

            await credentialManager.storeApiKey(oldKey);
            await credentialManager.rotateApiKey(newKey);
            await credentialManager.rollbackApiKey();

            const currentKey = await credentialManager.getApiKey();
            expect(currentKey).toBe(oldKey);
        });

        it('should throw error if no old key exists', async () => {
            await credentialManager.storeApiKey('current-api-key-12345');

            await expect(credentialManager.rollbackApiKey()).rejects.toThrow(/No old API key available for rollback/);
        });

        it('should delete old key backup after rollback', async () => {
            await credentialManager.storeApiKey('old-api-key-12345');
            await credentialManager.rotateApiKey('new-api-key-67890');
            await credentialManager.rollbackApiKey();

            const oldKey = await mockSecretStorage.get('kfc.codex.apiKey.old');
            expect(oldKey).toBeUndefined();
        });

        it('should trigger onDidChange event', async () => {
            await credentialManager.storeApiKey('old-api-key-12345');
            await credentialManager.rotateApiKey('new-api-key-67890');

            let eventFired = false;
            credentialManager.onDidChange(() => {
                eventFired = true;
            });

            await credentialManager.rollbackApiKey();
            expect(eventFired).toBe(true);
        });
    });

    describe('Key Format Validation', () => {
        it('should accept alphanumeric key', async () => {
            await credentialManager.storeApiKey('abc123def456');
            const key = await credentialManager.getApiKey();
            expect(key).toBe('abc123def456');
        });

        it('should accept key with hyphens', async () => {
            await credentialManager.storeApiKey('api-key-with-hyphens');
            const key = await credentialManager.getApiKey();
            expect(key).toBe('api-key-with-hyphens');
        });

        it('should accept key with underscores', async () => {
            await credentialManager.storeApiKey('api_key_with_underscores');
            const key = await credentialManager.getApiKey();
            expect(key).toBe('api_key_with_underscores');
        });

        it('should accept key with dots', async () => {
            await credentialManager.storeApiKey('api.key.with.dots');
            const key = await credentialManager.getApiKey();
            expect(key).toBe('api.key.with.dots');
        });

        it('should accept key exactly 10 characters', async () => {
            await credentialManager.storeApiKey('1234567890');
            const key = await credentialManager.getApiKey();
            expect(key).toBe('1234567890');
        });

        it('should accept very long key', async () => {
            const longKey = 'a'.repeat(100);
            await credentialManager.storeApiKey(longKey);
            const key = await credentialManager.getApiKey();
            expect(key).toBe(longKey);
        });
    });

    describe('Event Handling', () => {
        it('should support multiple event listeners', async () => {
            let listener1Called = false;
            let listener2Called = false;

            credentialManager.onDidChange(() => {
                listener1Called = true;
            });

            credentialManager.onDidChange(() => {
                listener2Called = true;
            });

            await credentialManager.storeApiKey('test-api-key-12345');

            expect(listener1Called).toBe(true);
            expect(listener2Called).toBe(true);
        });
    });

    describe('dispose()', () => {
        it('should dispose event emitter', () => {
            credentialManager.dispose();
            // If dispose() doesn't throw, the test passes
            expect(true).toBe(true);
        });
    });
});
