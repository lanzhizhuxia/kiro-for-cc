/**
 * SecurityGuard 单元测试
 *
 * 测试安全守卫的核心功能：
 * - 文件访问权限检查
 * - 危险命令拦截
 * - 敏感文件保护
 * - 内容脱敏
 * - 配置文件备份
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SecurityGuard, CommandCheckResult, AccessResult } from '../securityGuard';
import { ConfigManager } from '../../../utils/configManager';

// Mock vscode模块
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [
      {
        uri: {
          fsPath: '/test/workspace',
        },
      },
    ],
    openTextDocument: jest.fn(),
  },
  window: {
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showTextDocument: jest.fn(),
  },
  OutputChannel: jest.fn(),
}));

// Mock fs模块
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    copyFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

// Mock ConfigManager
jest.mock('../../../utils/configManager');

describe('SecurityGuard', () => {
  let securityGuard: SecurityGuard;
  let mockOutputChannel: any;
  let mockConfigManager: any;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();

    // Mock fs.existsSync默认返回false
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    // 创建mock OutputChannel
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
    };

    // Mock ConfigManager
    mockConfigManager = {
      getSettings: jest.fn().mockResolvedValue({
        codex: {
          security: {
            allowedPaths: [],
            requireShellConfirmation: true,
          },
        },
      }),
    } as any;

    (ConfigManager.getInstance as jest.Mock).mockReturnValue(mockConfigManager);

    // 创建SecurityGuard实例
    securityGuard = new SecurityGuard(mockOutputChannel);
  });

  describe('文件访问权限检查', () => {
    describe('checkFileAccess', () => {
      beforeEach(() => {
        // Mock fs.existsSync返回false（没有.claudeignore文件）
        (fs.existsSync as jest.Mock).mockReturnValue(false);
      });

      it('应该允许访问普通文件', async () => {
        const result = await securityGuard.checkFileAccess('/test/workspace/src/index.ts');

        expect(result.allowed).toBe(true);
        expect(result.requiresSanitization).toBe(false);
      });

      it('应该标记敏感文件需要脱敏', async () => {
        const sensitiveFiles = [
          '/test/workspace/.env',
          '/test/workspace/.env.local',
          '/test/workspace/credentials.json',
          '/test/workspace/secrets.json',
          '/test/workspace/.ssh/id_rsa',
          '/test/workspace/.aws/credentials',
          '/test/workspace/.npmrc',
        ];

        for (const filePath of sensitiveFiles) {
          const result = await securityGuard.checkFileAccess(filePath);

          expect(result.allowed).toBe(true);
          expect(result.requiresSanitization).toBe(true);
          expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
            expect.stringContaining('Sensitive file access logged')
          );
        }
      });

      it('应该拦截.claudeignore中的文件', async () => {
        // Mock .claudeignore文件存在
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.promises.readFile as jest.Mock).mockResolvedValue(
          'node_modules/\n*.log\n.git/\n# Comment line\n'
        );

        // 重新创建实例以加载.claudeignore
        securityGuard = new SecurityGuard(mockOutputChannel);

        // 手动调用reloadConfig以确保配置加载完成
        await securityGuard.reloadConfig();

        const result = await securityGuard.checkFileAccess('/test/workspace/node_modules/some-package/index.js');

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('.claudeignore');
      });

      it('应该使用白名单限制访问', async () => {
        // Mock配置返回白名单
        mockConfigManager.getSettings.mockResolvedValue({
          codex: {
            security: {
              allowedPaths: ['src/**', 'tests/**'],
              requireShellConfirmation: true,
            },
          },
        } as any);

        // 重新创建实例以加载配置
        securityGuard = new SecurityGuard(mockOutputChannel);
        await securityGuard.reloadConfig();

        // 白名单内的文件应该允许访问
        const allowedResult = await securityGuard.checkFileAccess('/test/workspace/src/index.ts');
        expect(allowedResult.allowed).toBe(true);

        // 白名单外的文件应该被拒绝
        const deniedResult = await securityGuard.checkFileAccess('/test/workspace/config/secret.json');
        expect(deniedResult.allowed).toBe(false);
        expect(deniedResult.reason).toContain('allowed paths');
      });
    });
  });

  describe('Shell命令安全检查', () => {
    describe('checkCommandExecution', () => {
      beforeEach(() => {
        // Mock fs operations for logging
        (fs.promises.readFile as jest.Mock).mockResolvedValue('[]');
        (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
        (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      });

      it('应该拦截危险命令并请求用户确认', async () => {
        // Mock用户拒绝
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('拒绝');

        const result = await securityGuard.checkCommandExecution('rm -rf /');

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('dangerous');
        expect(result.requiresConfirmation).toBe(true);
        expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      });

      it('应该允许危险命令如果用户确认', async () => {
        // Mock用户允许
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('允许');

        const result = await securityGuard.checkCommandExecution('sudo apt-get install package');

        expect(result.allowed).toBe(true);
        expect(result.requiresConfirmation).toBe(true);
      });

      it('应该根据配置决定是否需要确认普通命令', async () => {
        // 需要确认
        mockConfigManager.getSettings.mockResolvedValue({
          codex: {
            security: {
              requireShellConfirmation: true,
            },
          },
        } as any);

        let result = await securityGuard.checkCommandExecution('ls -la');
        expect(result.allowed).toBe(true);
        expect(result.requiresConfirmation).toBe(true);

        // 不需要确认
        mockConfigManager.getSettings.mockResolvedValue({
          codex: {
            security: {
              requireShellConfirmation: false,
            },
          },
        } as any);

        result = await securityGuard.checkCommandExecution('ls -la');
        expect(result.allowed).toBe(true);
        expect(result.requiresConfirmation).toBe(false);
      });
    });
  });

  describe('内容脱敏', () => {
    describe('sanitizeContent', () => {
      it('应该脱敏API密钥', () => {
        const content = `
          const config = {
            api_key: "sk-1234567890abcdef",
            apiKey: "AIzaSyD1234567890",
            access_key: "AKIAIOSFODNN7EXAMPLE"
          };
        `;

        const sanitized = securityGuard.sanitizeContent(content, 'typescript');

        expect(sanitized).toContain('***REDACTED***');
        expect(sanitized).not.toContain('sk-1234567890abcdef');
        expect(sanitized).not.toContain('AIzaSyD1234567890');
      });

      it('应该脱敏密码', () => {
        const content = `
          const db = {
            password: "secretpassword123",
            passwd: "hunter2",
            pwd: "p@ssw0rd"
          };
        `;

        const sanitized = securityGuard.sanitizeContent(content, 'typescript');

        expect(sanitized).toContain('***REDACTED***');
        expect(sanitized).not.toContain('secretpassword123');
        expect(sanitized).not.toContain('hunter2');
        expect(sanitized).not.toContain('p@ssw0rd');
      });

      it('应该脱敏Token', () => {
        const content = `
          const headers = {
            token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
            auth_token: "Bearer abc123def456",
            bearer: "ghij789klmn012"
          };
        `;

        const sanitized = securityGuard.sanitizeContent(content, 'typescript');

        expect(sanitized).toContain('***REDACTED***');
        expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      });

      it('应该脱敏数据库连接串', () => {
        const content = `
          const dbUrl = "mongodb://admin:password123@localhost:27017/mydb";
          const mysqlUrl = "mysql://root:secret@localhost:3306/database";
        `;

        const sanitized = securityGuard.sanitizeContent(content, 'typescript');

        expect(sanitized).toContain('***REDACTED***');
        expect(sanitized).not.toContain('password123');
        expect(sanitized).not.toContain('secret');
      });

      it('应该脱敏AWS密钥', () => {
        const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';

        const sanitized = securityGuard.sanitizeContent(content, 'env');

        expect(sanitized).toContain('***REDACTED_AWS_KEY***');
        expect(sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE');
      });

      it('应该脱敏私钥内容', () => {
        const content = `
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdef
ghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----
        `;

        const sanitized = securityGuard.sanitizeContent(content, 'pem');

        expect(sanitized).toContain('***REDACTED***');
        expect(sanitized).toContain('BEGIN RSA PRIVATE KEY');
        expect(sanitized).toContain('END RSA PRIVATE KEY');
        expect(sanitized).not.toContain('MIIEpAIBAAKCAQEA1234567890abcdef');
      });
    });
  });

  describe('配置文件保护', () => {
    describe('checkAndBackupConfigFile', () => {
      beforeEach(() => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.promises.copyFile as jest.Mock).mockResolvedValue(undefined);
        (fs.promises.readFile as jest.Mock).mockResolvedValue('[]');
        (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
        (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      });

      it('应该识别配置文件并创建备份', async () => {
        // Mock用户允许
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('允许修改');
        (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

        const newContent = '{ "name": "updated" }';
        const result = await securityGuard.checkAndBackupConfigFile('/test/workspace/package.json', newContent);

        expect(result).toBe(true);
        expect(fs.promises.copyFile).toHaveBeenCalled();
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Backup created')
        );
      });

      it('应该在用户拒绝时返回false', async () => {
        // Mock用户拒绝
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('拒绝修改');

        const newContent = '{ "name": "updated" }';
        const result = await securityGuard.checkAndBackupConfigFile('/test/workspace/package.json', newContent);

        expect(result).toBe(false);
      });

      it('对于非配置文件应该直接返回true', async () => {
        const newContent = 'const x = 1;';
        const result = await securityGuard.checkAndBackupConfigFile('/test/workspace/src/index.ts', newContent);

        expect(result).toBe(true);
        expect(fs.promises.copyFile).not.toHaveBeenCalled();
      });

      it('应该在备份失败时返回false', async () => {
        // Mock备份失败
        (fs.promises.copyFile as jest.Mock).mockRejectedValue(new Error('Permission denied'));

        const newContent = '{ "name": "updated" }';
        const result = await securityGuard.checkAndBackupConfigFile('/test/workspace/package.json', newContent);

        expect(result).toBe(false);
        expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      });
    });
  });

  describe('配置重新加载', () => {
    describe('reloadConfig', () => {
      it('应该重新加载.claudeignore和白名单配置', async () => {
        // Mock .claudeignore文件
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.promises.readFile as jest.Mock).mockResolvedValue('dist/\nbuild/\n');

        // Mock配置
        mockConfigManager.getSettings.mockResolvedValue({
          codex: {
            security: {
              allowedPaths: ['src/**', 'tests/**'],
              requireShellConfirmation: true,
            },
          },
        } as any);

        await securityGuard.reloadConfig();

        expect(fs.promises.readFile).toHaveBeenCalled();
        expect(mockConfigManager.getSettings).toHaveBeenCalled();
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Loaded')
        );
      });
    });
  });

  describe('Glob模式匹配', () => {
    it('应该正确匹配简单glob模式', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readFile as jest.Mock).mockResolvedValue('*.log\n');

      securityGuard = new SecurityGuard(mockOutputChannel);
      await new Promise(resolve => setTimeout(resolve, 100));

      const result1 = await securityGuard.checkFileAccess('/test/workspace/app.log');
      expect(result1.allowed).toBe(false);

      const result2 = await securityGuard.checkFileAccess('/test/workspace/app.ts');
      expect(result2.allowed).toBe(true);
    });

    it('应该正确匹配目录glob模式', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readFile as jest.Mock).mockResolvedValue('node_modules/\n');

      securityGuard = new SecurityGuard(mockOutputChannel);
      await securityGuard.reloadConfig();

      const result = await securityGuard.checkFileAccess('/test/workspace/node_modules/package/index.js');
      expect(result.allowed).toBe(false);
    });

    it('应该正确匹配递归glob模式', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readFile as jest.Mock).mockResolvedValue('**/*.test.ts\n');

      securityGuard = new SecurityGuard(mockOutputChannel);
      await new Promise(resolve => setTimeout(resolve, 100));

      const result1 = await securityGuard.checkFileAccess('/test/workspace/src/utils/helper.test.ts');
      expect(result1.allowed).toBe(false);

      const result2 = await securityGuard.checkFileAccess('/test/workspace/src/utils/helper.ts');
      expect(result2.allowed).toBe(true);
    });
  });

  describe('安全日志记录', () => {
    it('应该记录敏感文件访问', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.promises.readFile as jest.Mock).mockResolvedValue('[]');
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);

      await securityGuard.checkFileAccess('/test/workspace/.env');

      // 等待异步日志写入
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(fs.promises.writeFile).toHaveBeenCalled();

      const writeCall = (fs.promises.writeFile as jest.Mock).mock.calls[0];
      expect(writeCall[0]).toContain('security-log.json');

      const logData = JSON.parse(writeCall[1]);
      expect(logData).toBeInstanceOf(Array);
      expect(logData[0]).toMatchObject({
        file: '/test/workspace/.env',
        operation: 'read',
        denied: false,
      });
    });

    it('应该记录被拒绝的访问', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readFile as jest.Mock)
        .mockResolvedValueOnce('.env\n')  // .claudeignore
        .mockResolvedValueOnce('[]');     // security-log.json
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);

      securityGuard = new SecurityGuard(mockOutputChannel);
      await new Promise(resolve => setTimeout(resolve, 100));

      await securityGuard.checkFileAccess('/test/workspace/.env');

      // 等待异步日志写入
      await new Promise(resolve => setTimeout(resolve, 100));

      const writeCall = (fs.promises.writeFile as jest.Mock).mock.calls.find(
        call => call[0].includes('security-log.json')
      );

      expect(writeCall).toBeDefined();
      const logData = JSON.parse(writeCall[1]);
      expect(logData[logData.length - 1]).toMatchObject({
        denied: true,
        reason: expect.stringContaining('.claudeignore'),
      });
    });
  });
});
