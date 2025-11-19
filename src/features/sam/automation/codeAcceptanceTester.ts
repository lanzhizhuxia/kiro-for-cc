/**
 * 代码验收测试器
 *
 * 职责：
 * 1. 验证 Codex 生成的代码质量
 * 2. 运行单元测试（如果有）
 * 3. 检查代码风格和规范
 * 4. 提供验收报告
 *
 * 注意：当前版本为简化实现，主要进行基本的代码检查
 * 完整的测试运行和代码检查需要在后续版本中实现
 */

import * as vscode from 'vscode';
import { AcceptanceCriteria, AcceptanceResult } from './types';
import { TaskDescriptor } from '../../codex/types';

/**
 * 代码验收测试器
 */
export class CodeAcceptanceTester {
  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * 验收 Codex 生成的代码
   * @param code 生成的代码
   * @param criteria 验收标准
   * @returns 验收结果
   */
  async acceptCode(
    code: string,
    criteria: AcceptanceCriteria
  ): Promise<AcceptanceResult> {
    this.outputChannel.appendLine(`[CodeAcceptanceTester] Starting code acceptance...`);

    const details: AcceptanceResult['details'] = {};
    const suggestions: string[] = [];
    let allPassed = true;

    try {
      // 1. 基本代码检查
      const basicCheckResult = this.performBasicChecks(code);
      if (!basicCheckResult.passed) {
        allPassed = false;
        suggestions.push(...basicCheckResult.suggestions);
      }

      // 2. 编译检查（如果需要）
      if (criteria.requiresCompilation) {
        details.compilation = await this.checkCompilation(code);
        if (!details.compilation.passed) {
          allPassed = false;
          suggestions.push('代码包含编译错误，需要修复');
        }
      }

      // 3. 测试检查（如果需要）
      if (criteria.requiresTests) {
        details.tests = await this.runTests(code);
        if (!details.tests.passed) {
          allPassed = false;
          suggestions.push('测试未通过，请检查代码逻辑');
        }
      }

      // 4. 代码风格检查（如果需要）
      if (criteria.requiresLinting) {
        details.linting = await this.checkLinting(code);
        if (!details.linting.passed) {
          allPassed = false;
          suggestions.push('代码风格不符合规范，建议格式化');
        }
      }

      // 5. 自定义验证（如果有）
      if (criteria.customValidation) {
        try {
          const customPassed = await criteria.customValidation(code);
          details.custom = { passed: customPassed };
          if (!customPassed) {
            allPassed = false;
            suggestions.push('自定义验证未通过');
          }
        } catch (error) {
          details.custom = {
            passed: false,
            message: error instanceof Error ? error.message : String(error)
          };
          allPassed = false;
          suggestions.push(`自定义验证出错: ${error}`);
        }
      }

      const result: AcceptanceResult = {
        passed: allPassed,
        details,
        suggestions: suggestions.length > 0 ? suggestions : undefined
      };

      this.outputChannel.appendLine(
        `[CodeAcceptanceTester] Acceptance ${allPassed ? 'passed' : 'failed'}`
      );

      return result;

    } catch (error) {
      this.outputChannel.appendLine(
        `[CodeAcceptanceTester] Error during acceptance: ${error}`
      );

      return {
        passed: false,
        details: {},
        suggestions: [`验收过程出错: ${error}`]
      };
    }
  }

  /**
   * 要求 Codex 修复问题
   * @param originalCode 原始代码
   * @param acceptanceResult 验收结果
   * @param task 任务描述
   * @returns 修复后的代码
   */
  async requestFix(
    originalCode: string,
    acceptanceResult: AcceptanceResult,
    task: TaskDescriptor
  ): Promise<string> {
    this.outputChannel.appendLine(`[CodeAcceptanceTester] Requesting code fix from Codex...`);

    // TODO: 实现自动修复功能
    // 需要重新调用 Codex，提供原始代码和验收失败的详细信息
    // 当前版本暂不支持，返回原始代码

    this.outputChannel.appendLine(
      `[CodeAcceptanceTester] Auto-fix not implemented yet, returning original code`
    );

    return originalCode;
  }

