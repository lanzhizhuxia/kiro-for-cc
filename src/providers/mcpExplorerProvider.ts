import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MCPServerInfo {
    name: string;
    type: 'stdio' | 'sse' | 'http';
    scope: 'local' | 'project' | 'user';
    scopeDisplay?: string;  // Full scope text from output
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
}

export class MCPExplorerProvider implements vscode.TreeDataProvider<MCPItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MCPItem | undefined | null | void> = new vscode.EventEmitter<MCPItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MCPItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private servers: Map<string, MCPServerInfo> = new Map();
    private outputChannel: vscode.OutputChannel;
    private isLoading: boolean = true;

    constructor(
        private context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ) {
        this.outputChannel = outputChannel;
        this.loadMCPServers().then(() => {
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
        });
    }

    refresh(): void {
        this.isLoading = true;
        this._onDidChangeTreeData.fire(); // Fire immediately to show loading state
        this.loadMCPServers().then(() => {
            this.isLoading = false;
            this._onDidChangeTreeData.fire(); // Fire again to show the loaded servers
        });
    }

    getTreeItem(element: MCPItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: MCPItem): Promise<MCPItem[]> {
        if (!element) {
            // Root level - show all MCP servers
            const items: MCPItem[] = [];

            if (this.isLoading) {
                items.push(new MCPItem(
                    'Loading MCP servers...',
                    vscode.TreeItemCollapsibleState.None,
                    'mcp-loading',
                    'loading',
                    undefined,
                    this.context
                ));
                return items;
            }

            for (const [name, server] of this.servers) {
                items.push(new MCPItem(
                    name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'mcp-server',
                    `mcp-${name}`,
                    server,
                    this.context
                ));
            }

            if (items.length === 0) {
                items.push(new MCPItem(
                    'No MCP servers configured',
                    vscode.TreeItemCollapsibleState.None,
                    'mcp-empty',
                    'empty',
                    undefined,
                    this.context
                ));
            }

            return items;
        } else if (element.contextValue === 'mcp-server' && element.serverInfo) {
            // Show server details as children in the order: Scope, Type, Command, Environment (if any)
            const server = element.serverInfo;
            const items: MCPItem[] = [];

            // 1. Scope (first)
            items.push(new MCPItem(
                server.scopeDisplay || `Scope: ${server.scope}`,
                vscode.TreeItemCollapsibleState.None,
                'mcp-detail',
                `${element.id}-scope`,
                undefined,
                this.context
            ));

            // 2. Type
            items.push(new MCPItem(
                `Type: ${server.type}`,
                vscode.TreeItemCollapsibleState.None,
                'mcp-detail',
                `${element.id}-type`,
                undefined,
                this.context
            ));

            // 3. Command (based on server type)
            if (server.type === 'stdio') {
                // Combine command and args
                let commandStr = server.command || '';
                if (server.args && server.args.length > 0) {
                    commandStr += ' ' + server.args.join(' ');
                }
                if (commandStr) {
                    items.push(new MCPItem(
                        `Command: ${commandStr}`,
                        vscode.TreeItemCollapsibleState.None,
                        'mcp-detail',
                        `${element.id}-command`,
                        undefined,
                        this.context
                    ));
                }
            } else if (server.type === 'sse' || server.type === 'http') {
                if (server.url) {
                    items.push(new MCPItem(
                        `URL: ${server.url}`,
                        vscode.TreeItemCollapsibleState.None,
                        'mcp-detail',
                        `${element.id}-url`,
                        undefined,
                        this.context
                    ));
                }
                if (server.headers && Object.keys(server.headers).length > 0) {
                    items.push(new MCPItem(
                        `Headers: ${Object.keys(server.headers).join(', ')}`,
                        vscode.TreeItemCollapsibleState.None,
                        'mcp-detail',
                        `${element.id}-headers`,
                        undefined,
                        this.context
                    ));
                }
            }

            // 4. Environment variables - only show if not empty
            if (server.env && Object.keys(server.env).length > 0) {
                const envStr = Object.entries(server.env)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ');
                items.push(new MCPItem(
                    `Environment: ${envStr}`,
                    vscode.TreeItemCollapsibleState.None,
                    'mcp-detail',
                    `${element.id}-env`,
                    undefined,
                    this.context
                ));
            }

            return items;
        }

        return [];
    }

    private async loadMCPServers() {
        this.servers.clear();

        try {
            // Execute claude mcp list command
            const { stdout, stderr } = await execAsync('claude mcp list');

            // Only log errors, not normal output
            if (stderr) {
                this.outputChannel.appendLine(`claude mcp list stderr: ${stderr}`);

                if (!stdout) {
                    return;
                }
            }


            // Parse the output
            await this.parseMCPListOutput(stdout);

            // Get detailed info for each server
            for (const name of this.servers.keys()) {
                await this.loadServerDetails(name);
            }

        } catch (error) {
            this.outputChannel.appendLine(`Failed to load MCP servers: ${error}`);
            // Show error in tree view
            this.servers.clear();
        }
    }

    private async parseMCPListOutput(output: string) {
        // Parse output format: "context7: npx -y @upstash/context7-mcp"
        const lines = output.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const name = line.substring(0, colonIndex).trim();
                // The rest is the command, but we'll get details from mcp get
                this.servers.set(name, {
                    name,
                    type: 'stdio', // Default, will be updated with details
                    scope: 'local' // Default, will be updated with details
                });
            }
        }
    }

    private async loadServerDetails(name: string) {
        try {
            const { stdout, stderr } = await execAsync(`claude mcp get ${name}`);

            if (stderr) {
                this.outputChannel.appendLine(`Error getting details for ${name}: ${stderr}`);
                return;
            }

            // Parse the details output
            const server = this.servers.get(name);
            if (server) {
                this.parseServerDetails(server, stdout);
            }

        } catch (error) {
            this.outputChannel.appendLine(`Failed to get details for ${name}: ${error}`);
        }
    }

    private parseServerDetails(server: MCPServerInfo, output: string) {
        const lines = output.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();

            // Parse different fields
            if (trimmed.startsWith('Scope:')) {
                // Save the full scope display text
                server.scopeDisplay = trimmed;

                // Also parse the simple scope value
                const scopeMatch = trimmed.match(/Scope:\s*(\w+)/);
                if (scopeMatch) {
                    const scope = scopeMatch[1].toLowerCase();
                    if (scope === 'user' || scope === 'project' || scope === 'local') {
                        server.scope = scope as 'local' | 'project' | 'user';
                    }
                }
            } else if (trimmed.startsWith('Type:')) {
                const type = trimmed.substring(5).trim().toLowerCase();
                if (type === 'stdio' || type === 'sse' || type === 'http') {
                    server.type = type;
                }
            } else if (trimmed.startsWith('Command:')) {
                server.command = trimmed.substring(8).trim();
            } else if (trimmed.startsWith('Args:')) {
                const argsStr = trimmed.substring(5).trim();
                // Parse args more carefully, they might be on separate lines or contain spaces
                if (argsStr && !argsStr.startsWith('-')) {
                    server.args = argsStr.split(/\s+/);
                } else if (argsStr) {
                    // Args are flags like "-y @upstash/context7-mcp"
                    server.args = argsStr.split(/\s+/);
                }
            } else if (trimmed.startsWith('URL:')) {
                server.url = trimmed.substring(4).trim();
            } else if (trimmed.startsWith('Headers:')) {
                // Headers might be on multiple lines
                const headerStr = trimmed.substring(8).trim();
                if (headerStr) {
                    server.headers = {};
                    // Simple parsing, might need adjustment based on actual format
                    const pairs = headerStr.split(',');
                    for (const pair of pairs) {
                        const [key, value] = pair.split(':').map(s => s.trim());
                        if (key) {
                            server.headers[key] = value || '';
                        }
                    }
                }
            } else if (trimmed.startsWith('Environment:') || trimmed.startsWith('Env:')) {
                const envStr = trimmed.substring(trimmed.indexOf(':') + 1).trim();
                if (envStr && envStr !== '(none)' && envStr !== 'None') {
                    server.env = {};
                    // Parse KEY=value pairs
                    const pairs = envStr.split(/\s+/);
                    for (const pair of pairs) {
                        const [key, value] = pair.split('=');
                        if (key) {
                            server.env[key] = value || '';
                        }
                    }
                }
            }
        }
    }
}

class MCPItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly id: string,
        public readonly serverInfo?: MCPServerInfo,
        private readonly context?: vscode.ExtensionContext
    ) {
        super(label, collapsibleState);

        // Set appropriate icons
        if (contextValue === 'mcp-empty') {
            this.iconPath = new vscode.ThemeIcon('info');
        } else if (contextValue === 'mcp-loading') {
            this.iconPath = new vscode.ThemeIcon('sync~spin');
        } else if (contextValue === 'mcp-server') {
            // Use server-environment icon for all server types
            this.iconPath = new vscode.ThemeIcon('server-environment');

            // No description for main server node
        } else if (contextValue === 'mcp-detail') {
            if (label.startsWith('Type:')) {
                this.iconPath = new vscode.ThemeIcon('symbol-property');
            } else if (label.startsWith('Command:')) {
                this.iconPath = new vscode.ThemeIcon('terminal');
            } else if (label.startsWith('URL:')) {
                this.iconPath = new vscode.ThemeIcon('link');
            } else if (label.startsWith('Environment:')) {
                this.iconPath = new vscode.ThemeIcon('symbol-variable');
            } else if (label.startsWith('Scope:')) {
                this.iconPath = new vscode.ThemeIcon('globe');
            } else if (label.startsWith('Args:')) {
                this.iconPath = new vscode.ThemeIcon('symbol-array');
            } else if (label.startsWith('Headers:')) {
                this.iconPath = new vscode.ThemeIcon('symbol-key');
            } else {
                this.iconPath = new vscode.ThemeIcon('circle-outline');
            }
        } else if (context) {
            this.iconPath = {
                light: vscode.Uri.file(context.asAbsolutePath('icons/server.svg')),
                dark: vscode.Uri.file(context.asAbsolutePath('icons/server.svg'))
            };
        } else {
            this.iconPath = new vscode.ThemeIcon('server-environment');
        }

        // Set tooltips
        if (contextValue === 'mcp-server' && serverInfo) {
            this.tooltip = `MCP Server: ${label}\nType: ${serverInfo.type}\nScope: ${serverInfo.scope}`;
        } else if (contextValue === 'mcp-detail') {
            this.tooltip = label;
        }
    }
}