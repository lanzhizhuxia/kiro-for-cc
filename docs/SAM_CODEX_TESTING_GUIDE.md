# Sam + Codex 集成测试指南

## 🎉 版本 0.4.0 - Sam 现在可以委派任务给 Codex！

### 快速测试步骤

#### 1. 重启 Cursor
加载 v0.4.0 扩展

#### 2. 准备测试 Spec（可选）

如果您已有 spec（如 `bubble-sort`），可以跳过此步。

否则，使用 Ask Sam 创建一个简单的 spec：
```
Cmd+Shift+P → "Ask Sam"
输入: 实现冒泡排序算法
```

等待 Sam 生成 requirements.md 和 design.md。

#### 3. 测试 Codex 任务实现

1. **打开命令面板**
   ```
   Cmd+Shift+P（Mac）或 Ctrl+Shift+P（Windows/Linux）
   ```

2. **运行 "Implement Task with Codex"**

   输入并选择：
   ```
   Implement Task with Codex
   ```

3. **输入 Spec 名称**
   ```
   bubble-sort
   ```
   （或您的 spec 名称）

4. **输入任务描述**
   ```
   实现冒泡排序函数，支持升序和降序，使用 TypeScript
   ```

5. **等待 Codex 生成代码**
   - 观察输出面板（View → Output → Kiro for CC）
   - 等待通知：✅ Task implemented successfully by Codex!

6. **查看生成的实现**
   - 文件自动打开：`.claude/specs/bubble-sort/task-implementation-<timestamp>.md`
   - 应该包含：
     - 完整的 TypeScript 代码
     - 中文注释
     - 实现说明

### 预期结果示例

生成的文件内容类似：

```markdown
# Codex Deep Analysis Result

## Analysis Output

**实现说明**

实现了一个通用的冒泡排序函数，支持升序和降序排序。

**代码实现**：

\`\`\`typescript
/**
 * 冒泡排序函数
 * @param arr - 待排序的数组
 * @param order - 排序顺序，'asc' 为升序，'desc' 为降序，默认为升序
 * @returns 排序后的新数组（不修改原数组）
 */
function bubbleSort<T>(
  arr: T[],
  order: 'asc' | 'desc' = 'asc'
): T[] {
  // 创建数组副本，避免修改原数组
  const result = [...arr];
  const n = result.length;

  // 外层循环：遍历所有元素
  for (let i = 0; i < n - 1; i++) {
    // 内层循环：比较相邻元素并交换
    for (let j = 0; j < n - i - 1; j++) {
      // 根据排序顺序决定比较方式
      const shouldSwap = order === 'asc'
        ? result[j] > result[j + 1]
        : result[j] < result[j + 1];

      if (shouldSwap) {
        // 交换元素
        [result[j], result[j + 1]] = [result[j + 1], result[j]];
      }
    }
  }

  return result;
}

// 使用示例
const numbers = [64, 34, 25, 12, 22, 11, 90];

console.log('原始数组:', numbers);
console.log('升序排序:', bubbleSort(numbers, 'asc'));
console.log('降序排序:', bubbleSort(numbers, 'desc'));
\`\`\`

**错误处理**：
- 函数会创建数组副本，保护原数组不被修改
- 使用泛型 `<T>` 支持任意可比较类型
- 默认升序排序，提供良好的 API 默认行为

**性能说明**：
- 时间复杂度：O(n²)
- 空间复杂度：O(n)（因为创建了数组副本）
- 适合小规模数据排序或教学演示
```

### 测试不同类型的任务

#### 简单算法实现
```
实现快速排序算法，使用 TypeScript
```

#### 工具函数
```
实现一个深度克隆对象的函数，处理循环引用
```

#### React 组件
```
实现一个可复用的 Button 组件，支持不同尺寸和样式变体
```

#### 数据处理
```
实现 CSV 解析器，支持转义字符和多行文本
```

### 查看日志

**输出面板**:
```
View → Output → 选择 "Kiro for CC"
```

关键日志：
```
[SamManager] Implementing task with Codex: 实现冒泡排序...
[SamManager] Calling Codex orchestrator...
[CodexExecutor] Starting execution for task: sam-task-...
[MCPClient] Calling codex tool...
[MCPClient] Tool response: {...}
[SamManager] Task implemented successfully (2341ms)
[SamManager] Saved implementation to: .claude/specs/.../task-implementation-*.md
```

### 常见问题

#### Q: 提示 "Codex is not available"
**A**: 检查 MCP 服务器状态
```bash
claude mcp list
```
确保看到：
```
codex-cli: ... - ✓ Connected
```

#### Q: Codex 生成的代码没有中文注释
**A**: 检查任务描述是否用中文。Codex 会根据输入语言选择输出语言。

#### Q: 如何查看 Codex 的会话历史？
**A**: 检查文件
```
.claude/codex/sessions.json
```

#### Q: 生成的代码在哪里？
**A**: 保存在
```
.claude/specs/{spec-name}/task-implementation-{timestamp}.md
```

#### Q: 如何复用生成的代码？
**A**: 打开生成的 markdown 文件，复制代码块到您的项目中。

### 下一步增强（未来版本）

1. **自动任务评估**
   - Sam 分析 tasks.md 中的任务
   - 自动识别适合 Codex 的任务
   - 批量委派给 Codex

2. **代码直接集成**
   - Codex 生成代码后直接创建文件
   - 提供 diff 视图对比现有代码
   - 支持代码合并

3. **测试生成**
   - Codex 自动生成单元测试
   - 覆盖边界情况和错误处理

4. **验收自动化**
   - Sam 运行测试验收 Codex 的实现
   - 不通过则要求 Codex 修复

---

## 🎯 测试反馈

如果遇到问题或有改进建议，请：

1. 查看输出面板日志
2. 检查生成的文件内容
3. 在 GitHub Issues 提交反馈

**Happy Coding with Sam & Codex! 🤖✨**