  /**
   * 执行基本代码检查
   */
  private performBasicChecks(code: string): { passed: boolean; suggestions: string[] } {
    const suggestions: string[] = [];

    // 检查1: 代码不为空
    if (!code || code.trim().length === 0) {
      suggestions.push('生成的代码为空');
      return { passed: false, suggestions };
    }

    // 检查2: 代码长度合理（至少10行）
    const lines = code.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 10) {
      suggestions.push('生成的代码过短，可能不完整');
    }

    // 检查3: 包含代码块标记（如果是 markdown）
    if (code.includes('```')) {
      // 检查代码块是否正确闭合
      const codeBlockCount = (code.match(/```/g) || []).length;
      if (codeBlockCount % 2 !== 0) {
        suggestions.push('代码块标记未正确闭合');
        return { passed: false, suggestions };
      }
    }

    // 检查4: 不包含明显的错误标记
    const errorMarkers = ['ERROR:', 'FIXME:', 'TODO: FIX', '// broken', '// error'];
    for (const marker of errorMarkers) {
      if (code.includes(marker)) {
        suggestions.push(`代码包含错误标记: ${marker}`);
      }
    }

    // 检查5: 不包含占位符
    const placeholders = ['...', 'TODO', 'PLACEHOLDER', 'YOUR_CODE_HERE'];
    for (const placeholder of placeholders) {
      if (code.includes(placeholder)) {
        suggestions.push(`代码包含占位符: ${placeholder}`);
      }
    }

    return {
      passed: suggestions.length === 0,
      suggestions
    };
  }

  /**
   * 检查编译（简化版）
   */
  private async checkCompilation(code: string): Promise<{ passed: boolean; errors?: string[] }> {
    this.outputChannel.appendLine(`[CodeAcceptanceTester] Checking compilation...`);

    // TODO: 实现真实的编译检查
    // 可以使用 TypeScript Compiler API 或其他工具
    // 当前版本只做简单的语法检查

    const errors: string[] = [];

    // 简单检查：查找常见的语法错误
    const syntaxErrors = [
      { pattern: /\(\s*$/, message: '缺少闭合括号' },
      { pattern: /\{\s*$/, message: '缺少闭合花括号' },
      { pattern: /\[\s*$/, message: '缺少闭合方括号' }
    ];

    for (const { pattern, message } of syntaxErrors) {
      if (pattern.test(code)) {
        errors.push(message);
      }
    }

    return {
      passed: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 运行测试（简化版）
   */
  private async runTests(code: string): Promise<{ passed: boolean; results?: string }> {
    this.outputChannel.appendLine(`[CodeAcceptanceTester] Running tests...`);

    // TODO: 实现真实的测试运行
    // 需要识别测试框架（Jest, Mocha, etc.）并运行测试
    // 当前版本只检查是否包含测试代码

    const hasTests = code.includes('test(') ||
                     code.includes('it(') ||
                     code.includes('describe(') ||
                     code.includes('expect(');

    return {
      passed: hasTests,
      results: hasTests ? 'Found test code' : 'No tests found'
    };
  }

  /**
   * 检查代码风格（简化版）
   */
  private async checkLinting(code: string): Promise<{ passed: boolean; warnings?: string[] }> {
    this.outputChannel.appendLine(`[CodeAcceptanceTester] Checking code style...`);

    // TODO: 实现真实的 linting
    // 可以使用 ESLint API
    // 当前版本只做简单的风格检查

    const warnings: string[] = [];

    // 简单检查：查找常见的风格问题
    if (code.includes('\t')) {
      warnings.push('使用了 Tab 缩进，建议使用空格');
    }

    if (code.includes('var ')) {
      warnings.push('使用了 var 声明，建议使用 let 或 const');
    }

    if (code.includes('==') && !code.includes('===')) {
      warnings.push('使用了 == 比较，建议使用 ===');
    }

    return {
      passed: warnings.length === 0,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}
