import * as vscode from 'vscode';
import * as path from 'path';
import { DEFAULT_PATHS, CONFIG_FILE_NAME, DEFAULT_VIEW_VISIBILITY } from '../constants';
import { CodexCredentialManager } from '../features/codex/credentialManager';

export interface KfcSettings {
    paths: {
        specs: string;
        steering: string;
        settings: string;
    };
    views: {
        specs: { visible: boolean };
        steering: { visible: boolean };
        mcp: { visible: boolean };
        hooks: { visible: boolean };
        settings: { visible: boolean };
    };
    codex?: CodexSettings;
}

export interface CodexSettings {
    defaultMode: 'local' | 'codex' | 'auto';
    enableDeepThinking: boolean;
    enableCodebaseScan: boolean;
    timeout: number;
    mcp: MCPSettings;
    security: SecuritySettings;
    performance: PerformanceSettings;
}

export interface MCPSettings {
    port: number;
    timeout: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface SecuritySettings {
    allowedPaths: string[];
    requireShellConfirmation: boolean;
    sensitiveFilePatterns: string[];
}

export interface PerformanceSettings {
    maxConcurrency: number;
    cacheTTL: number;
    maxMemoryUsage: number;
}

export class ConfigManager {
    private static instance: ConfigManager;
    private settings: KfcSettings | null = null;
    private workspaceFolder: vscode.WorkspaceFolder | undefined;
    private _credentialManager: CodexCredentialManager | null = null;

    // Internal constants
    private static readonly TERMINAL_VENV_ACTIVATION_DELAY = 800; // ms
    private static readonly CONFIG_VERSION = 2; // Configuration version for migration

    private constructor() {
        this.workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    async loadSettings(): Promise<KfcSettings> {
        if (!this.workspaceFolder) {
            return this.getDefaultSettings();
        }

        const settingsPath = path.join(
            this.workspaceFolder.uri.fsPath,
            DEFAULT_PATHS.settings,
            CONFIG_FILE_NAME
        );

        try {
            const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(settingsPath));
            const rawSettings = JSON.parse(Buffer.from(fileContent).toString());

            // Migrate settings to current version
            const migratedSettings = this.migrateConfig(rawSettings);

            // Validate Codex configuration
            const validation = this.validateCodexConfig(migratedSettings.codex);
            if (!validation.valid) {
                console.warn('Codex configuration validation errors:', validation.errors);
                // Use default Codex settings if validation fails
                migratedSettings.codex = this.getDefaultCodexSettings();
            }

            this.settings = migratedSettings;
            return this.settings!;
        } catch (error) {
            // Return default settings if file doesn't exist or is invalid
            this.settings = this.getDefaultSettings();
            return this.settings!;
        }
    }

    getSettings(): KfcSettings {
        if (!this.settings) {
            this.settings = this.getDefaultSettings();
        }
        return this.settings;
    }

    getPath(type: keyof typeof DEFAULT_PATHS): string {
        const settings = this.getSettings();
        const rawPath = settings.paths[type] || DEFAULT_PATHS[type];
        const normalized = this.normalizePath(rawPath);
        return normalized || this.normalizePath(DEFAULT_PATHS[type]);
    }

    /**
     * Normalizes a path for consistent matching:
     * - Removes leading ./ or .\
     * - Converts backslashes to forward slashes
     * - Collapses duplicate separators and trims trailing slashes
     */
    private normalizePath(inputPath: string): string {
        if (!inputPath) {
            return inputPath;
        }

        // Start by trimming whitespace and removing repeated leading ./ or .\
        let normalized = inputPath.trim().replace(/^(\.\/|\.\\)+/, '');

        // Normalize path separators to forward slashes for glob compatibility
        normalized = normalized.replace(/\\/g, '/');

        // Collapse any duplicate separators that may result from user input
        normalized = normalized.replace(/\/{2,}/g, '/');

        // Remove trailing slashes for consistent matching
        normalized = normalized.replace(/\/+$/, '');

        return normalized;
    }

