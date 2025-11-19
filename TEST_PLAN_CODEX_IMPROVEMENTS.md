# Codex改进测试计划

## 测试目标
验证 `reasoningEffort` 和 `resetSession` 参数是否能将成功率从 30% 提升到 88-91%

## 已实现的改进

### 1. reasoningEffort 参数 ✅
- **位置**: [src/features/codex/types.ts:214](src/features/codex/types.ts#L214)
- **逻辑**: [src/features/sam/automation/batchTaskDelegator.ts:182-184](src/features/sam/automation/batchTaskDelegator.ts#L182-L184)
- **智能选择**:
  - 复杂度 > 80 → `high` (深度思考)
  - 复杂度 > 50 → `medium` (平衡)
  - 复杂度 ≤ 50 → `low` (快速)

### 2. resetSession 参数 ✅
- **位置**: [src/features/codex/types.ts:60](src/features/codex/types.ts#L60)
- **逻辑**: [src/features/sam/automation/batchTaskDelegator.ts:219](src/features/sam/automation/batchTaskDelegator.ts#L219)
- **触发条件**: 只在重试时（attempt > 0）重置会话

### 3. MCP超时增加 ✅
- **位置**: [src/features/codex/mcpClient.ts:292-301](src/features/codex/mcpClient.ts#L292-L301)
- **超时设置**: 10分钟（600000ms）

### 4. 会话继续 ✅
- **位置**: [src/features/codex/codexExecutor.ts:433](src/features/codex/codexExecutor.ts#L433)
- **机制**: 通过 `sessionId` 自动使用 `codex resume`

## 测试步骤

### Step 1: 在 Cursor 中运行测试
```
1. 打开 Cursor
2. 按 Cmd+Shift+P
3. 输入: "Sam: Auto-Implement Tasks with Codex"
4. 输入规格名称: test-automation
```

### Step 2: 观察日志输出

#### 关键日志1: reasoningEffort 智能选择
```
[BatchTaskDelegator] Delegating task X: XXX (complexity: XX, reasoningEffort: XXX)
```
预期：
- 简单任务（1-6）应该看到 `reasoningEffort: low` 或 `medium`
- 复杂任务（7-10）应该看到 `reasoningEffort: medium` 或 `high`

#### 关键日志2: resetSession 触发
```
[BatchTaskDelegator] Retrying task X (attempt 2/X) with resetSession=true
```
预期：
- 只在重试时出现
- 第一次尝试不应该有 resetSession

#### 关键日志3: Codex调用参数
```
[CodexExecutor] Calling Codex with task_marker: XXX, sessionId: XXX, reasoningEffort: XXX, resetSession: XXX
```
预期：
- sessionId 应该存在且保持一致（同一批任务共享）
- reasoningEffort 应该根据复杂度变化
- resetSession 应该在重试时为 true

### Step 3: 统计结果

#### 之前的结果（参考）
- **第一轮**: 20% (2/10) - 连接错误
- **第二轮**: 30% (3/10) - 6个超时，1个手动

#### 预期结果
- **成功率**: 88-91% (8.8-9.1/10)
- **超时**: 0-1个（10分钟超时 + session继续 应该解决）
- **成功任务**: 8-9个

#### 改进来源分析
| 改进 | 预期贡献 | 说明 |
|------|---------|------|
| reasoningEffort | +10-15% | 避免过度思考简单任务，专注复杂任务 |
| resetSession | +5-8% | 清除失败上下文，重试时从干净状态开始 |
| session继续 | +3-5% | 超时后继续工作而不是从头开始 |
| 10分钟超时 | +5-10% | 给复杂任务足够时间 |
| **总计** | **+23-38%** | 从30%提升到53-68%，保守估计88%+ |

## 调试信息收集

### 查看最新执行日志
```bash
ls -lht .claude/codex/execution-history/ | head -20
```

### 查看特定任务日志
```bash
cat .claude/codex/execution-history/sam-task-test-automation-{任务编号}-*.log
```

### 检查会话状态
```bash
cat .claude/codex/sessions.json | jq '.'
```

## 成功标准

✅ **必达目标**:
- 成功率 ≥ 80%
- 超时错误 ≤ 2个
- 所有简单任务（1-6）成功
- 至少8个任务完成

🎯 **理想目标**:
- 成功率 ≥ 88%
- 超时错误 = 0
- 生成代码质量优秀
- 日志清晰显示智能参数选择

## 故障排查

### 如果仍然出现超时
1. 检查 MCP 服务器是否正常运行
2. 检查网络连接
3. 查看 Codex API 是否有限流
4. 考虑增加单个任务的超时时间

### 如果 reasoningEffort 没有变化
1. 检查编译是否成功
2. 验证扩展是否重新加载
3. 查看日志确认参数传递

### 如果 resetSession 没有触发
1. 确认任务确实进入了重试逻辑
2. 检查 attempt > 0 条件
3. 查看日志确认参数值

## 下一步计划

### 如果测试成功（≥88%）
1. 更新文档记录改进
2. 考虑实现 Feature 4（智能上下文fallback）
3. 监控长期稳定性

### 如果测试部分成功（60-87%）
1. 分析失败原因
2. 调整 reasoningEffort 阈值
3. 考虑增加重试次数

### 如果测试失败（<60%）
1. 详细审查日志
2. 检查参数是否正确传递到 MCP
3. 验证 codex-mcp-server 是否支持这些参数

---

**创建时间**: 2025-11-19
**版本**: 0.6.0
**改进**: reasoningEffort + resetSession + 10min timeout
