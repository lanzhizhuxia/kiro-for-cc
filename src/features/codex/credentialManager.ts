import * as vscode from 'vscode';

/**
 * CodexCredentialManager - 管理Codex API密钥的安全存储
 *
 * 使用VSCode SecretStorage API安全存储Codex API密钥，确保密钥不会明文存储在配置文件中。
 *
 * 功能：
 * - 安全存储API密钥到VSCode SecretStorage
 * - 密钥格式验证（不验证有效性）
 * - 密钥轮换和回滚支持
 * - 变更事件通知
 *
 * @example
 * ```typescript
 * const credentialManager = new CodexCredentialManager(context);
 *
 * // 存储密钥
 * await credentialManager.storeApiKey('your-api-key');
 *
 * // 获取密钥
 * const apiKey = await credentialManager.getApiKey();
 *
 * // 监听密钥变化
 * credentialManager.onDidChange(() => {
 *   console.log('API key changed');
 * });
 * ```
 */
export class CodexCredentialManager {
    private secretStorage: vscode.SecretStorage;
    private readonly SECRET_KEY = 'kfc.codex.apiKey';
    private readonly SECRET_KEY_OLD = 'kfc.codex.apiKey.old';

    // 事件发射器，用于通知其他组件密钥变化
    private _onDidChangeEmitter = new vscode.EventEmitter<void>();
    readonly onDidChange: vscode.Event<void> = this._onDidChangeEmitter.event;

    /**
     * 创建CodexCredentialManager实例
     * @param context VSCode扩展上下文，用于访问SecretStorage
     */
    constructor(context: vscode.ExtensionContext) {
        this.secretStorage = context.secrets;
    }

    /**
     * 存储API密钥到SecretStorage
     * @param key API密钥字符串
     * @throws Error 如果密钥格式无效
     */
    async storeApiKey(key: string): Promise<void> {
        // 1. 验证密钥格式 (不验证有效性)
        if (!this._validateKeyFormat(key)) {
            throw new Error('Invalid API key format: Key must be at least 10 characters and contain no whitespace');
        }

        // 2. 存储到 VSCode SecretStorage
        await this.secretStorage.store(this.SECRET_KEY, key);

        // 3. 触发 onDidChange 事件
        this._onDidChangeEmitter.fire();
    }

    /**
     * 从SecretStorage获取API密钥
     * @returns API密钥字符串，如果不存在则返回undefined
     */
    async getApiKey(): Promise<string | undefined> {
        return await this.secretStorage.get(this.SECRET_KEY);
    }

    /**
     * 从SecretStorage删除API密钥
     */
    async deleteApiKey(): Promise<void> {
        await this.secretStorage.delete(this.SECRET_KEY);
        await this.secretStorage.delete(this.SECRET_KEY_OLD); // 同时清理旧密钥
        this._onDidChangeEmitter.fire();
    }

    /**
     * 检查是否已配置API密钥
     * @returns 如果密钥存在返回true，否则返回false
     */
    async hasApiKey(): Promise<boolean> {
        const key = await this.getApiKey();
        return !!key;
    }

    /**
     * 轮换API密钥
     *
     * 将当前密钥保存为旧密钥（用于回滚），然后更新为新密钥。
     *
     * @param newKey 新的API密钥
     * @throws Error 如果新密钥格式无效
     */
    async rotateApiKey(newKey: string): Promise<void> {
        // 1. 验证新密钥格式
        if (!this._validateKeyFormat(newKey)) {
            throw new Error('Invalid API key format: Key must be at least 10 characters and contain no whitespace');
        }

        // 2. 存储旧密钥（用于回滚）
        const oldKey = await this.getApiKey();
        if (oldKey) {
            await this.secretStorage.store(this.SECRET_KEY_OLD, oldKey);
        }

        // 3. 更新为新密钥
        await this.storeApiKey(newKey);
    }

    /**
     * 回滚到旧API密钥
     *
     * 将当前密钥恢复为上一次轮换前的密钥。
     *
     * @throws Error 如果没有旧密钥可回滚
     */
    async rollbackApiKey(): Promise<void> {
        const oldKey = await this.secretStorage.get(this.SECRET_KEY_OLD);
        if (!oldKey) {
            throw new Error('No old API key available for rollback');
        }

        await this.storeApiKey(oldKey);
        await this.secretStorage.delete(this.SECRET_KEY_OLD);
    }

    /**
     * 验证密钥格式
     *
     * 基本格式检查，不验证密钥的有效性：
     * - 密钥长度至少10个字符
     * - 不包含空白字符（空格、换行、制表符等）
     *
     * @param key 待验证的密钥
     * @returns 如果格式有效返回true，否则返回false
     * @private
     */
    private _validateKeyFormat(key: string): boolean {
        // 基本格式检查 (不验证有效性)
        if (!key || key.length < 10) {
            return false;
        }

        // 检查是否包含明显的非法字符（空白字符）
        if (/[\s\n\r\t]/.test(key)) {
            return false;
        }

        return true;
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this._onDidChangeEmitter.dispose();
    }
}