    getAbsolutePath(type: keyof typeof DEFAULT_PATHS): string {
        if (!this.workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        return path.join(this.workspaceFolder.uri.fsPath, this.getPath(type));
    }

    getTerminalDelay(): number {
        return ConfigManager.TERMINAL_VENV_ACTIVATION_DELAY;
    }

    private getDefaultSettings(): KfcSettings {
        return {
            paths: { ...DEFAULT_PATHS },
            views: {
                specs: { visible: DEFAULT_VIEW_VISIBILITY.specs },
                steering: { visible: DEFAULT_VIEW_VISIBILITY.steering },
                mcp: { visible: DEFAULT_VIEW_VISIBILITY.mcp },
                hooks: { visible: DEFAULT_VIEW_VISIBILITY.hooks },
                settings: { visible: DEFAULT_VIEW_VISIBILITY.settings }
            },
            codex: this.getDefaultCodexSettings()
        };
    }

    /**
     * Get default Codex configuration settings
     */
    private getDefaultCodexSettings(): CodexSettings {
        return {
            defaultMode: 'auto',
            enableDeepThinking: true,
            enableCodebaseScan: true,
            timeout: 300000, // 5 minutes
            mcp: {
                port: 8765,
                timeout: 300000, // 5 minutes
                logLevel: 'info'
            },
            security: {
                allowedPaths: ['src/**', 'docs/**', '.claude/**'],
                requireShellConfirmation: true,
                sensitiveFilePatterns: ['.env', '*.key', 'credentials.json', '*.pem', '*.p12']
            },
            performance: {
                maxConcurrency: 3,
                cacheTTL: 86400000, // 24 hours
                maxMemoryUsage: 500 // 500MB
            }
        };
    }

    /**
     * Validate Codex configuration
     * @param config Codex configuration to validate
     * @returns Validation result with errors if any
     */
    validateCodexConfig(config: CodexSettings | undefined): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!config) {
            return { valid: true, errors: [] }; // Codex config is optional
        }

        // Validate defaultMode
        if (!['local', 'codex', 'auto'].includes(config.defaultMode)) {
            errors.push(`Invalid defaultMode: ${config.defaultMode}. Must be 'local', 'codex', or 'auto'.`);
        }

        // Validate timeout
        if (typeof config.timeout !== 'number' || config.timeout < 1000 || config.timeout > 600000) {
            errors.push(`Invalid timeout: ${config.timeout}. Must be between 1000ms and 600000ms (10 minutes).`);
        }

        // Validate MCP settings
        if (config.mcp) {
            if (typeof config.mcp.port !== 'number' || config.mcp.port < 1024 || config.mcp.port > 65535) {
                errors.push(`Invalid MCP port: ${config.mcp.port}. Must be between 1024 and 65535.`);
            }

            if (typeof config.mcp.timeout !== 'number' || config.mcp.timeout < 1000) {
                errors.push(`Invalid MCP timeout: ${config.mcp.timeout}. Must be at least 1000ms.`);
            }

            if (!['debug', 'info', 'warn', 'error'].includes(config.mcp.logLevel)) {
                errors.push(`Invalid MCP logLevel: ${config.mcp.logLevel}. Must be 'debug', 'info', 'warn', or 'error'.`);
            }
        } else {
            errors.push('MCP settings are required in Codex configuration.');
        }

        // Validate security settings
        if (config.security) {
            if (!Array.isArray(config.security.allowedPaths)) {
                errors.push('Security allowedPaths must be an array of strings.');
            }

            if (!Array.isArray(config.security.sensitiveFilePatterns)) {
                errors.push('Security sensitiveFilePatterns must be an array of strings.');
            }

            if (typeof config.security.requireShellConfirmation !== 'boolean') {
                errors.push('Security requireShellConfirmation must be a boolean.');
            }
        } else {
            errors.push('Security settings are required in Codex configuration.');
        }

