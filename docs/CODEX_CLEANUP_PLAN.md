# Codex 代码清理计划

## 目标
删除未使用的 Codex 组件（~2600 行代码），保持项目简洁和可维护。

## 要删除的文件

### 1. 未使用的核心组件
```bash
src/features/codex/taskRouter.ts                    # ~300 行
src/features/codex/complexityAnalyzer.ts            # ~400 行
src/features/codex/deepThinkingEngine.ts            # ~500 行
src/features/codex/codebaseAnalyzer.ts              # ~350 行
src/features/codex/securityGuard.ts                 # ~300 行
src/features/codex/preferenceTracker.ts             # ~200 行
src/features/codex/feedbackCollector.ts             # ~150 行
```

### 2. 未使用的 UI 组件
```bash
src/features/codex/views/codexAnalysisWebview.ts    # ~400 行
src/features/codex/taskCodeLensProvider.ts          # ~150 行
src/features/codex/taskExecutionHandler.ts          # ~200 行
```

### 3. 未使用的工具类
```bash
src/features/codex/mcpLifecycleManager.ts           # ~200 行（MCPClient 已包含连接管理）
src/features/codex/localAgentExecutor.ts            # ~150 行（未使用）
src/features/codex/apiKeySetup.ts                   # ~100 行（未使用）
src/features/codex/workspaceInitializer.ts          # ~100 行（未使用）
```

### 4. 相关测试文件
```bash
src/features/codex/__tests__/taskRouter.test.ts
src/features/codex/__tests__/complexityAnalyzer.test.ts
src/features/codex/__tests__/securityGuard.test.ts
src/features/codex/__tests__/preferenceTracker.test.ts
src/features/codex/__tests__/preferenceTracker.example.ts
src/features/codex/__tests__/codexOrchestrator.test.ts  # 需要重写
```

### 5. 相关文档
```bash
src/features/codex/taskRouter.README.md
src/features/codex/PREFERENCE_TRACKER.md
src/features/codex/README_TASK20.md
src/features/codex/TASK19_SUMMARY.md
```

### 6. Prompts 相关
```bash
src/features/codex/prompts/deepThinkingPrompts.ts   # ~300 行
```

## 保留的文件

### 核心组件（必须）
```bash
✅ src/features/codex/codexOrchestrator.ts          # 简化版
✅ src/features/codex/codexExecutor.ts              # 执行器
✅ src/features/codex/mcpClient.ts                  # MCP 通信
✅ src/features/codex/sessionStateManager.ts        # 会话管理
✅ src/features/codex/types.ts                      # 类型定义
```

### 辅助组件
```bash
✅ src/features/codex/progressIndicator.ts          # 进度显示
✅ src/features/codex/executionLogger.ts            # 日志记录
✅ src/features/codex/credentialManager.ts          # 凭证管理
```

### 文档
```bash
✅ src/features/codex/README.md                     # 保留并更新
✅ src/features/codex/codexExecutor.README.md
✅ src/features/codex/sessionStateManager.README.md
```

## 需要修改的文件

### 1. codexOrchestrator.ts
**移除的导入**:
```typescript
- import { TaskRouter } from './taskRouter';
- import { LocalAgentExecutor } from './localAgentExecutor';
- import { DeepThinkingEngine } from './deepThinkingEngine';
- import { FeedbackCollector } from './feedbackCollector';
- import { CodexAnalysisWebview } from './views/codexAnalysisWebview';
```

**移除的属性**:
```typescript
- private taskRouter: TaskRouter;
- private localAgentExecutor?: LocalAgentExecutor;
- private deepThinkingEngine?: DeepThinkingEngine;
- private analysisWebview?: CodexAnalysisWebview;
- private feedbackCollector?: FeedbackCollector;
```

**移除的方法**:
```typescript
- getLocalAgentExecutor()
- getDeepThinkingEngine()
- getAnalysisWebview()
- getFeedbackCollector()
- enableDeepThinking()
- showAnalysisResult()
- _selectExecutionMode()  // 简化为直接使用 forceMode
```

**简化后的 executeTask()**:
```typescript
async executeTask(task: TaskDescriptor, options?: ExecutionOptions): Promise<ExecutionResult> {
  // 1. 创建会话
  // 2. 直接执行（移除路由逻辑）
  // 3. 返回结果
}
```

