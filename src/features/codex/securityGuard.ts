/**
 * SecurityGuard - 安全守卫
 *
 * 职责：
 * - 控制Codex的文件访问权限
 * - 拦截危险操作
 * - 保护敏感文件
 * - 记录安全审计日志
 *
 * 核心功能：
 * 1. 文件访问权限检查（基于.claudeignore和白名单）
 * 2. Shell命令安全检查（拦截危险命令）
 * 3. 敏感文件保护和内容脱敏
 * 4. 配置文件修改保护（自动备份）
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../../utils/configManager';

/**
 * 命令检查结果
 */
export interface CommandCheckResult {
  /** 是否允许执行 */
  allowed: boolean;
  /** 拒绝原因（如果不允许） */
  reason?: string;
  /** 是否需要用户确认 */
  requiresConfirmation: boolean;
}

/**
 * 文件访问结果
 */
export interface AccessResult {
  /** 是否允许访问 */
  allowed: boolean;
  /** 拒绝原因（如果不允许） */
  reason?: string;
  /** 是否需要脱敏处理 */
  requiresSanitization: boolean;
}

/**
 * 安全审计日志条目
 */
interface SecurityLogEntry {
  /** 时间戳 */
  timestamp: string;
  /** 文件路径 */
  file: string;
  /** 操作类型 */
  operation: 'read' | 'write' | 'command';
  /** 用户 */
  user: string;
  /** 是否被拒绝 */
  denied?: boolean;
  /** 拒绝原因 */
  reason?: string;
}

/**
 * SecurityGuard类
 * 实现安全访问控制和危险操作拦截
 */
export class SecurityGuard {
  private configManager: ConfigManager;
  private outputChannel: vscode.OutputChannel;

  /** 敏感文件模式列表 */
  private readonly sensitivePatterns: RegExp[] = [
    /\.env$/,
    /\.env\..+$/,
    /credentials\.json$/,
    /secrets\.json$/,
    /\.ssh\//,
    /\.aws\//,
    /\.npmrc$/,
    /\.pypirc$/,
    /\.gitconfig$/,
    /id_rsa$/,
    /id_ed25519$/,
    /\.pem$/,
    /\.key$/,
    /\.p12$/,
    /\.pfx$/,
    // 新增模式
    /password[s]?\.txt$/,
    /token[s]?\.json$/,
    /api[-_]?key[s]?\.json$/,
    /\.kube\/config$/,
    /\.docker\/config\.json$/,
    /service[-_]?account\.json$/,  // GCP service account
    /\.pgpass$/,  // PostgreSQL password file
    /\.my\.cnf$/,  // MySQL config
  ];

