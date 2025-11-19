import * as vscode from 'vscode';
import { ConfigManager } from '../../utils/configManager';

/**
 * API密钥设置辅助工具
 *
 * 提供首次使用引导和API密钥配置功能
 */
export class ApiKeySetup {
    /**
     * 检测并引导用户配置API密钥（如果尚未配置）
     *
     * @param context VSCode扩展上下文
     * @param outputChannel 输出通道（用于日志）
     * @returns 如果密钥已配置或用户完成配置返回true，否则返回false
     */
    static async ensureApiKeyConfigured(
        context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ): Promise<boolean> {
        const configManager = ConfigManager.getInstance();

        // 检查是否已有API密钥
        const hasKey = await configManager.hasCodexApiKey();
        if (hasKey) {
            outputChannel.appendLine('[Codex] API key already configured');
            return true;
        }

        // 显示引导对话框
        const choice = await vscode.window.showInformationMessage(
            'Codex API key not configured. Would you like to configure it now?',
            'Configure Now',
            'Skip'
        );

        if (choice === 'Configure Now') {
            return await this.promptForApiKey(outputChannel);
        } else {
            outputChannel.appendLine('[Codex] User skipped API key configuration');
            return false;
        }
    }

    /**
     * 提示用户输入API密钥
     *
     * @param outputChannel 输出通道（用于日志）
     * @returns 如果用户成功配置返回true，否则返回false
     */
    static async promptForApiKey(outputChannel: vscode.OutputChannel): Promise<boolean> {
        const configManager = ConfigManager.getInstance();

        // 显示输入框
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your Codex API key',
            password: true, // 密码模式隐藏输入
            placeHolder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            ignoreFocusOut: true, // 失去焦点时不关闭对话框
            validateInput: (value: string) => {
                // 实时验证格式
                if (!value) {
                    return 'API key cannot be empty';
                }
                if (value.length < 10) {
                    return 'API key must be at least 10 characters';
                }
                if (/[\s\n\r\t]/.test(value)) {
                    return 'API key cannot contain whitespace';
                }
                return null; // 验证通过
            }
        });

        // 用户取消
        if (!apiKey) {
            outputChannel.appendLine('[Codex] User cancelled API key input');
            return false;
        }

        try {
            // 存储API密钥
            const credentialManager = configManager.getCredentialManager();
            await credentialManager.storeApiKey(apiKey);

            outputChannel.appendLine('[Codex] API key configured successfully');
            vscode.window.showInformationMessage('Codex API key configured successfully!');
            return true;
        } catch (error) {
            outputChannel.appendLine(`[Codex] Failed to store API key: ${error}`);
            vscode.window.showErrorMessage(`Failed to store API key: ${error}`);
            return false;
        }
    }

    /**
     * 显示API密钥管理选项
     *
     * @param outputChannel 输出通道（用于日志）
     */
    static async showApiKeyManagement(outputChannel: vscode.OutputChannel): Promise<void> {
        const configManager = ConfigManager.getInstance();
        const hasKey = await configManager.hasCodexApiKey();

        const options = hasKey
            ? ['Update API Key', 'Rotate API Key', 'Delete API Key', 'Cancel']
            : ['Configure API Key', 'Cancel'];

        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select an API key management action'
        });

        switch (choice) {
            case 'Configure API Key':
            case 'Update API Key':
                await this.promptForApiKey(outputChannel);
                break;

            case 'Rotate API Key':
                await this.rotateApiKey(outputChannel);
                break;

            case 'Delete API Key':
                await this.deleteApiKey(outputChannel);
                break;

            default:
                outputChannel.appendLine('[Codex] User cancelled API key management');
        }
    }

    /**
     * 轮换API密钥
     *
     * @param outputChannel 输出通道（用于日志）
     */
    private static async rotateApiKey(outputChannel: vscode.OutputChannel): Promise<void> {
        const configManager = ConfigManager.getInstance();

        // 提示输入新密钥
        const newApiKey = await vscode.window.showInputBox({
            prompt: 'Enter your new Codex API key (old key will be backed up)',
            password: true,
            placeHolder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            ignoreFocusOut: true,
            validateInput: (value: string) => {
                if (!value) {
                    return 'API key cannot be empty';
                }
                if (value.length < 10) {
                    return 'API key must be at least 10 characters';
                }
                if (/[\s\n\r\t]/.test(value)) {
                    return 'API key cannot contain whitespace';
                }
                return null;
            }
        });

        if (!newApiKey) {
            outputChannel.appendLine('[Codex] User cancelled API key rotation');
            return;
        }

        try {
            const credentialManager = configManager.getCredentialManager();
            await credentialManager.rotateApiKey(newApiKey);

            outputChannel.appendLine('[Codex] API key rotated successfully');
            vscode.window.showInformationMessage(
                'API key rotated successfully! You can rollback if needed.'
            );
        } catch (error) {
            outputChannel.appendLine(`[Codex] Failed to rotate API key: ${error}`);
            vscode.window.showErrorMessage(`Failed to rotate API key: ${error}`);
        }
    }

    /**
     * 删除API密钥
     *
     * @param outputChannel 输出通道（用于日志）
     */
    private static async deleteApiKey(outputChannel: vscode.OutputChannel): Promise<void> {
        const configManager = ConfigManager.getInstance();

        // 确认删除
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to delete the Codex API key?',
            { modal: true },
            'Delete',
            'Cancel'
        );

        if (confirm !== 'Delete') {
            outputChannel.appendLine('[Codex] User cancelled API key deletion');
            return;
        }

        try {
            const credentialManager = configManager.getCredentialManager();
            await credentialManager.deleteApiKey();

            outputChannel.appendLine('[Codex] API key deleted successfully');
            vscode.window.showInformationMessage('Codex API key deleted successfully');
        } catch (error) {
            outputChannel.appendLine(`[Codex] Failed to delete API key: ${error}`);
            vscode.window.showErrorMessage(`Failed to delete API key: ${error}`);
        }
    }
}
