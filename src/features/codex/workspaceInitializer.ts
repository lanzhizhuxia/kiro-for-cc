/**
 * 工作空间初始化器 - Codex工作流编排系统
 *
 * 负责创建和初始化Codex工作空间的目录结构和配置文件。
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Codex MCP服务器配置接口
 */
export interface MCPConfig {
  /** MCP服务器端口 */
  port: number;

  /** 连接超时时间（毫秒） */
  timeout: number;

  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  /** 健康检查间隔（秒） */
  healthCheckInterval: number;

  /** 自动重启配置 */
  autoRestart: {
    enabled: boolean;
    maxRetries: number;
    retryInterval: number;
  };
}

/**
 * 会话记录接口
 */
export interface SessionsRecord {
  version: string;
  lastUpdated: string;
  sessions: any[];
}

/**
 * 初始化Codex工作空间
 * 创建必要的目录结构和配置文件
 *
 * @param workspaceFolder 工作空间文件夹
 * @returns Promise<void>
 * @throws Error 如果初始化失败
 */
export async function initializeCodexWorkspace(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<void> {
  const codexBasePath = path.join(workspaceFolder.uri.fsPath, '.claude', 'codex');

  try {
    // 1. 创建主目录 .claude/codex/
    await createDirectory(codexBasePath);

    // 2. 创建 execution-history/ 子目录
    const historyPath = path.join(codexBasePath, 'execution-history');
    await createDirectory(historyPath);

    // 3. 生成默认的 mcp-config.json 文件
    const mcpConfigPath = path.join(codexBasePath, 'mcp-config.json');
    await createMCPConfigFile(mcpConfigPath);

    // 4. 创建 sessions.json 会话记录文件
    const sessionsPath = path.join(codexBasePath, 'sessions.json');
    await createSessionsFile(sessionsPath);

    // 5. 添加 .claudeignore 模板文件
    const ignoreFilePath = path.join(codexBasePath, '.claudeignore');
    await createClaudeIgnoreFile(ignoreFilePath);

    // 6. 创建 README.md 说明文件
    const readmePath = path.join(codexBasePath, 'README.md');
    await createReadmeFile(readmePath);

    console.log('Codex workspace initialized successfully at:', codexBasePath);
  } catch (error) {
    console.error('Failed to initialize Codex workspace:', error);
    throw new Error(`Codex工作空间初始化失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 创建目录（如果不存在）
 *
 * @param dirPath 目录路径
 */
async function createDirectory(dirPath: string): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
  } catch (error) {
    // 目录已存在时忽略错误
    if (error instanceof vscode.FileSystemError && error.code === 'FileExists') {
      return;
    }
    throw error;
  }
}

/**
 * 创建MCP配置文件
 *
 * @param filePath 文件路径
 */
async function createMCPConfigFile(filePath: string): Promise<void> {
  // 检查文件是否已存在
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    // 文件已存在，不覆盖
    console.log('MCP config file already exists, skipping:', filePath);
    return;
  } catch {
    // 文件不存在，继续创建
  }

  const defaultConfig: MCPConfig = {
    port: 8765,
    timeout: 300000, // 5分钟
    logLevel: 'info',
    healthCheckInterval: 30, // 30秒
    autoRestart: {
      enabled: true,
      maxRetries: 3,
      retryInterval: 10000 // 10秒
    }
  };

  const configContent = JSON.stringify(defaultConfig, null, 2);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(configContent, 'utf-8')
  );
}

/**
 * 创建会话记录文件
 *
 * @param filePath 文件路径
 */
async function createSessionsFile(filePath: string): Promise<void> {
  // 检查文件是否已存在
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    // 文件已存在，不覆盖
    console.log('Sessions file already exists, skipping:', filePath);
    return;
  } catch {
    // 文件不存在，继续创建
  }

  const defaultSessions: SessionsRecord = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    sessions: []
  };

  const sessionsContent = JSON.stringify(defaultSessions, null, 2);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(sessionsContent, 'utf-8')
  );
}

/**
 * 创建.claudeignore模板文件
 *
 * @param filePath 文件路径
 */
async function createClaudeIgnoreFile(filePath: string): Promise<void> {
  // 检查文件是否已存在
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    // 文件已存在，不覆盖
    console.log('Claudeignore file already exists, skipping:', filePath);
    return;
  } catch {
    // 文件不存在，继续创建
  }

  const ignoreContent = `# Codex工作空间忽略文件
# 指定哪些文件和目录应该被Codex扫描时排除

# 依赖目录
node_modules/
vendor/
.venv/
venv/

# 构建输出
dist/
build/
out/
*.min.js
*.map

# 临时文件
*.tmp
*.temp
.DS_Store
Thumbs.db

# 敏感文件（已在security配置中定义，此处作为提醒）
.env
*.key
credentials.json
*.pem
*.p12

# 大型数据文件
*.log
*.sql
*.db
*.sqlite

# 测试覆盖报告
coverage/
.nyc_output/

# IDE配置
.vscode/
.idea/
*.swp
*.swo
`;

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(ignoreContent, 'utf-8')
  );
}

/**
 * 创建README说明文件
 *
 * @param filePath 文件路径
 */
async function createReadmeFile(filePath: string): Promise<void> {
  // 检查文件是否已存在
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    // 文件已存在，不覆盖
    console.log('README file already exists, skipping:', filePath);
    return;
  } catch {
    // 文件不存在，继续创建
  }

  const readmeContent = `# Codex工作空间

此目录包含Codex工作流编排系统的运行时数据和配置文件。

## 目录结构

\`\`\`
.claude/codex/
├── mcp-config.json          # MCP服务器配置
├── sessions.json            # 会话状态记录
├── .claudeignore            # 代码库扫描忽略规则
├── execution-history/       # 任务执行历史记录
│   └── {taskId}.log        # 单次执行的详细日志
└── README.md               # 本文件
\`\`\`

## 配置文件说明

### mcp-config.json

MCP（Model Context Protocol）服务器的配置文件，包含：
- **port**: 服务器监听端口（默认：8765）
- **timeout**: 连接超时时间（默认：300000ms = 5分钟）
- **logLevel**: 日志级别（debug/info/warn/error）
- **healthCheckInterval**: 健康检查间隔（秒）
- **autoRestart**: 自动重启配置

### sessions.json

记录所有Codex会话的状态信息，用于：
- 会话恢复和连续性
- 跨VSCode重启的状态保持
- 执行历史追踪

### .claudeignore

指定在代码库扫描时应排除的文件和目录模式。语法类似于 \`.gitignore\`。

## 执行历史

\`execution-history/\` 目录保存每次任务执行的完整日志，包括：
- MCP通信内容
- 推理步骤详情
- 文件操作记录
- 错误堆栈信息

日志文件以任务ID命名：\`{taskId}.log\`

## 维护建议

1. **定期清理**: 建议定期清理 \`execution-history/\` 中的旧日志文件（保留最近30天）
2. **备份配置**: 在修改 \`mcp-config.json\` 前建议先备份
3. **会话管理**: \`sessions.json\` 会自动清理超时会话（默认30分钟无活动）

## 注意事项

- ⚠️ **不要手动编辑 \`sessions.json\`**: 此文件由系统自动管理
- ⚠️ **不要删除此目录**: 删除会导致会话状态丢失
- ✅ **可以安全修改 \`.claudeignore\`**: 根据项目需求调整忽略规则
- ✅ **可以调整 \`mcp-config.json\`**: 但需确保配置有效

## 更多信息

查看完整文档：[Codex工作流编排系统文档](../../../docs/codex-workflow-orchestration.md)
`;

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(readmeContent, 'utf-8')
  );
}

/**
 * 检查Codex工作空间是否已初始化
 *
 * @param workspaceFolder 工作空间文件夹
 * @returns Promise<boolean> 如果已初始化返回true
 */
export async function isCodexWorkspaceInitialized(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<boolean> {
  const codexBasePath = path.join(workspaceFolder.uri.fsPath, '.claude', 'codex');
  const mcpConfigPath = path.join(codexBasePath, 'mcp-config.json');

  try {
    // 检查mcp-config.json是否存在作为初始化标志
    await vscode.workspace.fs.stat(vscode.Uri.file(mcpConfigPath));
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取Codex工作空间路径
 *
 * @param workspaceFolder 工作空间文件夹
 * @returns Codex工作空间的绝对路径
 */
export function getCodexWorkspacePath(workspaceFolder: vscode.WorkspaceFolder): string {
  return path.join(workspaceFolder.uri.fsPath, '.claude', 'codex');
}

/**
 * 获取执行历史目录路径
 *
 * @param workspaceFolder 工作空间文件夹
 * @returns 执行历史目录的绝对路径
 */
export function getExecutionHistoryPath(workspaceFolder: vscode.WorkspaceFolder): string {
  return path.join(getCodexWorkspacePath(workspaceFolder), 'execution-history');
}
