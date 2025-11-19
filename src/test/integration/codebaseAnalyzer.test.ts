/**
 * Integration tests for CodebaseAnalyzer AST analysis capabilities
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodebaseAnalyzer } from '../../features/codex/codebaseAnalyzer';

describe('CodebaseAnalyzer - AST Analysis', () => {
  let analyzer: CodebaseAnalyzer;
  let tempDir: string;
  let testFilePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebase-analyzer-test-'));
    testFilePath = path.join(tempDir, 'test.ts');
    analyzer = new CodebaseAnalyzer(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Cyclomatic Complexity', () => {
    it('should calculate complexity for simple function', async () => {
      const code = 'function test() { return 42; }';
      fs.writeFileSync(testFilePath, code);
      const metrics = await analyzer.analyzeTypeScriptFile(testFilePath);
      expect(metrics.cyclomaticComplexity).toBe(1);
    });

    it('should calculate complexity with if statement', async () => {
      const code = 'function test(x: number) { if (x > 0) { return "pos"; } return "neg"; }';
      fs.writeFileSync(testFilePath, code);
      const metrics = await analyzer.analyzeTypeScriptFile(testFilePath);
      expect(metrics.cyclomaticComplexity).toBe(2);
    });
  });

  describe('Cognitive Complexity', () => {
    it('should calculate cognitive complexity for simple function', async () => {
      const code = 'function test() { return 42; }';
      fs.writeFileSync(testFilePath, code);
      const metrics = await analyzer.analyzeTypeScriptFile(testFilePath);
      expect(metrics.cognitiveComplexity).toBe(0);
    });
  });

  describe('Function Call Chain', () => {
    it('should extract simple function calls', async () => {
      const code = 'function test() { foo(); bar(); }';
      fs.writeFileSync(testFilePath, code);
      const metrics = await analyzer.analyzeTypeScriptFile(testFilePath);
      expect(metrics.functionCallChain).toContain('foo');
      expect(metrics.functionCallChain).toContain('bar');
    });
  });

  describe('External Dependencies', () => {
    it('should extract external dependencies', async () => {
      const code = 'import * as fs from "fs"; import local from "./local";';
      fs.writeFileSync(testFilePath, code);
      const metrics = await analyzer.analyzeTypeScriptFile(testFilePath);
      expect(metrics.externalDependencies).toContain('fs');
      expect(metrics.externalDependencies).not.toContain('./local');
    });
  });

  describe('Cache Mechanism', () => {
    it('should cache analysis results', async () => {
      const code = 'function test() { return 1; }';
      fs.writeFileSync(testFilePath, code);
      const metrics1 = await analyzer.analyzeTypeScriptFile(testFilePath);
      const metrics2 = await analyzer.analyzeTypeScriptFile(testFilePath);
      expect(metrics1).toEqual(metrics2);
      const stats = analyzer.getCacheStats();
      expect(stats.size).toBe(1);
    });

    it('should support manual cache clearing', async () => {
      const code = 'function test() { return 1; }';
      fs.writeFileSync(testFilePath, code);
      await analyzer.analyzeTypeScriptFile(testFilePath);
      expect(analyzer.getCacheStats().size).toBe(1);
      analyzer.clearCache();
      expect(analyzer.getCacheStats().size).toBe(0);
    });
  });
});