        // Validate performance settings
        if (config.performance) {
            if (typeof config.performance.maxConcurrency !== 'number' || config.performance.maxConcurrency < 1 || config.performance.maxConcurrency > 10) {
                errors.push(`Invalid maxConcurrency: ${config.performance.maxConcurrency}. Must be between 1 and 10.`);
            }

            if (typeof config.performance.cacheTTL !== 'number' || config.performance.cacheTTL < 0) {
                errors.push(`Invalid cacheTTL: ${config.performance.cacheTTL}. Must be a non-negative number.`);
            }

            if (typeof config.performance.maxMemoryUsage !== 'number' || config.performance.maxMemoryUsage < 100) {
                errors.push(`Invalid maxMemoryUsage: ${config.performance.maxMemoryUsage}. Must be at least 100MB.`);
            }
        } else {
            errors.push('Performance settings are required in Codex configuration.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Migrate configuration from older versions to current version
     * @param settings Settings to migrate
     * @returns Migrated settings
     */
    migrateConfig(settings: any): KfcSettings {
        // Create a copy to avoid mutating the original
        const migrated = { ...settings };

        // Version 1 -> Version 2: Add Codex configuration
        if (!migrated.codex) {
            migrated.codex = this.getDefaultCodexSettings();
        } else {
            // Merge with defaults to ensure all fields exist
            const defaults = this.getDefaultCodexSettings();
            migrated.codex = {
                defaultMode: migrated.codex.defaultMode || defaults.defaultMode,
                enableDeepThinking: migrated.codex.enableDeepThinking ?? defaults.enableDeepThinking,
                enableCodebaseScan: migrated.codex.enableCodebaseScan ?? defaults.enableCodebaseScan,
                timeout: migrated.codex.timeout || defaults.timeout,
                mcp: {
                    port: migrated.codex.mcp?.port || defaults.mcp.port,
                    timeout: migrated.codex.mcp?.timeout || defaults.mcp.timeout,
                    logLevel: migrated.codex.mcp?.logLevel || defaults.mcp.logLevel
                },
                security: {
                    allowedPaths: migrated.codex.security?.allowedPaths || defaults.security.allowedPaths,
                    requireShellConfirmation: migrated.codex.security?.requireShellConfirmation ?? defaults.security.requireShellConfirmation,
                    sensitiveFilePatterns: migrated.codex.security?.sensitiveFilePatterns || defaults.security.sensitiveFilePatterns
                },
                performance: {
                    maxConcurrency: migrated.codex.performance?.maxConcurrency || defaults.performance.maxConcurrency,
                    cacheTTL: migrated.codex.performance?.cacheTTL || defaults.performance.cacheTTL,
                    maxMemoryUsage: migrated.codex.performance?.maxMemoryUsage || defaults.performance.maxMemoryUsage
                }
            };
        }

        // Ensure paths exist
        if (!migrated.paths) {
            migrated.paths = { ...DEFAULT_PATHS };
        }

        // Ensure views exist
        if (!migrated.views) {
            migrated.views = {
                specs: { visible: DEFAULT_VIEW_VISIBILITY.specs },
                steering: { visible: DEFAULT_VIEW_VISIBILITY.steering },
                mcp: { visible: DEFAULT_VIEW_VISIBILITY.mcp },
                hooks: { visible: DEFAULT_VIEW_VISIBILITY.hooks },
                settings: { visible: DEFAULT_VIEW_VISIBILITY.settings }
            };
        }

        return migrated as KfcSettings;
    }

    async saveSettings(settings: KfcSettings): Promise<void> {
        if (!this.workspaceFolder) {
            throw new Error('No workspace folder found');
        }

        // Validate Codex configuration before saving
        const validation = this.validateCodexConfig(settings.codex);
        if (!validation.valid) {
            throw new Error(`Invalid Codex configuration:\n${validation.errors.join('\n')}`);
        }

        const settingsDir = path.join(
            this.workspaceFolder.uri.fsPath,
            DEFAULT_PATHS.settings
        );
        const settingsPath = path.join(settingsDir, CONFIG_FILE_NAME);

        // Ensure directory exists
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(settingsDir));

        // Save settings
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(settingsPath),
            Buffer.from(JSON.stringify(settings, null, 2))
        );

        this.settings = settings;
    }

    /**
     * Initialize credential manager with extension context
     * @param context VSCode extension context
     */
    initializeCredentialManager(context: vscode.ExtensionContext): void {
        if (!this._credentialManager) {
            this._credentialManager = new CodexCredentialManager(context);
        }
    }

    /**
     * Get the credential manager instance
     * @returns CodexCredentialManager instance
     * @throws Error if credential manager is not initialized
     */
    getCredentialManager(): CodexCredentialManager {
        if (!this._credentialManager) {
            throw new Error('Credential manager not initialized. Call initializeCredentialManager first.');
        }
        return this._credentialManager;
    }

    /**
     * Get Codex API key from credential manager
     * @returns API key string or undefined if not set
     */
    async getCodexApiKey(): Promise<string | undefined> {
        if (!this._credentialManager) {
            return undefined;
        }
        return await this._credentialManager.getApiKey();
    }

    /**
     * Check if Codex API key is configured
     * @returns true if API key exists, false otherwise
     */
    async hasCodexApiKey(): Promise<boolean> {
        if (!this._credentialManager) {
            return false;
        }
        return await this._credentialManager.hasApiKey();
    }
}
