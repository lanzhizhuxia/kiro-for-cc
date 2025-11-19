# Sam 自动化任务实现指南

## 概述

Sam + Codex 自动化协作系统允许 Sam 自动评估 `tasks.md` 中的任务，并将适合的任务批量委派给 Codex 执行，实现从任务分析、执行、验收到代码整合的全自动化流程。

## 功能特性

### ✅ 已实现 (v0.6.0)

1. **任务自动评估** - 智能分析任务复杂度和类型，推荐执行方式
2. **批量任务委派** - 并发执行多个任务，提高效率
3. **代码验收测试** - 自动检查代码质量（基础版）
4. **代码整合** - 将生成的代码整合到项目文件
5. **进度追踪** - 自动更新 tasks.md 和 PROGRESS.md

## 使用指南

### 前提条件

1. ✅ Codex MCP Server 已正确配置
2. ✅ Spec 包含 `requirements.md`, `design.md`, `tasks.md`
3. ✅ tasks.md 格式正确（使用标准任务格式）

### 快速开始

#### 方法 1: 从命令面板

1. 打开命令面板 (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. 输入 "Sam: Auto-Evaluate Tasks" 或 "Sam: Auto-Implement Tasks"
3. 输入 spec 名称
4. 查看评估结果或等待自动化完成

#### 方法 2: 从 Spec 视图 (即将支持)

1. 在 SPECS 视图中右键点击 spec
2. 选择 "Auto-Evaluate Tasks" 或 "Auto-Implement Tasks with Codex"

### 完整工作流程

#### 1. 创建 Spec 和任务

首先使用 Sam 创建 spec：

```
Cmd+Shift+P → "Ask Sam"
输入: 实现冒泡排序算法功能
```

Sam 会生成：
- `requirements.md` - 需求文档
- `design.md` - 设计文档
- `tasks.md` - 任务列表

#### 2. 评估任务

运行任务评估：

```
Cmd+Shift+P → "Sam: Auto-Evaluate Tasks"
输入 spec 名称: bubble-sort
```

系统会：
- 解析 tasks.md 中的所有任务
- 评估每个任务的复杂度（0-100分）
- 分析任务类型（算法、组件、API等）
- 推荐使用 Codex 或手动实现

评估报告示例：
```
任务评估完成！

总任务数: 5
推荐 Codex: 3 个
建议手动: 2 个

查看详细评估结果？
```

#### 3. 自动实现任务

运行自动化实现：

```
Cmd+Shift+P → "Sam: Auto-Implement Tasks with Codex"
输入 spec 名称: bubble-sort
确认执行
```

系统会：
1. **评估阶段** - 分析所有未完成任务
2. **委派阶段** - 批量将任务委派给 Codex（最多3个并发）
3. **验收阶段** - 检查生成的代码质量
4. **整合阶段** - 显示 diff 视图供您审查
5. **更新阶段** - 更新 tasks.md 和 PROGRESS.md

#### 4. 审查和接受代码

对于每个成功生成的任务，系统会：

- 显示 diff 视图（原始文件 vs Codex 生成）
- 询问如何处理：
  - ✅ 接受 - 用新代码替换
  - 🔀 合并 - 手动合并更改
  - ❌ 拒绝 - 保留现有文件

#### 5. 查看结果

完成后显示摘要：

```
自动化完成！

总任务数: 5
委派给 Codex: 3
成功完成: 2
失败: 1
需要人工: 2

总耗时: 45.3秒
```

详细结果会记录到输出面板（View → Output → Kiro for CC）。

## 任务评估规则

### 推荐使用 Codex 的任务类型

1. **算法实现** (95%置信度)
   - 排序、搜索、图算法
   - 数学计算、字符串处理
   - 示例: "实现快速排序算法"

2. **工具函数** (95%置信度)
   - 数据转换、格式化
   - 验证、校验逻辑
   - 示例: "实现深度克隆对象函数"

3. **数据处理** (95%置信度)
   - 解析、序列化
   - 数据清洗、转换
   - 示例: "实现 CSV 解析器"

4. **简单任务** (复杂度 < 30分, 80%置信度)
   - 明确输入输出
   - 独立性强
   - 示例: "添加日期格式化函数"

5. **适中任务** (复杂度 30-70分, 75%置信度)
   - 有明确需求
   - 技术栈常见
   - 示例: "实现用户登录表单验证"

### 不推荐使用 Codex 的任务类型

1. **文档任务** (90%置信度)
   - README 编写
   - API 文档
   - 理由: 需要人工判断和经验

2. **重构任务** (90%置信度)
   - 代码优化
   - 架构调整
   - 理由: 需要深度理解现有代码库

3. **UI/UX 主观任务** (85%置信度)
   - 界面美化
   - 用户体验优化
   - 理由: 涉及主观审美判断

4. **复杂任务** (复杂度 > 70分, 70%置信度)
   - 多模块集成
   - 复杂业务逻辑
   - 理由: 建议分解为更小的任务

## 复杂度评估因素

系统根据以下因素计算复杂度评分（0-100分）：

| 因素 | 权重 | 说明 |
|------|------|------|
| 任务描述长度 | 20分 | 描述越详细，复杂度可能越高 |
| 详细描述数量 | 20分 | 子项越多，复杂度越高 |
| 技术栈复杂度 | 30分 | 涉及的技术越多，复杂度越高 |
| 依赖复杂度 | 15分 | 需要集成或对接，增加复杂度 |
| 明确性 | 15分 | 不明确的任务更复杂 |

## 配置选项

### 全局配置 (settings.json)

```json
{
  // 最大并发任务数
  "kfc.sam.automation.maxConcurrency": 3,

  // 是否自动验收通过的代码
  "kfc.sam.automation.autoAcceptance": false,

  // 是否自动整合验收通过的代码
  "kfc.sam.automation.autoIntegration": false,

  // 是否要求测试通过
  "kfc.sam.automation.requireTests": true
}
```

### 运行时选项

在代码中可以自定义选项（高级用法）：

```typescript
const report = await samCodexCoordinator.runAutomation({
  specName: 'my-feature',
  autoAcceptance: true,      // 自动验收
  autoIntegration: false,     // 需要用户审查
  integrationStrategy: {
    mode: 'review',           // diff 视图审查
    showDiff: true,
    createBackup: true
  },
  delegationOptions: {
    maxConcurrency: 3,        // 最多3个并发
    showProgress: true,
    retryCount: 1,            // 失败重试1次
    timeout: 300000           // 5分钟超时
  }
});
```

## 输出和日志

### 1. 执行报告

自动化完成后会生成详细报告：

```markdown
## Codex 自动化执行 - 2025-01-19T10:30:00.000Z

### 执行摘要
- 总任务数: 5
- 成功完成: 2
- 执行失败: 1
- 需要人工处理: 2

### 完成的任务
- [x] 1. 实现冒泡排序核心函数
- [x] 2. 添加输入验证逻辑

### 失败的任务
- [ ] 3. 集成到主应用 - 原因: 任务过于复杂

---
```

### 2. 输出日志

查看详细日志：
```
View → Output → Kiro for CC
```

关键日志：
```
[SamAutomation] Starting automation for spec: bubble-sort
[TaskEvaluator] Found 5 tasks
[TaskEvaluator] Evaluated 5 tasks
[BatchTaskDelegator] Starting batch delegation: 3 tasks
[CodexExecutor] Starting execution for task: sam-task-bubble-sort-1
[CodeAcceptanceTester] Acceptance passed
[CodeIntegrator] Code integrated to: src/bubbleSort.ts
[SamCodexCoordinator] Automation complete: 2 succeeded, 1 failed
```

### 3. 生成的文件

#### 代码文件
- 位置: 由 `CodeIntegrator` 智能推断或用户指定
- 格式: 根据代码内容自动推断（.ts, .js, .py等）
- 备份: 自动创建 `.backup-{timestamp}` 备份

#### 临时文件
- `.codex-generated` - 用于 diff 视图的临时文件
- 使用后可以删除

## 最佳实践

### 1. 任务拆分

将大任务拆分为小任务，提高 Codex 成功率：

❌ **不推荐**:
```markdown
- [ ] 1. 实现完整的用户管理系统
  - 包括注册、登录、权限管理、用户资料编辑
```

✅ **推荐**:
```markdown
- [ ] 1. 实现用户注册功能
  - 验证邮箱格式
  - 检查用户名唯一性
  - 创建用户记录

- [ ] 2. 实现用户登录功能
  - 验证凭据
  - 生成 JWT token
  - 处理登录失败

- [ ] 3. 实现权限管理
  - 定义角色和权限
  - 检查用户权限
```

### 2. 明确描述

提供清晰的任务描述：

❌ **不推荐**:
```markdown
- [ ] 1. 优化性能
```

✅ **推荐**:
```markdown
- [ ] 1. 优化数据库查询性能
  - 添加索引到 users.email 字段
  - 使用批量查询减少 N+1 问题
  - 缓存常用查询结果
```

### 3. 渐进式自动化

第一次使用时：
1. 先运行 "Auto-Evaluate Tasks" 查看评估结果
2. 手动选择1-2个简单任务测试
3. 确认质量后，批量执行其他任务

### 4. 代码审查

即使自动化验收通过，仍建议：
- 查看生成的代码逻辑
- 运行单元测试
- 检查边界情况处理

## 故障排除

### 问题1: "Sam automation is not available"

**原因**: Codex Orchestrator 未初始化

**解决方案**:
1. 检查 Codex MCP Server 状态
   ```bash
   claude mcp list
   ```
2. 确保看到 `codex-cli: ... - ✓ Connected`
3. 重启 VS Code

### 问题2: 所有任务都被标记为"建议手动"

**原因**: 任务描述不够详细或过于复杂

**解决方案**:
1. 查看输出面板中的评估理由
2. 添加更多任务详细描述
3. 拆分复杂任务

### 问题3: Codex 生成的代码不正确

**原因**: 任务描述不清晰或缺少上下文

**解决方案**:
1. 在 tasks.md 中添加更多详细描述
2. 确保 requirements.md 和 design.md 内容完整
3. 使用 "拒绝" 选项，手动实现该任务

### 问题4: 代码整合失败

**原因**: 文件路径推断错误或文件冲突

**解决方案**:
1. 使用 "手动合并" 选项
2. 在 integrationStrategy 中指定 `targetPath`
3. 检查备份文件并手动恢复

## 性能优化

### 并发控制

默认最大并发为 3，可以根据机器性能调整：

```json
{
  "kfc.sam.automation.maxConcurrency": 5  // 高性能机器
}
```

### 超时设置

对于复杂任务，增加超时时间：

```typescript
delegationOptions: {
  timeout: 600000  // 10分钟
}
```

## 未来增强

### 即将推出 (v0.7.0+)

1. **智能修复** - Codex 根据测试失败自动修复代码
2. **任务依赖分析** - 识别任务间依赖，优化执行顺序
3. **增量执行** - 只执行新增或修改的任务
4. **成本估算** - 预估 Codex API 调用成本
5. **评估报告 WebView** - 可视化显示评估结果
6. **执行进度 WebView** - 实时显示任务执行状态

## 相关文档

- [Sam 使用指南](./SAM_INTEGRATION.md)
- [Codex 配置指南](./CODEX_SETUP.md)
- [架构设计文档](./SAM_CODEX_AUTOMATION_DESIGN.md)
- [API 参考](../src/features/sam/automation/README.md)

## 反馈和支持

遇到问题或有改进建议？

1. 查看输出日志（View → Output → Kiro for CC）
2. 在 [GitHub Issues](https://github.com/lanzhizhuxia/kiro-for-cc/issues) 提交反馈
3. 附上详细的错误信息和复现步骤

---

**版本**: v0.6.0
**最后更新**: 2025-01-19