  /** 内容模式检测（基于文件内容而非文件名） */
  private readonly contentSensitivePatterns: Array<{
    name: string;
    pattern: RegExp;
    description: string;
  }> = [
    {
      name: 'private-key',
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      description: 'SSH/TLS私钥'
    },
    {
      name: 'aws-key',
      pattern: /AKIA[0-9A-Z]{16}/,
      description: 'AWS访问密钥'
    },
    {
      name: 'connection-string',
      pattern: /(mongodb|mysql|postgres|redis):\/\/[^:]+:[^@]+@/i,
      description: '数据库连接字符串（包含密码）'
    },
    {
      name: 'jwt-token',
      pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
      description: 'JWT token'
    },
    {
      name: 'generic-secret',
      pattern: /(secret|password|token|api[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
      description: '通用密钥/密码'
    }
  ];

  /** 危险命令模式列表 */
  private readonly dangerousPatterns: Array<{
    pattern: RegExp;
    reason: string;
    severity: 'critical' | 'high' | 'medium';
  }> = [
    // Critical - 极度危险,可能造成数据丢失或系统破坏
    { pattern: /rm\s+-rf\s+[\/~]/, reason: '删除根目录或用户主目录', severity: 'critical' },
    { pattern: /sudo\s+rm/, reason: 'sudo删除文件', severity: 'critical' },
    { pattern: /mkfs/, reason: '格式化磁盘', severity: 'critical' },
    { pattern: />\s*\/dev\//, reason: '直接写入设备文件', severity: 'critical' },
    { pattern: /dd\s+if=.*of=\/dev\//, reason: 'dd命令写入设备', severity: 'critical' },
    { pattern: /:\(\)\{.*:\|:&\};:/, reason: 'Fork炸弹攻击', severity: 'critical' },

    // High - 高风险,可能带来严重安全问题
    { pattern: /chmod\s+777/, reason: '设置过于宽松的权限', severity: 'high' },
    { pattern: /dd\s+if=/, reason: 'dd命令可能覆写数据', severity: 'high' },
    { pattern: /curl[^|]*\|\s*(ba)?sh/, reason: '下载并执行脚本', severity: 'high' },
    { pattern: /wget[^|]*\|\s*sh/, reason: '下载并执行脚本', severity: 'high' },
    { pattern: /sudo\s+/, reason: '以超级用户权限执行命令', severity: 'high' },
    { pattern: /chmod\s+-R/, reason: '递归修改文件权限', severity: 'high' },
    { pattern: /chown\s+-R/, reason: '递归修改文件所有者', severity: 'high' },

    // Medium - 中等风险,需要用户注意
    { pattern: /eval\s+/, reason: '动态执行代码', severity: 'medium' },
    { pattern: /exec\s+/, reason: '替换当前进程', severity: 'medium' },
    { pattern: />\s*\/etc\//, reason: '修改系统配置目录', severity: 'medium' },
    { pattern: /rm\s+-rf/, reason: '强制递归删除', severity: 'medium' },
  ];

  /** 配置文件模式列表 */
  private readonly configFilePatterns: RegExp[] = [
    /package\.json$/,
    /tsconfig\.json$/,
    /\.vscode\//,
    /\.claudeignore$/,
    /settings\.json$/,
    /launch\.json$/,
    // 新增配置文件模式
    /webpack\.config\./,
    /rollup\.config\./,
    /vite\.config\./,
    /jest\.config\./,
    /babel\.config\./,
    /\.eslintrc/,
    /\.prettierrc/,
    /tsconfig.*\.json$/,
    /\.babelrc$/,
    /\.eslintignore$/,
    /\.prettierignore$/,
    /\.npmrc$/,
    /\.yarnrc$/,
    /\.editorconfig$/,
    /\.dockerignore$/,
    /Dockerfile$/,
    /docker-compose\.ya?ml$/,
    /\.gitignore$/,
    /\.gitattributes$/,
  ];

  /** .claudeignore规则缓存 */
  private claudeignoreRules: string[] = [];

  /** 白名单路径缓存 */
  private allowedPaths: string[] = [];

  constructor(outputChannel: vscode.OutputChannel) {
    this.configManager = ConfigManager.getInstance();
    this.outputChannel = outputChannel;

    // 初始化时加载配置（异步，但不阻塞构造）
    this._loadClaudeignore().catch(err => {
      this.outputChannel.appendLine(`[SecurityGuard] Failed to load .claudeignore: ${err}`);
    });
    this._loadAllowedPaths().catch(err => {
      this.outputChannel.appendLine(`[SecurityGuard] Failed to load allowed paths: ${err}`);
    });
  }

  /**
   * 检查文件访问权限
   * @param filePath 文件路径
   * @returns 访问检查结果
   */
  async checkFileAccess(filePath: string): Promise<AccessResult> {
    // 1. 检查是否在.claudeignore中
    if (await this._isIgnored(filePath)) {
      this.outputChannel.appendLine(`[SecurityGuard] File blocked by .claudeignore: ${filePath}`);
      await this._logSecurityEvent(filePath, 'read', true, 'Blocked by .claudeignore');
      return {
        allowed: false,
        reason: 'File is excluded by .claudeignore',
        requiresSanitization: false,
      };
    }

    // 2. 检查文件名是否匹配敏感模式
    const isSensitiveByName = this._isSensitiveFile(filePath);

    // 3. 如果文件存在，读取内容检查
    let isSensitiveByContent = false;
    let detectedPatterns: string[] = [];

    if (fs.existsSync(filePath)) {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const contentCheck = this._detectSensitiveContent(content);
        isSensitiveByContent = contentCheck.isSensitive;
        detectedPatterns = contentCheck.patterns;
      } catch (error) {
        // 如果读取失败（如二进制文件），仅依赖文件名检测
        this.outputChannel.appendLine(`[SecurityGuard] Could not read file content for analysis: ${filePath}`);
      }
    }

    const isSensitive = isSensitiveByName || isSensitiveByContent;

    if (isSensitive) {
      this.outputChannel.appendLine(
        `[SecurityGuard] Sensitive file detected: ${filePath}`
      );
      if (detectedPatterns.length > 0) {
        this.outputChannel.appendLine(
          `[SecurityGuard] Detected patterns: ${detectedPatterns.join(', ')}`
        );
      }

      await this._logSecurityEvent(
        filePath,
        'read',
        false,
        `Sensitive file (${detectedPatterns.join(', ') || 'by filename'})`
      );

      // 记录敏感文件访问
      await this._logSensitiveFileAccess(filePath, detectedPatterns);

      return {
        allowed: true,
        requiresSanitization: true,
        reason: detectedPatterns.length > 0
          ? `File contains: ${detectedPatterns.join(', ')}`
          : 'Sensitive file by name pattern'
      };
    }

    // 4. 检查是否在允许列表中（如果配置了白名单）
    if (this.allowedPaths.length > 0) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const relativePath = path.relative(workspaceRoot, filePath);

      const isAllowed = this.allowedPaths.some(pattern => {
        const regex = this._globToRegex(pattern);
        return regex.test(relativePath);
      });

      if (!isAllowed) {
        this.outputChannel.appendLine(`[SecurityGuard] File not in allowed paths: ${filePath}`);
        await this._logSecurityEvent(filePath, 'read', true, 'Not in allowed paths');
        return {
          allowed: false,
          reason: 'File is not in the allowed paths list',
          requiresSanitization: false,
        };
      }
    }

    // 5. 默认允许
    return {
      allowed: true,
      requiresSanitization: false,
    };
  }

  /**
   * 检查Shell命令是否安全
   * @param command Shell命令
   * @returns 命令检查结果
   */
  async checkCommandExecution(command: string): Promise<CommandCheckResult> {
    // 1. 检查是否匹配危险命令模式
    let matchedPattern: { pattern: RegExp; reason: string; severity: 'critical' | 'high' | 'medium' } | null = null;

    for (const dangerousPattern of this.dangerousPatterns) {
      if (dangerousPattern.pattern.test(command)) {
        matchedPattern = dangerousPattern;
        break; // 找到第一个匹配的模式就停止
      }
    }

    if (matchedPattern) {
      this.outputChannel.appendLine(`[SecurityGuard] Dangerous command detected: ${command}`);
      this.outputChannel.appendLine(`[SecurityGuard] Reason: ${matchedPattern.reason}`);
      this.outputChannel.appendLine(`[SecurityGuard] Severity: ${matchedPattern.severity}`);

      // 根据严重级别显示不同的警告信息
      let message: string;
      let iconPrefix: string;

      switch (matchedPattern.severity) {
        case 'critical':
          iconPrefix = '🔴 危险警告';
          message = `${iconPrefix}\n\nCodex正在尝试执行一个极度危险的命令!\n\n命令: ${command}\n风险: ${matchedPattern.reason}\n等级: ${matchedPattern.severity.toUpperCase()}\n\n此操作可能导致数据丢失或系统破坏。\n强烈建议拒绝执行。\n\n是否仍要允许执行?`;
          break;
        case 'high':
          iconPrefix = '🟡 高风险警告';
          message = `${iconPrefix}\n\nCodex正在尝试执行一个高风险命令。\n\n命令: ${command}\n风险: ${matchedPattern.reason}\n等级: ${matchedPattern.severity.toUpperCase()}\n\n此操作可能带来严重安全问题。\n请仔细确认后再决定。\n\n是否允许执行?`;
          break;
        case 'medium':
          iconPrefix = '⚠️ 警告';
          message = `${iconPrefix}\n\nCodex正在尝试执行一个需要注意的命令。\n\n命令: ${command}\n风险: ${matchedPattern.reason}\n等级: ${matchedPattern.severity.toUpperCase()}\n\n是否允许执行?`;
          break;
      }

      const confirmed = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        '允许执行',
        '拒绝'
      );

      const allowed = confirmed === '允许执行';

      // 记录安全日志
      await this._logCommandSecurityEvent(
        command,
        matchedPattern.reason,
        matchedPattern.severity,
        allowed
      );

      return {
        allowed,
        reason: allowed ? undefined : `Dangerous command blocked: ${matchedPattern.reason}`,
        requiresConfirmation: true,
      };
    }

    // 2. 其他命令根据配置决定是否需要确认
    const settings = await this.configManager.getSettings();
    const requireConfirmation = settings.codex?.security?.requireShellConfirmation ?? true;

    if (requireConfirmation) {
      return {
        allowed: true,
        requiresConfirmation: true,
      };
    }

    return {
      allowed: true,
      requiresConfirmation: false,
    };
  }

  /**
   * 脱敏处理敏感文件内容
   * @param content 原始内容
   * @param fileType 文件类型
   * @returns 脱敏后的内容
   */
  sanitizeContent(content: string, fileType: string): string {
    let sanitized = content;

    // Special handling for .env files - preserve AWS keys pattern matching
    const isEnvFile = (fileType === 'env' || fileType === '.env');

    // 1. 私钥脱敏
    sanitized = sanitized.replace(
      /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)([\s\S]*?)(-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/g,
      '$1\n***REDACTED PRIVATE KEY***\n$3'
    );

    // 2. AWS密钥脱敏 (before generic env processing)
    sanitized = sanitized.replace(
      /AKIA[0-9A-Z]{16}/g,
      '***REDACTED_AWS_KEY***'
    );

    // 3. AWS Secret Key脱敏
    sanitized = sanitized.replace(
      /(aws_secret_access_key\s*[:=]\s*)([^\s\n]+)/gi,
      '$1***REDACTED***'
    );

    // 4. API密钥脱敏（多种格式）
    const apiKeyPatterns = [
      /(['"]?(?:api[_-\s]?key|apikey|access[_-\s]?key|secret[_-\s]?key)['"]?\s*[:=]\s*)(['"][^'"]+['"]|[^\s,;]+)/gi,
      /(x-api-key\s*[:=]\s*)(.+)$/gmi,  // Match entire line after x-api-key
      /(authorization\s*[:=]\s*(?:bearer|basic)\s+)([^\s\n]+)/gi
    ];

    for (const pattern of apiKeyPatterns) {
      sanitized = sanitized.replace(pattern, '$1***REDACTED***');
    }

    // 5. 密码脱敏
    sanitized = sanitized.replace(
      /(['"]?(?:password|passwd|pwd)['"]?\s*[:=]\s*)(['"][^'"]+['"]|[^\s,;]+)/gi,
      '$1***REDACTED***'
    );

    // 6. Token脱敏
    sanitized = sanitized.replace(
      /(['"]?(?:token|auth[_-]?token|bearer)['"]?\s*[:=]\s*)(['"][^'"]+['"]|[^\s,;]+)/gi,
      '$1***REDACTED***'
    );

    // 7. 数据库连接串脱敏（保留协议和主机，隐藏用户名密码）
    sanitized = sanitized.replace(
      /(mongodb|mysql|postgres|redis):\/\/([^:]+):([^@]+)@/gi,
      '$1://***REDACTED***:***REDACTED***@'
    );

    // 8. JWT Token脱敏
    sanitized = sanitized.replace(
      /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
      'eyJ***REDACTED_JWT_TOKEN***'
    );

    // 9. 通用密钥脱敏（key=value格式）
    sanitized = sanitized.replace(
      /((?:secret|private|confidential)[_-]?(?:key|value|data)?\s*[:=]\s*)(['"][^'"]{8,}['"]|[^\s,;]{8,})/gi,
      '$1***REDACTED***'
    );

    // 10. 环境变量格式脱敏（.env文件）
    // Note: This should come AFTER specific AWS/API key patterns to avoid double-replacement
    if (isEnvFile) {
      // Preserve KEY=, redact VALUE only if not already redacted
      sanitized = sanitized.replace(
        /^([A-Z_][A-Z0-9_]*\s*=\s*)(.+)$/gm,
        (match, key, value) => {
          // Skip if already redacted
          if (value.includes('***REDACTED')) {
            return match;
          }

          // Preserve non-sensitive values
          const nonSensitiveKeys = [
            'NODE_ENV', 'PORT', 'HOST', 'DEBUG', 'LOG_LEVEL'
          ];
          if (nonSensitiveKeys.some(k => key.toUpperCase().includes(k))) {
            return match;
          }
          return `${key}***REDACTED***`;
        }
      );
    }

    // 11. JSON格式特殊处理
    if (fileType === 'json') {
      try {
        const obj = JSON.parse(content);
        const sanitizedObj = this._sanitizeJSON(obj);
        // Also apply string-based sanitization to catch patterns in values
        let jsonResult = JSON.stringify(sanitizedObj, null, 2);
        // Re-apply AWS key pattern (in case it's in a string value)
        jsonResult = jsonResult.replace(/AKIA[0-9A-Z]{16}/g, '***REDACTED_AWS_KEY***');
        return jsonResult;
      } catch {
        // 如果不是有效JSON，继续使用正则脱敏
      }
    }

    return sanitized;
  }

  /**
   * 检查并备份配置文件（在修改前调用）
   * @param filePath 文件路径
   * @param newContent 新内容
   * @returns 是否允许修改
   */
  async checkAndBackupConfigFile(filePath: string, newContent: string): Promise<boolean> {
    // 1. 检查是否是配置文件
    if (!this._isConfigFile(filePath)) {
      return true; // 不是配置文件，无需特殊处理
    }

    this.outputChannel.appendLine(
      `[SecurityGuard] Config file modification detected: ${filePath}`
    );

    // 2. 创建备份
    const backupCreated = await this._createBackup(filePath);
    if (!backupCreated) {
      vscode.window.showErrorMessage('创建备份失败，修改已取消');
      return false;
    }

    // 3. 读取旧内容
    let oldContent = '';
    if (fs.existsSync(filePath)) {
      oldContent = await fs.promises.readFile(filePath, 'utf-8');
    }

    // 4. 生成diff
    const diff = this._generateDiff(oldContent, newContent);

    // 5. 显示确认对话框（包含diff）
    const confirmed = await this._showConfigModificationDialog(
      path.basename(filePath),
      diff
    );

    // 6. 记录日志
    await this._logSecurityEvent(
      filePath,
      'write',
      !confirmed,
      confirmed ? undefined : 'User denied config modification'
    );

    return confirmed;
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<void> {
    await this._loadClaudeignore();
    await this._loadAllowedPaths();
  }

  // ==================== 私有方法 ====================

  /**
   * 加载.claudeignore规则
   */
  private async _loadClaudeignore(): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        this.claudeignoreRules = [];
        return;
      }

      const claudeignorePath = path.join(workspaceRoot, '.claudeignore');

      if (fs.existsSync(claudeignorePath)) {
        const content = await fs.promises.readFile(claudeignorePath, 'utf-8');
        this.claudeignoreRules = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#')); // 过滤空行和注释

        this.outputChannel.appendLine(`[SecurityGuard] Loaded ${this.claudeignoreRules.length} rules from .claudeignore`);
      } else {
        this.claudeignoreRules = [];
        this.outputChannel.appendLine('[SecurityGuard] No .claudeignore file found, using default rules');
      }
    } catch (error) {
      this.outputChannel.appendLine(`[SecurityGuard] Failed to load .claudeignore: ${error}`);
      this.claudeignoreRules = [];
    }
  }

  /**
   * 加载允许访问的路径列表
   */
  private async _loadAllowedPaths(): Promise<void> {
    try {
      const settings = await this.configManager.getSettings();
      this.allowedPaths = settings.codex?.security?.allowedPaths || [];
      this.outputChannel.appendLine(`[SecurityGuard] Loaded ${this.allowedPaths.length} allowed paths from config`);
    } catch (error) {
      this.outputChannel.appendLine(`[SecurityGuard] Failed to load allowed paths: ${error}`);
      this.allowedPaths = [];
    }
  }

  /**
   * 检查文件是否在.claudeignore中
   */
  private async _isIgnored(filePath: string): Promise<boolean> {
    if (this.claudeignoreRules.length === 0) {
      return false;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const relativePath = path.relative(workspaceRoot, filePath);

    return this.claudeignoreRules.some(pattern => {
      const regex = this._globToRegex(pattern);
      return regex.test(relativePath);
    });
  }

  /**
   * 检查是否是敏感文件
   */
  private _isSensitiveFile(filePath: string): boolean {
    return this.sensitivePatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * 检查是否是配置文件
   */
  private _isConfigFile(filePath: string): boolean {
    return this.configFilePatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * 将glob模式转换为正则表达式
   */
  private _globToRegex(glob: string): RegExp {
    // 简化的glob转正则实现
    let regex = glob
      .replace(/\./g, '\\.')      // 转义点
      .replace(/\*\*/g, '§§§')    // 临时标记 **
      .replace(/\*/g, '[^/]*')    // * 匹配非路径分隔符
      .replace(/§§§/g, '.*')      // ** 匹配任意字符
      .replace(/\?/g, '.');       // ? 匹配单个字符

    // 如果glob以 / 结尾，匹配该目录下的所有内容
    if (glob.endsWith('/')) {
      regex = `^${regex}.*`;
    } else {
      regex = `^${regex}$`;
    }

    return new RegExp(regex);
  }

  /**
   * 记录安全审计日志
   */
  private async _logSecurityEvent(
    file: string,
    operation: 'read' | 'write' | 'command',
    denied: boolean = false,
    reason?: string
  ): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const logPath = path.join(workspaceRoot, '.claude/codex/security-log.json');

    const logEntry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      file,
      operation,
      user: process.env.USER || process.env.USERNAME || 'unknown',
      denied,
      reason,
    };

    try {
      let logs: SecurityLogEntry[] = [];

      // 读取现有日志
      if (fs.existsSync(logPath)) {
        const content = await fs.promises.readFile(logPath, 'utf-8');
        logs = JSON.parse(content);
      }

      // 添加新日志
      logs.push(logEntry);

      // 限制日志条目数量（保留最近1000条）
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }

      // 确保目录存在
      await fs.promises.mkdir(path.dirname(logPath), { recursive: true });

      // 写入日志
      await fs.promises.writeFile(logPath, JSON.stringify(logs, null, 2));
    } catch (error) {
      this.outputChannel.appendLine(`[SecurityGuard] Failed to log security event: ${error}`);
    }
  }

  /**
   * 记录命令安全事件到日志
   * @param command 命令内容
   * @param reason 拦截原因
   * @param severity 严重级别
   * @param allowed 是否允许执行
   */
  private async _logCommandSecurityEvent(
    command: string,
    reason: string,
    severity: string,
    allowed: boolean
  ): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const logPath = path.join(workspaceRoot, '.claude/codex/security-log.json');

    interface CommandSecurityLogEntry {
      timestamp: string;
      command: string;
      reason: string;
      severity: string;
      allowed: boolean;
      user: string;
    }

    const logEntry: CommandSecurityLogEntry = {
      timestamp: new Date().toISOString(),
      command,
      reason,
      severity,
      allowed,
      user: process.env.USER || process.env.USERNAME || 'unknown',
    };

    try {
      let logs: any[] = [];

      // 读取现有日志
      if (fs.existsSync(logPath)) {
        const content = await fs.promises.readFile(logPath, 'utf-8');
        logs = JSON.parse(content);
      }

      // 添加新日志
      logs.push(logEntry);

      // 限制日志条目数量（保留最近1000条）
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }

      // 确保目录存在
      await fs.promises.mkdir(path.dirname(logPath), { recursive: true });

      // 写入日志
      await fs.promises.writeFile(logPath, JSON.stringify(logs, null, 2));

      this.outputChannel.appendLine(`[SecurityGuard] Command security event logged: ${allowed ? 'Allowed' : 'Denied'}`);
    } catch (error) {
      this.outputChannel.appendLine(`[SecurityGuard] Failed to log command security event: ${error}`);
    }
  }

  /**
   * 创建文件备份（增强版）
   */
  private async _createBackup(filePath: string): Promise<boolean> {
    const timestamp = Date.now();
    const backupPath = `${filePath}.backup-${timestamp}`;

    try {
      if (!fs.existsSync(filePath)) {
        // 文件不存在（新建），无需备份
        this.outputChannel.appendLine(
          `[SecurityGuard] No backup needed (file does not exist): ${filePath}`
        );
        return true;
      }

      // 复制文件到备份
      await fs.promises.copyFile(filePath, backupPath);

      this.outputChannel.appendLine(
        `[SecurityGuard] Backup created: ${backupPath}`
      );

      // 显示备份成功通知（带"查看备份"和"比较差异"按钮）
      vscode.window.showInformationMessage(
        `已创建配置文件备份: ${path.basename(backupPath)}`,
        '查看备份',
        '比较差异'
      ).then(async choice => {
        if (choice === '查看备份') {
          const doc = await vscode.workspace.openTextDocument(backupPath);
          await vscode.window.showTextDocument(doc);
        } else if (choice === '比较差异') {
          // 打开diff视图
          await vscode.commands.executeCommand(
            'vscode.diff',
            vscode.Uri.file(backupPath),
            vscode.Uri.file(filePath),
            `${path.basename(filePath)} (备份 ↔ 当前)`
          );
        }
      });

      return true;
    } catch (error) {
      this.outputChannel.appendLine(
        `[SecurityGuard] Failed to create backup: ${error}`
      );

      vscode.window.showErrorMessage(
        `创建备份失败: ${error instanceof Error ? error.message : String(error)}`
      );

      return false;
    }
  }

  /**
   * 检测文件内容是否包含敏感信息
   */
  private _detectSensitiveContent(content: string): {
    isSensitive: boolean;
    patterns: string[];
  } {
    const detectedPatterns: string[] = [];

    for (const { name, pattern, description } of this.contentSensitivePatterns) {
      if (pattern.test(content)) {
        detectedPatterns.push(description);
      }
    }

    return {
      isSensitive: detectedPatterns.length > 0,
      patterns: detectedPatterns
    };
  }

  /**
   * 递归脱敏JSON对象
   */
  private _sanitizeJSON(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this._sanitizeJSON(item));
    }

    const sanitized: any = {};
    const sensitiveKeys = [
      'password', 'passwd', 'secret', 'token', 'apikey', 'api_key',
      'private_key', 'access_key', 'secret_key', 'credentials',
      'auth', 'authorization'
    ];

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      const isSensitiveKey = sensitiveKeys.some(sk => keyLower.includes(sk));

      if (isSensitiveKey && typeof value === 'string') {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object') {
        sanitized[key] = this._sanitizeJSON(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 记录敏感文件访问
   */
  private async _logSensitiveFileAccess(
    filePath: string,
    patterns: string[]
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      file: filePath,
      operation: 'read',
      user: process.env.USER || process.env.USERNAME || 'unknown',
      sensitivePatterns: patterns,
      sanitized: true
    };

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const logPath = path.join(workspaceRoot, '.claude/codex/sensitive-access.log');

    try {
      await fs.promises.mkdir(path.dirname(logPath), { recursive: true });

      // 追加日志
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.promises.appendFile(logPath, logLine);
    } catch (error) {
      this.outputChannel.appendLine(
        `[SecurityGuard] Failed to log sensitive access: ${error}`
      );
    }
  }

  /**
   * 验证脱敏效果（用于测试和审计）
   */
  verifySanitization(
    original: string,
    sanitized: string
  ): {
    passed: boolean;
    leakedPatterns: string[];
    redactionCount: number;
  } {
    const leakedPatterns: string[] = [];
    let redactionCount = 0;

    // 检查是否仍包含敏感模式 (content patterns)
    for (const { name, pattern, description } of this.contentSensitivePatterns) {
      if (pattern.test(sanitized)) {
        leakedPatterns.push(description);
      }
    }

    // 额外检查常见的敏感key=value模式是否泄漏
    const additionalPatterns = [
      { pattern: /(password|passwd|pwd)\s*[:=]\s*[^\s*][^\s]+/i, desc: 'password值' },
      { pattern: /(api[_-]?key|apikey)\s*[:=]\s*[^\s*][^\s]+/i, desc: 'API密钥值' },
      { pattern: /(secret[_-]?key)\s*[:=]\s*[^\s*][^\s]+/i, desc: '密钥值' },
      { pattern: /(token|auth[_-]?token)\s*[:=]\s*[^\s*][^\s]+/i, desc: 'token值' }
    ];

    for (const { pattern, desc } of additionalPatterns) {
      if (pattern.test(sanitized)) {
        leakedPatterns.push(desc);
      }
    }

    // 统计脱敏次数
    const redactedMatches = sanitized.match(/\*\*\*REDACTED\*\*\*/g);
    redactionCount = redactedMatches ? redactedMatches.length : 0;

    return {
      passed: leakedPatterns.length === 0,
      leakedPatterns,
      redactionCount
    };
  }

  /**
   * 生成文件变更diff
   */
  private _generateDiff(oldContent: string, newContent: string): string {
    // 简单的行级diff
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const diff: string[] = [];
    const maxLines = Math.max(oldLines.length, newLines.length);
    let changesCount = 0;

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (oldLine !== newLine) {
        changesCount++;

        if (oldLines[i] !== undefined) {
          diff.push(`- ${oldLine}`);
        }
        if (newLines[i] !== undefined) {
          diff.push(`+ ${newLine}`);
        }
      }
    }

    if (changesCount === 0) {
      return '无变更';
    }

    return `变更行数: ${changesCount}\n\n${diff.join('\n')}`;
  }

  /**
   * 显示配置文件修改确认对话框
   */
  private async _showConfigModificationDialog(
    fileName: string,
    diff: string
  ): Promise<boolean> {
    // 限制diff长度（避免对话框过大）
    const truncatedDiff = diff.length > 500
      ? diff.substring(0, 500) + '\n...(省略更多变更)'
      : diff;

    const message = `Codex正在尝试修改配置文件: ${fileName}

已创建备份。

变更预览:
${truncatedDiff}

是否允许修改？`;

    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      '允许修改',
      '拒绝修改',
      '查看完整Diff'
    );

    if (choice === '查看完整Diff') {
      // 创建临时文件显示完整diff
      const os = await import('os');
      const tmpPath = path.join(
        os.tmpdir(),
        `codex-diff-${Date.now()}.txt`
      );
      await fs.promises.writeFile(tmpPath, diff);

      const doc = await vscode.workspace.openTextDocument(tmpPath);
      await vscode.window.showTextDocument(doc);

      // 再次询问
      return this._showConfigModificationDialog(fileName, diff);
    }

    return choice === '允许修改';
  }

  /**
   * 清理旧备份（可选功能）
   * @param filePath 配置文件路径
   * @param keepCount 保留备份数量，默认5
   */
  async cleanupOldBackups(filePath: string, keepCount: number = 5): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      const baseName = path.basename(filePath);
      const backupPattern = new RegExp(`^${baseName}\\.backup-(\\d+)$`);

      // 查找所有备份文件
      const files = await fs.promises.readdir(dir);
      const backups = files
        .filter(f => backupPattern.test(f))
        .map(f => {
          const match = f.match(backupPattern);
          return {
            name: f,
            timestamp: parseInt(match![1], 10),
            path: path.join(dir, f)
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp); // 按时间倒序

      // 删除超出保留数量的旧备份
      if (backups.length > keepCount) {
        const toDelete = backups.slice(keepCount);

        for (const backup of toDelete) {
          await fs.promises.unlink(backup.path);
          this.outputChannel.appendLine(
            `[SecurityGuard] Deleted old backup: ${backup.name}`
          );
        }

        vscode.window.showInformationMessage(
          `已清理 ${toDelete.length} 个旧备份，保留最近 ${keepCount} 个`
        );
      }
    } catch (error) {
      this.outputChannel.appendLine(
        `[SecurityGuard] Failed to cleanup backups: ${error}`
      );
    }
  }

  /**
   * 恢复备份
   */
  async restoreBackup(backupPath: string): Promise<boolean> {
    try {
      // 提取原始文件路径
      const originalPath = backupPath.replace(/\.backup-\d+$/, '');

      // 确认恢复
      const confirmed = await vscode.window.showWarningMessage(
        `确定要从备份恢复文件吗？\n\n原文件: ${path.basename(originalPath)}\n备份: ${path.basename(backupPath)}\n\n当前内容将被覆盖。`,
        { modal: true },
        '恢复',
        '取消'
      );

      if (confirmed !== '恢复') {
        return false;
      }

      // 执行恢复
      await fs.promises.copyFile(backupPath, originalPath);

      vscode.window.showInformationMessage(
        `已从备份恢复: ${path.basename(originalPath)}`
      );

      this.outputChannel.appendLine(
        `[SecurityGuard] Restored from backup: ${backupPath} -> ${originalPath}`
      );

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        `恢复备份失败: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * 获取工作空间根目录
   */
  private _getWorkspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  }
}