### 2. extension.ts
**移除的导入**:
```typescript
- import { TaskCodeLensProvider } from './features/codex/taskCodeLensProvider';
- import { handleExecuteTaskWithCodex, handleShowTaskDetails } from './features/codex/taskExecutionHandler';
```

**移除的注册**:
```typescript
- TaskCodeLensProvider 相关注册
- handleExecuteTaskWithCodex 相关命令
```

### 3. types.ts
**保留的类型**:
```typescript
✅ TaskDescriptor
✅ ExecutionMode
✅ ExecutionOptions
✅ ExecutionResult
✅ Session
✅ MCPServerStatus
```

**可删除的类型**:
```typescript
❌ ComplexityScore
❌ ModeRecommendation
❌ ThinkingResult
❌ AnalysisContext
❌ CodebaseSnapshot
❌ DependencyGraph
```

### 4. package.json
**移除的配置**:
```json
// 移除未使用的设置项
- kfc.codex.defaultMode
- kfc.codex.autoScan
- kfc.codex.mcpPort
```

## 执行步骤

### Phase 1: 备份
```bash
# 创建备份分支
git checkout -b backup-before-codex-cleanup
git add .
git commit -m "Backup before Codex cleanup"

# 回到 main
git checkout main
```

### Phase 2: 删除文件
```bash
# 删除未使用的核心组件
rm src/features/codex/taskRouter.ts
rm src/features/codex/complexityAnalyzer.ts
rm src/features/codex/deepThinkingEngine.ts
rm src/features/codex/codebaseAnalyzer.ts
rm src/features/codex/securityGuard.ts
rm src/features/codex/preferenceTracker.ts
rm src/features/codex/feedbackCollector.ts

# 删除未使用的 UI 组件
rm -rf src/features/codex/views/
rm src/features/codex/taskCodeLensProvider.ts
rm src/features/codex/taskExecutionHandler.ts

# 删除未使用的工具类
rm src/features/codex/mcpLifecycleManager.ts
rm src/features/codex/localAgentExecutor.ts
rm src/features/codex/apiKeySetup.ts
rm src/features/codex/workspaceInitializer.ts

# 删除 prompts
rm -rf src/features/codex/prompts/

# 删除测试
rm -rf src/features/codex/__tests__/

# 删除文档
rm src/features/codex/taskRouter.README.md
rm src/features/codex/PREFERENCE_TRACKER.md
rm src/features/codex/README_TASK20.md
rm src/features/codex/TASK19_SUMMARY.md
```

### Phase 3: 修改代码
见上述"需要修改的文件"

### Phase 4: 清理 imports
```bash
# 编译检查
npm run compile

# 修复所有 import 错误
```

### Phase 5: 更新文档
```bash
# 更新 README
# 更新 CHANGELOG
# 更新架构文档
```

### Phase 6: 测试
```bash
# 编译
npm run compile

# 打包
npm run package

# 安装测试
./scripts/build-and-install.sh

# 功能测试
- Review Design ✓
- Review Requirements ✓
- Implement Task with Codex ✓
```

## 预期结果

### 代码统计
- **删除前**: ~5400 行
- **删除后**: ~2800 行
- **减少**: ~2600 行（48%）

### 文件数量
- **删除前**: 21 个 TS 文件
- **删除后**: 8 个 TS 文件
- **减少**: 13 个文件（62%）

### 包体积
- **预计减少**: ~100KB（压缩后）

### 维护成本
- **降低**: 未使用代码的维护负担
- **提升**: 代码可读性和可维护性

## 风险评估

### 低风险
- ✅ 被删除的代码从未被调用
- ✅ 有完整的 git 历史可回滚
- ✅ 有备份分支

### 需要注意
- ⚠️ 确保所有 import 都已清理
- ⚠️ 确保 types.ts 中的类型不被引用
- ⚠️ 测试所有现有功能

## 后续优化

### 可选的进一步简化
1. 简化 `CodexOrchestrator` - 移除未使用的逻辑
2. 简化 `SessionStateManager` - 只保留必要功能
3. 合并相关文件 - 减少文件数量

### 文档更新
1. 更新架构图 - 反映实际架构
2. 更新 README - 移除未实现功能的描述
3. 创建"简化后架构"文档

---

**准备好执行了吗？** 🚀
