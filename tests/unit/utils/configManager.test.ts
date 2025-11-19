/**
 * ConfigManager单元测试
 *
 * 验证配置管理器的核心功能：
 * - Codex配置扩展
 * - 配置验证
 * - 配置迁移
 * - 配置加载和保存
 */

import { ConfigManager, KfcSettings, CodexSettings } from '../../../src/utils/configManager';
import * as vscode from 'vscode';
import * as path from 'path';

// Mock vscode module
jest.mock('vscode');

describe('ConfigManager - Codex Configuration Extension', () => {
  let configManager: ConfigManager;
  let mockWorkspaceFolder: vscode.WorkspaceFolder;

  beforeEach(() => {
    // Reset singleton instance
    (ConfigManager as any).instance = undefined;

    // Setup mock workspace folder
    mockWorkspaceFolder = {
      uri: {
        fsPath: '/mock/workspace',
        scheme: 'file',
        authority: '',
        path: '/mock/workspace',
        query: '',
        fragment: '',
        with: jest.fn(),
        toJSON: jest.fn()
      },
      name: 'mock-workspace',
      index: 0
    };

    // Mock vscode.workspace.workspaceFolders
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [mockWorkspaceFolder],
      writable: true,
      configurable: true
    });

    configManager = ConfigManager.getInstance();
  });

  describe('Default Codex Settings', () => {
    it('应该返回包含Codex默认配置的设置', () => {
      const settings = configManager.getSettings();

      expect(settings.codex).toBeDefined();
      expect(settings.codex?.defaultMode).toBe('auto');
      expect(settings.codex?.enableDeepThinking).toBe(true);
      expect(settings.codex?.enableCodebaseScan).toBe(true);
      expect(settings.codex?.timeout).toBe(300000);
    });

    it('应该返回有效的MCP默认配置', () => {
      const settings = configManager.getSettings();

      expect(settings.codex?.mcp).toBeDefined();
      expect(settings.codex?.mcp.port).toBe(8765);
      expect(settings.codex?.mcp.timeout).toBe(300000);
      expect(settings.codex?.mcp.logLevel).toBe('info');
    });

    it('应该返回有效的安全默认配置', () => {
      const settings = configManager.getSettings();

      expect(settings.codex?.security).toBeDefined();
      expect(Array.isArray(settings.codex?.security.allowedPaths)).toBe(true);
      expect(settings.codex?.security.allowedPaths).toContain('src/**');
      expect(settings.codex?.security.allowedPaths).toContain('docs/**');
      expect(settings.codex?.security.requireShellConfirmation).toBe(true);
      expect(Array.isArray(settings.codex?.security.sensitiveFilePatterns)).toBe(true);
      expect(settings.codex?.security.sensitiveFilePatterns).toContain('.env');
    });

    it('应该返回有效的性能默认配置', () => {
      const settings = configManager.getSettings();

      expect(settings.codex?.performance).toBeDefined();
      expect(settings.codex?.performance.maxConcurrency).toBe(3);
      expect(settings.codex?.performance.cacheTTL).toBe(86400000); // 24 hours
      expect(settings.codex?.performance.maxMemoryUsage).toBe(500);
    });
  });

  describe('validateCodexConfig()', () => {
    describe('Valid Configurations', () => {
      it('应该验证通过完整的有效配置', () => {
        const validConfig: CodexSettings = {
          defaultMode: 'auto',
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          mcp: {
            port: 8765,
            timeout: 300000,
            logLevel: 'info'
          },
          security: {
            allowedPaths: ['src/**'],
            requireShellConfirmation: true,
            sensitiveFilePatterns: ['.env']
          },
          performance: {
            maxConcurrency: 3,
            cacheTTL: 86400000,
            maxMemoryUsage: 500
          }
        };

        const result = configManager.validateCodexConfig(validConfig);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('应该允许undefined配置（Codex为可选）', () => {
        const result = configManager.validateCodexConfig(undefined);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('应该验证通过所有有效的defaultMode值', () => {
        const modes: Array<'local' | 'codex' | 'auto'> = ['local', 'codex', 'auto'];

        modes.forEach(mode => {
          const config: CodexSettings = {
            defaultMode: mode,
            enableDeepThinking: true,
            enableCodebaseScan: true,
            timeout: 300000,
            mcp: {
              port: 8765,
              timeout: 300000,
              logLevel: 'info'
            },
            security: {
              allowedPaths: [],
              requireShellConfirmation: true,
              sensitiveFilePatterns: []
            },
            performance: {
              maxConcurrency: 3,
              cacheTTL: 86400000,
              maxMemoryUsage: 500
            }
          };

          const result = configManager.validateCodexConfig(config);
          expect(result.valid).toBe(true);
        });
      });

      it('应该验证通过所有有效的logLevel值', () => {
        const logLevels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

        logLevels.forEach(logLevel => {
          const config: CodexSettings = {
            defaultMode: 'auto',
            enableDeepThinking: true,
            enableCodebaseScan: true,
            timeout: 300000,
            mcp: {
              port: 8765,
              timeout: 300000,
              logLevel: logLevel
            },
            security: {
              allowedPaths: [],
              requireShellConfirmation: true,
              sensitiveFilePatterns: []
            },
            performance: {
              maxConcurrency: 3,
              cacheTTL: 86400000,
              maxMemoryUsage: 500
            }
          };

          const result = configManager.validateCodexConfig(config);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('Invalid Configurations', () => {
      it('应该拒绝无效的defaultMode', () => {
        const config: any = {
          defaultMode: 'invalid',
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          mcp: { port: 8765, timeout: 300000, logLevel: 'info' },
          security: { allowedPaths: [], requireShellConfirmation: true, sensitiveFilePatterns: [] },
          performance: { maxConcurrency: 3, cacheTTL: 86400000, maxMemoryUsage: 500 }
        };

        const result = configManager.validateCodexConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('defaultMode'))).toBe(true);
      });

      it('应该拒绝超出范围的timeout', () => {
        const invalidTimeouts = [500, 700000]; // Too low and too high

        invalidTimeouts.forEach(timeout => {
          const config: any = {
            defaultMode: 'auto',
            enableDeepThinking: true,
            enableCodebaseScan: true,
            timeout: timeout,
            mcp: { port: 8765, timeout: 300000, logLevel: 'info' },
            security: { allowedPaths: [], requireShellConfirmation: true, sensitiveFilePatterns: [] },
            performance: { maxConcurrency: 3, cacheTTL: 86400000, maxMemoryUsage: 500 }
          };

          const result = configManager.validateCodexConfig(config);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('timeout'))).toBe(true);
        });
      });

      it('应该拒绝无效的MCP端口', () => {
        const invalidPorts = [100, 70000]; // Below 1024 and above 65535

        invalidPorts.forEach(port => {
          const config: any = {
            defaultMode: 'auto',
            enableDeepThinking: true,
            enableCodebaseScan: true,
            timeout: 300000,
            mcp: { port: port, timeout: 300000, logLevel: 'info' },
            security: { allowedPaths: [], requireShellConfirmation: true, sensitiveFilePatterns: [] },
            performance: { maxConcurrency: 3, cacheTTL: 86400000, maxMemoryUsage: 500 }
          };

          const result = configManager.validateCodexConfig(config);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('MCP port'))).toBe(true);
        });
      });

      it('应该拒绝无效的MCP logLevel', () => {
        const config: any = {
          defaultMode: 'auto',
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          mcp: { port: 8765, timeout: 300000, logLevel: 'invalid' },
          security: { allowedPaths: [], requireShellConfirmation: true, sensitiveFilePatterns: [] },
          performance: { maxConcurrency: 3, cacheTTL: 86400000, maxMemoryUsage: 500 }
        };

        const result = configManager.validateCodexConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('logLevel'))).toBe(true);
      });

      it('应该拒绝缺失的MCP配置', () => {
        const config: any = {
          defaultMode: 'auto',
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          security: { allowedPaths: [], requireShellConfirmation: true, sensitiveFilePatterns: [] },
          performance: { maxConcurrency: 3, cacheTTL: 86400000, maxMemoryUsage: 500 }
        };

        const result = configManager.validateCodexConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('MCP settings'))).toBe(true);
      });

      it('应该拒绝非数组的allowedPaths', () => {
        const config: any = {
          defaultMode: 'auto',
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          mcp: { port: 8765, timeout: 300000, logLevel: 'info' },
          security: { allowedPaths: 'not-an-array', requireShellConfirmation: true, sensitiveFilePatterns: [] },
          performance: { maxConcurrency: 3, cacheTTL: 86400000, maxMemoryUsage: 500 }
        };

        const result = configManager.validateCodexConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('allowedPaths'))).toBe(true);
      });

      it('应该拒绝超出范围的maxConcurrency', () => {
        const invalidValues = [0, 11]; // Below 1 and above 10

        invalidValues.forEach(maxConcurrency => {
          const config: any = {
            defaultMode: 'auto',
            enableDeepThinking: true,
            enableCodebaseScan: true,
            timeout: 300000,
            mcp: { port: 8765, timeout: 300000, logLevel: 'info' },
            security: { allowedPaths: [], requireShellConfirmation: true, sensitiveFilePatterns: [] },
            performance: { maxConcurrency: maxConcurrency, cacheTTL: 86400000, maxMemoryUsage: 500 }
          };

          const result = configManager.validateCodexConfig(config);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.includes('maxConcurrency'))).toBe(true);
        });
      });

      it('应该拒绝负数的cacheTTL', () => {
        const config: any = {
          defaultMode: 'auto',
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          mcp: { port: 8765, timeout: 300000, logLevel: 'info' },
          security: { allowedPaths: [], requireShellConfirmation: true, sensitiveFilePatterns: [] },
          performance: { maxConcurrency: 3, cacheTTL: -1000, maxMemoryUsage: 500 }
        };

        const result = configManager.validateCodexConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('cacheTTL'))).toBe(true);
      });

      it('应该拒绝过小的maxMemoryUsage', () => {
        const config: any = {
          defaultMode: 'auto',
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          mcp: { port: 8765, timeout: 300000, logLevel: 'info' },
          security: { allowedPaths: [], requireShellConfirmation: true, sensitiveFilePatterns: [] },
          performance: { maxConcurrency: 3, cacheTTL: 86400000, maxMemoryUsage: 50 }
        };

        const result = configManager.validateCodexConfig(config);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('maxMemoryUsage'))).toBe(true);
      });
    });
  });

  describe('migrateConfig()', () => {
    it('应该将没有Codex配置的旧版本迁移到新版本', () => {
      const oldConfig = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        }
      };

      const migrated = configManager.migrateConfig(oldConfig);

      expect(migrated.codex).toBeDefined();
      expect(migrated.codex?.defaultMode).toBe('auto');
      expect(migrated.codex?.mcp).toBeDefined();
      expect(migrated.codex?.security).toBeDefined();
      expect(migrated.codex?.performance).toBeDefined();
    });

    it('应该保留现有的Codex配置并填充缺失字段', () => {
      const partialConfig = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        },
        codex: {
          defaultMode: 'codex' as const,
          enableDeepThinking: false
        }
      };

      const migrated = configManager.migrateConfig(partialConfig);

      expect(migrated.codex?.defaultMode).toBe('codex'); // Preserved
      expect(migrated.codex?.enableDeepThinking).toBe(false); // Preserved
      expect(migrated.codex?.enableCodebaseScan).toBe(true); // Filled with default
      expect(migrated.codex?.mcp).toBeDefined(); // Filled with default
    });

    it('应该填充缺失的paths配置', () => {
      const configWithoutPaths: any = {
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        }
      };

      const migrated = configManager.migrateConfig(configWithoutPaths);

      expect(migrated.paths).toBeDefined();
      expect(migrated.paths.specs).toBeDefined();
      expect(migrated.paths.steering).toBeDefined();
      expect(migrated.paths.settings).toBeDefined();
    });

    it('应该填充缺失的views配置', () => {
      const configWithoutViews: any = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        }
      };

      const migrated = configManager.migrateConfig(configWithoutViews);

      expect(migrated.views).toBeDefined();
      expect(migrated.views.specs).toBeDefined();
      expect(migrated.views.steering).toBeDefined();
      expect(migrated.views.mcp).toBeDefined();
      expect(migrated.views.hooks).toBeDefined();
      expect(migrated.views.settings).toBeDefined();
    });

    it('应该合并部分Codex MCP配置', () => {
      const partialMcpConfig = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        },
        codex: {
          defaultMode: 'auto' as const,
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          mcp: {
            port: 9999 // Custom port
          }
        }
      };

      const migrated = configManager.migrateConfig(partialMcpConfig);

      expect(migrated.codex?.mcp.port).toBe(9999); // Preserved custom value
      expect(migrated.codex?.mcp.timeout).toBe(300000); // Filled with default
      expect(migrated.codex?.mcp.logLevel).toBe('info'); // Filled with default
    });

    it('应该合并部分安全配置', () => {
      const partialSecurityConfig = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        },
        codex: {
          defaultMode: 'auto' as const,
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          mcp: {
            port: 8765,
            timeout: 300000,
            logLevel: 'info' as const
          },
          security: {
            allowedPaths: ['custom/**'],
            requireShellConfirmation: false
          }
        }
      };

      const migrated = configManager.migrateConfig(partialSecurityConfig);

      expect(migrated.codex?.security.allowedPaths).toEqual(['custom/**']); // Preserved
      expect(migrated.codex?.security.requireShellConfirmation).toBe(false); // Preserved
      expect(migrated.codex?.security.sensitiveFilePatterns.length).toBeGreaterThan(0); // Filled with defaults
    });
  });

  describe('loadSettings() with Migration and Validation', () => {
    it('应该加载并迁移旧配置文件', async () => {
      const oldConfig = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        }
      };

      // Mock file read
      const mockReadFile = jest.spyOn(vscode.workspace.fs, 'readFile');
      mockReadFile.mockResolvedValue(Buffer.from(JSON.stringify(oldConfig)));

      const settings = await configManager.loadSettings();

      expect(settings.codex).toBeDefined();
      expect(settings.codex?.defaultMode).toBe('auto');
      expect(mockReadFile).toHaveBeenCalled();
    });

    it('应该拒绝无效的Codex配置并使用默认值', async () => {
      const invalidConfig = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        },
        codex: {
          defaultMode: 'invalid', // Invalid mode
          mcp: {
            port: 100 // Invalid port
          }
        }
      };

      // Mock console.warn to suppress warning output
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock file read
      const mockReadFile = jest.spyOn(vscode.workspace.fs, 'readFile');
      mockReadFile.mockResolvedValue(Buffer.from(JSON.stringify(invalidConfig)));

      const settings = await configManager.loadSettings();

      // Should fallback to default Codex settings
      expect(settings.codex?.defaultMode).toBe('auto');
      expect(settings.codex?.mcp.port).toBe(8765);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('应该返回默认配置当文件不存在时', async () => {
      // Mock file read to throw error (file not found)
      const mockReadFile = jest.spyOn(vscode.workspace.fs, 'readFile');
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const settings = await configManager.loadSettings();

      expect(settings.codex).toBeDefined();
      expect(settings.codex?.defaultMode).toBe('auto');
    });
  });

  describe('saveSettings() with Validation', () => {
    it('应该保存有效的配置', async () => {
      const validSettings: KfcSettings = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        },
        codex: {
          defaultMode: 'auto',
          enableDeepThinking: true,
          enableCodebaseScan: true,
          timeout: 300000,
          mcp: {
            port: 8765,
            timeout: 300000,
            logLevel: 'info'
          },
          security: {
            allowedPaths: ['src/**'],
            requireShellConfirmation: true,
            sensitiveFilePatterns: ['.env']
          },
          performance: {
            maxConcurrency: 3,
            cacheTTL: 86400000,
            maxMemoryUsage: 500
          }
        }
      };

      // Mock file operations
      const mockCreateDirectory = jest.spyOn(vscode.workspace.fs, 'createDirectory');
      mockCreateDirectory.mockResolvedValue(undefined);

      const mockWriteFile = jest.spyOn(vscode.workspace.fs, 'writeFile');
      mockWriteFile.mockResolvedValue(undefined);

      await configManager.saveSettings(validSettings);

      expect(mockCreateDirectory).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('应该拒绝保存无效的Codex配置', async () => {
      const invalidSettings: any = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        },
        codex: {
          defaultMode: 'invalid', // Invalid mode
          mcp: {
            port: 100 // Invalid port
          }
        }
      };

      await expect(configManager.saveSettings(invalidSettings)).rejects.toThrow('Invalid Codex configuration');
    });

    it('应该在没有工作空间时抛出错误', async () => {
      // Remove workspace folder
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: undefined,
        writable: true,
        configurable: true
      });

      // Reset singleton to pick up new workspace state
      (ConfigManager as any).instance = undefined;
      const newManager = ConfigManager.getInstance();

      const validSettings: KfcSettings = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        }
      };

      await expect(newManager.saveSettings(validSettings)).rejects.toThrow('No workspace folder found');
    });
  });

  describe('Integration: Full Lifecycle', () => {
    it('应该完整地加载、迁移、验证并保存配置', async () => {
      // Step 1: Start with old config
      const oldConfig = {
        paths: {
          specs: '.claude/specs',
          steering: '.claude/steering',
          settings: '.claude/settings'
        },
        views: {
          specs: { visible: true },
          steering: { visible: true },
          mcp: { visible: true },
          hooks: { visible: true },
          settings: { visible: false }
        }
      };

      // Mock file read for load
      const mockReadFile = jest.spyOn(vscode.workspace.fs, 'readFile');
      mockReadFile.mockResolvedValue(Buffer.from(JSON.stringify(oldConfig)));

      // Step 2: Load (this will trigger migration)
      const loadedSettings = await configManager.loadSettings();

      expect(loadedSettings.codex).toBeDefined();
      expect(loadedSettings.codex?.defaultMode).toBe('auto');

      // Step 3: Modify settings
      const modifiedSettings: KfcSettings = JSON.parse(JSON.stringify(loadedSettings)); // Deep clone
      modifiedSettings.codex!.defaultMode = 'codex';
      modifiedSettings.codex!.mcp.port = 9999;

      // Verify modification worked
      expect(modifiedSettings.codex?.defaultMode).toBe('codex');
      expect(modifiedSettings.codex?.mcp.port).toBe(9999);

      // Mock file operations for save
      const mockCreateDirectory = jest.spyOn(vscode.workspace.fs, 'createDirectory');
      mockCreateDirectory.mockResolvedValue(undefined);

      const mockWriteFile = jest.spyOn(vscode.workspace.fs, 'writeFile');
      mockWriteFile.mockResolvedValue(undefined);

      // Step 4: Save (this will trigger validation)
      await configManager.saveSettings(modifiedSettings);

      // Verify writeFile was called
      expect(mockWriteFile).toHaveBeenCalled();

      // Get the actual buffer that was written (last call)
      const writeCall = mockWriteFile.mock.calls[mockWriteFile.mock.calls.length - 1];
      const writtenBuffer = writeCall[1] as Uint8Array;
      const writtenSettings = JSON.parse(Buffer.from(writtenBuffer).toString());

      // Verify the settings that were written
      expect(writtenSettings.codex.defaultMode).toBe('codex');
      expect(writtenSettings.codex.mcp.port).toBe(9999);
    });
  });
});
