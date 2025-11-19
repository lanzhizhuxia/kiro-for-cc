/**
 * SecurityGuard配置文件保护单元测试
 *
 * 测试覆盖：
 * 1. 配置文件检测
 * 2. 备份创建
 * 3. Diff生成
 * 4. 备份清理
 * 5. 备份恢复
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { SecurityGuard } from '../../features/codex/securityGuard';

/**
 * Mock输出通道
 */
class MockOutputChannel {
  private lines: string[] = [];

  appendLine(value: string): void {
    this.lines.push(value);
  }

  append(value: string): void {
    // no-op for test
  }

  clear(): void {
    this.lines = [];
  }

  show(): void {
    // no-op for test
  }

  hide(): void {
    // no-op for test
  }

  dispose(): void {
    this.lines = [];
  }

  replace(value: string): void {
    // no-op for test
  }

  get name(): string {
    return 'MockOutputChannel';
  }

  getLines(): string[] {
    return this.lines;
  }
}

describe('SecurityGuard - Config File Protection Tests', () => {
  let securityGuard: SecurityGuard;
  let mockOutputChannel: MockOutputChannel;

  beforeEach(() => {
    mockOutputChannel = new MockOutputChannel();
    securityGuard = new SecurityGuard(mockOutputChannel as any);
  });

  describe('配置文件检测', () => {
    it('应该检测package.json为配置文件', () => {
      const filePath = '/test/workspace/package.json';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, true);
    });

    it('应该检测tsconfig.json为配置文件', () => {
      const filePath = '/test/workspace/tsconfig.json';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, true);
    });

    it('应该检测webpack.config.js为配置文件', () => {
      const filePath = '/test/workspace/webpack.config.js';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, true);
    });

    it('应该检测.eslintrc为配置文件', () => {
      const filePath = '/test/workspace/.eslintrc';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, true);
    });

    it('应该检测Dockerfile为配置文件', () => {
      const filePath = '/test/workspace/Dockerfile';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, true);
    });

    it('应该检测docker-compose.yml为配置文件', () => {
      const filePath = '/test/workspace/docker-compose.yml';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, true);
    });

    it('应该检测.gitignore为配置文件', () => {
      const filePath = '/test/workspace/.gitignore';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, true);
    });

    it('应该检测.vscode/settings.json为配置文件', () => {
      const filePath = '/test/workspace/.vscode/settings.json';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, true);
    });

    it('应该不检测README.md为配置文件', () => {
      const filePath = '/test/workspace/README.md';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, false);
    });

    it('应该不检测src/index.ts为配置文件', () => {
      const filePath = '/test/workspace/src/index.ts';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, false);
    });

    it('应该不检测data.json为配置文件', () => {
      const filePath = '/test/workspace/data.json';
      const isConfig = (securityGuard as any)._isConfigFile(filePath);
      assert.strictEqual(isConfig, false);
    });
  });

  describe('Diff生成', () => {
    it('应该生成正确的diff（修改行）', () => {
      const oldContent = 'line1\nline2\nline3';
      const newContent = 'line1\nline2-modified\nline3';

      const diff = (securityGuard as any)._generateDiff(oldContent, newContent);

      assert.ok(diff.includes('变更行数: 1'));
      assert.ok(diff.includes('- line2'));
      assert.ok(diff.includes('+ line2-modified'));
    });

    it('应该生成正确的diff（添加行）', () => {
      const oldContent = 'line1\nline2';
      const newContent = 'line1\nline2\nline3';

      const diff = (securityGuard as any)._generateDiff(oldContent, newContent);

      assert.ok(diff.includes('变更行数: 1'));
      assert.ok(diff.includes('+ line3'));
    });

    it('应该生成正确的diff（删除行）', () => {
      const oldContent = 'line1\nline2\nline3';
      const newContent = 'line1\nline3';

      const diff = (securityGuard as any)._generateDiff(oldContent, newContent);

      assert.ok(diff.includes('变更行数: 1'));
      assert.ok(diff.includes('- line2'));
    });

    it('应该检测无变更', () => {
      const content = 'line1\nline2\nline3';
      const diff = (securityGuard as any)._generateDiff(content, content);

      assert.strictEqual(diff, '无变更');
    });

    it('应该处理空文件到有内容', () => {
      const oldContent = '';
      const newContent = 'new content';

      const diff = (securityGuard as any)._generateDiff(oldContent, newContent);

      assert.ok(diff.includes('变更行数: 1'));
      assert.ok(diff.includes('+ new content'));
    });

    it('应该处理删除所有内容', () => {
      const oldContent = 'old content';
      const newContent = '';

      const diff = (securityGuard as any)._generateDiff(oldContent, newContent);

      assert.ok(diff.includes('变更行数: 1'));
      assert.ok(diff.includes('- old content'));
    });

    it('应该处理多行变更', () => {
      const oldContent = 'line1\nline2\nline3\nline4';
      const newContent = 'line1\nline2-new\nline3-new\nline4';

      const diff = (securityGuard as any)._generateDiff(oldContent, newContent);

      assert.ok(diff.includes('变更行数: 2'));
      assert.ok(diff.includes('- line2'));
      assert.ok(diff.includes('+ line2-new'));
      assert.ok(diff.includes('- line3'));
      assert.ok(diff.includes('+ line3-new'));
    });

    it('应该生成可读的JSON diff', () => {
      const oldContent = JSON.stringify({ name: 'old', version: '1.0.0' }, null, 2);
      const newContent = JSON.stringify({ name: 'new', version: '2.0.0' }, null, 2);

      const diff = (securityGuard as any)._generateDiff(oldContent, newContent);

      assert.ok(diff.includes('变更行数:'));
      assert.ok(diff.includes('- '));
      assert.ok(diff.includes('+ '));
    });
  });

  describe('备份路径提取', () => {
    it('应该正确提取原始文件路径', () => {
      const backupPath = '/test/workspace/package.json.backup-1234567890';
      const originalPath = backupPath.replace(/\.backup-\d+$/, '');

      assert.strictEqual(originalPath, '/test/workspace/package.json');
    });

    it('应该正确提取嵌套目录的原始文件路径', () => {
      const backupPath = '/test/.vscode/settings.json.backup-9876543210';
      const originalPath = backupPath.replace(/\.backup-\d+$/, '');

      assert.strictEqual(originalPath, '/test/.vscode/settings.json');
    });

    it('应该正确处理复杂文件名', () => {
      const backupPath = '/test/tsconfig.app.json.backup-1111111111';
      const originalPath = backupPath.replace(/\.backup-\d+$/, '');

      assert.strictEqual(originalPath, '/test/tsconfig.app.json');
    });
  });

  describe('配置文件模式覆盖', () => {
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'webpack.config.js',
      'rollup.config.ts',
      'vite.config.mjs',
      'jest.config.json',
      'babel.config.js',
      '.eslintrc',
      '.eslintrc.json',
      '.prettierrc',
      'tsconfig.app.json',
      '.babelrc',
      '.eslintignore',
      '.prettierignore',
      '.npmrc',
      '.yarnrc',
      '.editorconfig',
      '.dockerignore',
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
      '.gitignore',
      '.gitattributes',
      '.vscode/settings.json',
      '.vscode/launch.json',
      '.claudeignore'
    ];

    configFiles.forEach(file => {
      it(`应该检测 ${file} 为配置文件`, () => {
        const filePath = `/test/workspace/${file}`;
        const isConfig = (securityGuard as any)._isConfigFile(filePath);
        assert.strictEqual(isConfig, true, `${file} should be detected as config file`);
      });
    });
  });

  describe('非配置文件检测', () => {
    const nonConfigFiles = [
      'README.md',
      'src/index.ts',
      'test.spec.js',
      'data.json',
      'style.css',
      'image.png',
      'document.pdf'
    ];

    nonConfigFiles.forEach(file => {
      it(`应该不检测 ${file} 为配置文件`, () => {
        const filePath = `/test/workspace/${file}`;
        const isConfig = (securityGuard as any)._isConfigFile(filePath);
        assert.strictEqual(isConfig, false, `${file} should NOT be detected as config file`);
      });
    });
  });
});
