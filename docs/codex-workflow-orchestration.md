# Codex工作流编排系统 - 用户指南

> **版本**: 1.0.0
> **适用于**: Kiro for Claude Code v0.3.0+

## 目录

- [功能概述](#功能概述)
- [安装和配置](#安装和配置)
- [使用教程](#使用教程)
- [常见问题解答](#常见问题解答)
- [故障排查](#故障排查)
- [附录](#附录)

---

## 功能概述

### 系统简介

Codex工作流编排系统是一个智能的任务路由和执行管理系统,为Kiro for Claude Code扩展提供深度推理和分析能力。该系统能够根据任务复杂度自动选择最佳执行方式,从而提升复杂场景下的开发效率。

**核心价值**:
- ✅ **智能任务路由**: 根据任务复杂度自动推荐使用Codex或本地agent
- ✅ **深度推理能力**: 在关键决策节点提供sequential-thinking深度分析
- ✅ **代码库分析**: 自动扫描和分析项目结构,生成上下文信息
- ✅ **安全控制**: 保护敏感文件,拦截危险操作,确保安全执行
- ✅ **无缝集成**: 与现有spec工作流完全兼容,无需改变使用习惯

### 主要功能列表

| 功能模块 | 功能描述 | 使用场景 |
|---------|---------|---------|
| **智能任务路由** | 自动分析任务复杂度,推荐执行模式 | 创建spec、执行任务时自动触发 |
| **复杂度评分引擎** | 多维度评估任务难度(代码规模、技术难度、业务影响) | 系统自动在后台执行 |
| **深度推理分析** | 使用Claude Codex进行问题分解、风险识别、方案对比 | 设计review、技术决策时可选启用 |
| **代码库扫描** | 自动识别相关文件、构建依赖图、分析调用链 | Codex模式下自动或手动启用 |
| **会话管理** | 保存执行状态,支持跨会话恢复 | 长时间任务执行时自动管理 |
| **安全防护** | 文件访问控制、危险命令拦截、敏感信息脱敏 | 系统自动保护,无需配置 |
| **执行历史** | 记录每次执行的完整日志和分析报告 | 通过命令查看历史记录 |
| **进度监控** | 实时显示执行进度和当前步骤 | 任务执行时自动显示 |

### 使用场景

**适用场景**:
- 📋 **复杂设计文档review**: 涉及多个子系统、架构变更的设计评审
- 🔧 **跨文件重构任务**: 需要分析依赖关系和影响范围的重构
- 🐛 **复杂问题调试**: 涉及多个模块交互的bug分析
- 🆕 **新技术引入决策**: 需要深度评估技术方案的可行性
- 🔄 **数据库迁移设计**: 需要评估性能影响和风险的数据库变更

**不适用场景**:
- ❌ 简单的文档修改
- ❌ 单个文件的小修改
- ❌ 纯配置类任务

### 与现有spec工作流的关系

Codex工作流编排系统是现有spec工作流的**增强版**,而非替代品。两者关系如下:

```
传统Spec工作流                    Codex增强工作流
    │                                  │
    ├─ Requirements ───────────────── Requirements (可选Codex分析)
    │       ↓                               ↓
    ├─ Design ──────────────────────── Design (支持深度review)
    │       ↓                               ↓
    └─ Tasks ───────────────────────── Tasks (支持单个任务Codex执行)
            ↓                               ↓
       Implementation                  Implementation
```

**集成方式**:
- 默认使用本地agent执行(保持原有体验)
- 遇到复杂任务时,系统会推荐使用Codex
- 用户可以随时手动切换执行模式
- 支持在任何阶段启用深度推理

---

## 安装和配置

### 前置要求

1. **已安装Kiro for Claude Code扩展**
   - 版本要求: v0.3.0或更高
   - 安装方式: VSCode Marketplace或从VSIX文件安装

2. **已安装Codex CLI** (可选,仅使用Codex功能时需要)
   - 安装验证: 在终端运行 `codex --version`
   - 如未安装: 访问 [Codex CLI官方文档](https://docs.anthropic.com/codex) 获取安装指引

3. **VSCode版本要求**
   - VSCode 1.80.0或更高版本

### VSCode扩展安装

如果还未安装Kiro for Claude Code扩展,请参考以下步骤:

**方法1: 从Marketplace安装**
```bash
# VSCode用户
code --install-extension heisebaiyun.kiro-for-cc

# Cursor用户
cursor --install-extension heisebaiyun.kiro-for-cc
```

**方法2: 从VSIX文件安装**
1. 下载最新的 `.vsix` 文件
2. 在VSCode中按 `Cmd+Shift+P` / `Ctrl+Shift+P`
3. 输入 "Install from VSIX"
4. 选择下载的VSIX文件

### Codex CLI安装

如果希望使用Codex深度分析功能,需要安装Codex CLI:

**检查是否已安装**:
```bash
codex --version
```

**如未安装,请访问官方文档**:
- [Codex CLI安装指南](https://docs.anthropic.com/codex/installation)
- [Codex CLI快速开始](https://docs.anthropic.com/codex/quickstart)

> **提示**: 首次使用Codex功能时,系统会自动检测CLI是否安装,如果未安装会显示安装指引。

### 首次配置步骤

1. **初始化工作区目录**

   首次使用时,系统会自动创建必要的目录结构:
   ```
   .claude/
   └── codex/
       ├── mcp-config.json          # MCP服务器配置
       ├── sessions.json            # 会话记录
       ├── execution-history/       # 执行历史目录
       ├── security-log.json        # 安全审计日志
       └── preferences.json         # 用户偏好设置
   ```

2. **配置Codex API密钥** (可选)

   如果Codex CLI需要API密钥:

   - 按 `Cmd+Shift+P` / `Ctrl+Shift+P`
   - 输入 "Kiro: Configure Codex API Key"
   - 在弹出的输入框中输入API密钥
   - 密钥会安全存储在VSCode的SecretStorage中

   > **安全提示**: 系统使用VSCode的SecretStorage API加密存储API密钥,不会明文保存。

3. **配置默认执行模式** (可选)

   打开VSCode设置 (`Cmd+,` / `Ctrl+,`),搜索 "Kiro Codex",配置以下选项:

   - `kfc.codex.defaultMode`: 默认执行模式
     - `auto` (默认): 根据复杂度自动选择
     - `local`: 始终使用本地agent
     - `codex`: 始终使用Codex

   - `kfc.codex.autoScan`: 自动扫描代码库 (默认: true)
   - `kfc.codex.timeout`: Codex超时时间 (默认: 120000ms)

4. **配置安全白名单** (可选)

   如果需要限制Codex访问的文件范围,可以在 `.claude/settings/kfc-settings.json` 中配置:

   ```json
   {
     "codex": {
       "security": {
         "allowedPaths": [
           "src/**",
           "tests/**",
           "docs/**"
         ]
       }
     }
   }
   ```

5. **创建或更新 `.claudeignore` 文件** (可选)

   在项目根目录创建 `.claudeignore` 文件,指定Codex不应访问的文件或目录:

   ```
   # 依赖目录
   node_modules/
   .git/

   # 构建产物
   dist/
   build/

   # 敏感文件
   .env
   credentials.json
   *.pem
   *.key
   ```

### MCP服务器配置

MCP (Model Context Protocol) 服务器是Codex通信的核心组件,系统会自动管理其生命周期。

**默认配置** (`.claude/codex/mcp-config.json`):
```json
{
  "port": 8765,
  "timeout": 300000,
  "logLevel": "INFO",
  "maxConcurrentTasks": 3
}
```

**可配置参数**:
- `port`: MCP服务器监听端口 (默认: 8765)
- `timeout`: 单次请求超时时间 (默认: 300000ms = 5分钟)
- `logLevel`: 日志级别 (`DEBUG` / `INFO` / `WARN` / `ERROR`)
- `maxConcurrentTasks`: 最大并发任务数 (默认: 3)

> **注意**: 通常情况下无需手动修改MCP配置,系统会自动管理服务器启动和关闭。

### 验证配置

配置完成后,可以通过以下步骤验证:

1. **检查Codex CLI安装**:
   ```bash
   codex --version
   ```
   应显示版本号,例如: `Codex CLI v1.2.0`

2. **测试简单任务**:
   - 创建一个简单的spec任务
   - 观察系统是否正常推荐执行模式
   - 检查输出面板 (View → Output → Kiro for CC) 是否有日志输出

3. **检查目录结构**:
   确认 `.claude/codex/` 目录已创建,且包含必要的配置文件

如果遇到问题,请参考 [故障排查](#故障排查) 章节。

---

## 使用教程

### 基础使用流程

#### 1. 创建spec任务

**步骤**:
1. 点击VSCode活动栏的 "Kiro for CC" 图标
2. 在 "SPEC" 视图中,点击 `+` 按钮或 "✨ New Spec with Agents" 按钮
3. 输入功能描述,例如: "实现用户认证系统,支持JWT和OAuth2"
4. 系统会自动生成需求文档 (requirements.md)

**系统行为**:
- 自动分析任务描述的复杂度
- 如果复杂度评分 ≥ 7,会推荐使用Codex模式
- 显示推荐理由和置信度

[TODO: 添加截图 - 创建spec界面]

#### 2. 系统自动路由决策

**复杂度评分维度**:
- **代码规模** (30%权重): 涉及文件数量、代码行数
- **技术难度** (40%权重): AST修改、异步复杂度、新技术引入、数据库迁移
- **业务影响** (30%权重): 跨模块影响、核心API变更

**评分标准**:
- 评分 1-3: 简单任务 → 推荐本地agent
- 评分 4-6: 中等任务 → 推荐本地agent
- 评分 7-10: 复杂任务 → 推荐Codex

**示例场景**:

| 任务描述 | 代码规模 | 技术难度 | 业务影响 | 总分 | 推荐模式 |
|---------|---------|---------|---------|------|---------|
| 修改按钮文案 | 2 | 1 | 1 | 1.3 | Local |
| 新增API端点 | 4 | 5 | 4 | 4.4 | Local |
| 重构认证系统 | 8 | 9 | 9 | 8.7 | Codex |
| 数据库迁移设计 | 7 | 10 | 8 | 8.5 | Codex |

[TODO: 添加截图 - 复杂度分析结果界面]

#### 3. 查看推荐理由

当系统推荐使用Codex时,会显示详细的推荐理由:

**推荐对话框内容示例**:
```
建议使用Codex深度分析 (复杂度评分: 8.7/10)

推荐理由:
• 代码规模较大 (评分: 8.0/10) - 涉及12个文件
• 技术难度很高 (评分: 9.0/10) - 包含: AST修改, 异步/并发处理, 数据库迁移
• 业务影响范围广 (评分: 9.0/10) - 跨多个模块, 影响核心API

置信度: 95%

[使用Codex]  [使用本地Agent]
```

**理解置信度**:
- 90-100%: 非常确定,推荐遵循系统建议
- 70-89%: 较为确定,可以考虑系统建议
- <70%: 不太确定,用户可自行判断

[TODO: 添加截图 - 推荐理由对话框]

#### 4. 确认或覆盖执行模式

**场景1: 接受推荐**
- 点击 "使用Codex" 按钮
- 系统会记录决策,用于后续偏好学习

**场景2: 覆盖推荐**
- 点击 "使用本地Agent" 按钮
- 系统同样会记录决策,逐步学习用户偏好

**场景3: 手动指定模式**
- 在任务卡片上右键
- 选择 "使用Codex执行" 或 "使用本地Agent执行"
- 强制使用指定模式,忽略系统推荐

### 核心功能使用

#### 设计文档深度分析

**使用场景**: 完成设计文档后,需要全面评审技术可行性、性能影响和安全风险时使用。

**步骤**:
1. 在spec目录中完成 `design.md` 文档
2. 在文档顶部会显示 CodeLens: "深度分析 (Codex)"
3. 点击 "深度分析" CodeLens
4. 系统会启动深度推理引擎,执行以下分析:
   - **问题分解**: 将设计拆解为子问题树
   - **风险识别**: 识别技术、安全、性能、可维护性风险
   - **方案对比**: 评估不同实现方案的优劣
   - **决策建议**: 基于分析给出推荐决策和后续步骤

**分析时长**: 通常 30-120 秒,复杂文档可能需要更长时间

**分析结果展示**:
- 以WebView形式展示,支持可折叠树形结构
- 风险按严重程度标注颜色 (🔴 高风险 / 🟡 中风险 / 🟢 低风险)
- 可导出为Markdown报告

[TODO: 添加截图 - 深度分析WebView界面]

**示例分析报告结构**:
```markdown
# 深度分析报告

## 1. 问题分解
- P1: 用户认证流程设计
  - P1.1: JWT token生成和验证 (复杂度: 6)
  - P1.2: OAuth2集成 (复杂度: 8)
  - P1.3: 会话管理 (复杂度: 5)

## 2. 风险识别
- 🔴 R1: [安全风险] JWT密钥管理不当可能导致token泄露
  - 缓解措施: 使用环境变量存储密钥,启用密钥轮换机制
- 🟡 R2: [性能风险] OAuth2回调可能增加响应延迟
  - 缓解措施: 实现异步处理,添加超时控制

## 3. 方案对比
- S1: 使用Passport.js库
  - 优点: 成熟稳定, 社区活跃, 文档完善
  - 缺点: 依赖较多, 打包体积大
  - 评分: 8/10
- S2: 自行实现JWT验证
  - 优点: 轻量级, 可控性强
  - 缺点: 需要处理更多边界情况, 维护成本高
  - 评分: 6/10

## 4. 推荐决策
- 选择方案: S1 (Passport.js)
- 理由: 成熟度高,安全性经过验证,可减少开发风险
- 预计工作量: 3-5天
- 后续步骤:
  1. 安装Passport.js和相关策略插件
  2. 配置JWT和OAuth2策略
  3. 实现中间件和路由
  4. 编写单元测试和集成测试
```

#### 任务级Codex执行

**使用场景**: 在tasks阶段,对某个复杂任务单独启用Codex执行。

**步骤**:
1. 打开 `tasks.md` 文件
2. 在任务列表中,每个任务都会显示 CodeLens
3. 点击 "使用Codex执行" CodeLens
4. 系统会:
   - 可选启用代码库扫描
   - 可选启用深度推理
   - 使用Codex执行任务
   - 生成执行报告

**与设计分析的区别**:
- 设计分析: 侧重于**评审和决策**,不涉及代码实现
- 任务执行: 侧重于**具体实现**,可能涉及代码生成和修改

[TODO: 添加截图 - 任务CodeLens界面]

#### 查看执行日志

**实时日志**:
- 在VSCode输出面板 (View → Output)
- 选择 "Kiro for CC" 通道
- 实时查看任务执行日志、MCP通信、推理步骤

**执行历史**:
- 按 `Cmd+Shift+P` / `Ctrl+Shift+P`
- 输入 "Kiro: View Codex Execution History"
- 查看最近10次执行记录
- 点击记录可查看详细日志和报告

**日志级别**:
- `DEBUG`: 详细的调试信息 (包含MCP请求和响应)
- `INFO`: 一般信息 (默认)
- `WARN`: 警告信息
- `ERROR`: 错误信息

**配置日志级别**:
```json
{
  "kfc.codex.logLevel": "DEBUG"  // 或 INFO, WARN, ERROR
}
```

#### 查看进度和取消任务

**进度显示**:
- 任务执行时,会在状态栏显示进度指示器
- 显示当前阶段和进度百分比
- 例如: "🔄 正在分析代码库... 30%"

**执行阶段**:
1. **初始化** (0-10%): 创建会话,加载配置
2. **路由决策** (10-20%): 分析复杂度,选择执行模式
3. **代码库扫描** (20-50%): 识别相关文件,构建依赖图 (如启用)
4. **深度推理** (50-80%): 执行sequential thinking分析 (如启用)
5. **执行任务** (80-95%): 实际执行任务
6. **保存结果** (95-100%): 保存会话状态和执行报告

**取消任务**:
- 点击进度对话框的 "取消" 按钮
- 系统会:
  - 停止当前执行
  - 保存中间结果到 `.claude/codex/intermediate/`
  - 显示中间结果保存路径

> **提示**: 取消后可以通过会话恢复功能继续之前的工作。

[TODO: 添加截图 - 进度指示器界面]

### 高级功能

#### 配置默认执行模式

**全局配置**:
1. 打开VSCode设置 (`Cmd+,` / `Ctrl+,`)
2. 搜索 "kfc.codex.defaultMode"
3. 选择:
   - `auto`: 根据复杂度自动选择 (推荐)
   - `local`: 始终使用本地agent
   - `codex`: 始终使用Codex

**工作区配置** (覆盖全局配置):
1. 在项目根目录创建 `.vscode/settings.json`
2. 添加配置:
   ```json
   {
     "kfc.codex.defaultMode": "codex"
   }
   ```

**优先级**: 任务手动指定 > 工作区配置 > 全局配置 > 系统默认 (auto)

#### 自定义复杂度阈值

**当前阈值**: 7分 (固定)

**未来支持** (计划中):
- 允许用户自定义阈值
- 允许按任务类型设置不同阈值
- 通过偏好学习自动调整阈值

**偏好学习原理**:
- 系统记录每次用户的执行模式选择
- 分析用户决策与系统推荐的差异
- 逐步调整推荐算法,使其更符合用户习惯

**查看偏好统计**:
```bash
cat .claude/codex/preferences.json
```

示例输出:
```json
{
  "totalDecisions": 25,
  "acceptedRecommendations": 20,
  "overriddenRecommendations": 5,
  "preferencePattern": {
    "design": "codex",
    "requirements": "local",
    "implementation": "auto"
  },
  "lastUpdated": "2025-01-15T10:30:00Z"
}
```

#### 查看执行历史

**命令方式**:
- 按 `Cmd+Shift+P` / `Ctrl+Shift+P`
- 输入 "Kiro: View Codex Execution History"
- 选择要查看的历史记录

**文件方式**:
- 打开 `.claude/codex/execution-history/` 目录
- 每次执行会生成一个日志文件: `{taskId}.log`
- 查看执行报告: `{taskId}-report.md`

**历史记录内容**:
- 任务描述和复杂度评分
- 执行模式和执行时长
- 推理过程摘要
- 生成的文件列表
- 潜在风险提示
- 错误信息 (如有)

---

## 常见问题解答

### Q1: 什么时候应该使用Codex模式?

**推荐使用Codex的场景**:
- ✅ 涉及多个文件的重构任务
- ✅ 复杂的设计文档评审
- ✅ 跨子系统的架构变更
- ✅ 新技术引入的可行性评估
- ✅ 数据库迁移方案设计
- ✅ 性能优化方案分析
- ✅ 安全风险评估

**不推荐使用Codex的场景**:
- ❌ 单个文件的简单修改
- ❌ 文档文案修改
- ❌ 配置文件调整
- ❌ 样式调整
- ❌ 简单的bug修复

**经验法则**:
- 如果任务需要你**深入思考**和**权衡多个方案** → 使用Codex
- 如果任务是**常规操作**和**明确步骤** → 使用本地agent

### Q2: 如何判断任务复杂度?

**复杂度评分由以下因素决定**:

1. **代码规模** (30%权重):
   - 涉及文件数量: 1-5个 (低), 6-15个 (中), 16+个 (高)
   - 代码行数: <100行 (低), 100-500行 (中), 500+行 (高)

2. **技术难度** (40%权重):
   - 是否涉及AST修改/代码生成
   - 是否涉及异步/并发处理
   - 是否引入新技术/框架
   - 是否需要数据库迁移

3. **业务影响** (30%权重):
   - 是否影响多个子系统
   - 是否修改核心API
   - 是否影响数据模型

**查看评分详情**:
系统推荐时会显示详细的评分breakdown,包括每个维度的分数和主要因素。

### Q3: MCP服务器启动失败怎么办?

**常见原因和解决方法**:

1. **Codex CLI未安装**:
   ```bash
   # 检查安装
   codex --version

   # 如未安装,访问官方文档
   # https://docs.anthropic.com/codex/installation
   ```

2. **端口被占用**:
   ```bash
   # 检查8765端口是否被占用
   lsof -i :8765

   # 修改MCP端口配置
   # 编辑 .claude/codex/mcp-config.json
   # 修改 "port": 8766
   ```

3. **权限问题**:
   ```bash
   # 确保有执行权限
   chmod +x $(which codex)
   ```

4. **环境变量问题**:
   - 确保PATH环境变量包含Codex CLI路径
   - 重启VSCode使环境变量生效

**查看详细错误日志**:
- 打开输出面板 (View → Output)
- 选择 "Kiro for CC" 通道
- 查找 "[MCPLifecycleManager]" 相关日志

### Q4: 如何查看执行日志?

**实时日志**:
1. 打开VSCode输出面板: View → Output (或 `Cmd+Shift+U` / `Ctrl+Shift+U`)
2. 在下拉菜单中选择 "Kiro for CC"
3. 查看实时日志输出

**历史日志**:
1. 打开 `.claude/codex/execution-history/` 目录
2. 查找对应的 `{taskId}.log` 文件
3. 或使用命令: "Kiro: View Codex Execution History"

**日志内容说明**:
- `[CodexOrchestrator]`: 编排器主流程日志
- `[TaskRouter]`: 路由决策日志
- `[ComplexityAnalyzer]`: 复杂度分析日志
- `[DeepThinkingEngine]`: 深度推理引擎日志
- `[MCPClient]`: MCP通信日志
- `[SecurityGuard]`: 安全检查日志

### Q5: 执行超时怎么处理?

**默认超时时间**: 120秒 (2分钟)

**修改超时配置**:
```json
{
  "kfc.codex.timeout": 300000  // 5分钟 (单位: 毫秒)
}
```

**超时后的行为**:
- 系统会自动停止当前执行
- 保存中间结果到 `.claude/codex/intermediate/`
- 显示通知,可选择查看中间结果或重试

**避免超时的建议**:
- 将大任务拆分为多个小任务
- 缩小代码库扫描范围
- 使用`.claudeignore`排除无关文件
- 提高网络稳定性 (如果使用云端Codex服务)

### Q6: 敏感文件会被上传吗?

**安全保护机制**:

1. **文件访问控制**:
   - 自动检测敏感文件 (`.env`, `credentials.json`, 私钥等)
   - 基于`.claudeignore`过滤文件
   - 支持白名单配置

2. **内容脱敏**:
   - API密钥自动替换为 `***REDACTED***`
   - 密码和token自动脱敏
   - 数据库连接串隐藏用户名密码
   - JWT token自动脱敏
   - 私钥自动脱敏

3. **审计日志**:
   - 所有敏感文件访问都会记录到 `.claude/codex/sensitive-access.log`
   - 包含访问时间、文件路径、检测到的敏感模式

**敏感文件列表**:
```
.env, .env.*
credentials.json, secrets.json
.ssh/, .aws/
id_rsa, id_ed25519
*.pem, *.key, *.p12, *.pfx
passwords.txt, tokens.json
service-account.json
.kube/config, .docker/config.json
```

**验证脱敏效果**:
查看 `.claude/codex/sensitive-access.log` 文件,确认敏感文件已被正确处理。

### Q7: 如何配置白名单路径?

**场景**: 限制Codex只能访问特定目录,增强安全性。

**配置方法**:
编辑 `.claude/settings/kfc-settings.json`:
```json
{
  "codex": {
    "security": {
      "allowedPaths": [
        "src/**",           // 允许src目录下所有文件
        "tests/**",         // 允许tests目录下所有文件
        "docs/**",          // 允许docs目录下所有文件
        "package.json",     // 允许特定文件
        "tsconfig.json"
      ]
    }
  }
}
```

**glob模式说明**:
- `**`: 匹配任意层级目录
- `*`: 匹配当前层级的任意文件/目录
- `?`: 匹配单个字符

**白名单策略**:
- 如果配置了 `allowedPaths`,只有匹配的文件可以访问
- 如果未配置 `allowedPaths`,则依赖 `.claudeignore` 进行过滤
- 白名单和 `.claudeignore` 可以同时使用

### Q8: 执行失败如何调试?

**步骤1: 查看错误日志**
```bash
# 打开输出面板
View → Output → 选择 "Kiro for CC"

# 或查看历史日志
cat .claude/codex/execution-history/{taskId}.log
```

**步骤2: 识别错误类型**

| 错误类型 | 日志特征 | 可能原因 |
|---------|---------|---------|
| MCP连接失败 | `[MCPClient] Connection failed` | Codex CLI未安装或未启动 |
| 超时错误 | `timeout` | 任务太复杂或网络慢 |
| 权限错误 | `Permission denied` | 文件访问权限不足 |
| 配置错误 | `Config validation failed` | 配置文件格式错误 |
| API错误 | `API call failed` | API密钥无效或配额不足 |

**步骤3: 根据错误类型解决**

- **MCP连接失败**: 参考 [Q3: MCP服务器启动失败](#q3-mcp服务器启动失败怎么办)
- **超时错误**: 参考 [Q5: 执行超时怎么处理](#q5-执行超时怎么处理)
- **权限错误**: 检查文件权限,确保有读取权限
- **配置错误**: 验证JSON格式是否正确
- **API错误**: 重新配置API密钥,检查配额

**步骤4: 启用DEBUG日志**
```json
{
  "kfc.codex.logLevel": "DEBUG"
}
```
重新执行任务,查看详细的调试信息。

**步骤5: 导出诊断报告**
```bash
# 按 Cmd+Shift+P / Ctrl+Shift+P
# 输入 "Kiro: Export Diagnostic Report"
# 选择保存路径
```
诊断报告包含:
- 配置文件内容
- 最近50条日志
- 错误堆栈
- 系统信息 (VSCode版本、Node版本、操作系统)

### Q9: 如何提升分析准确性?

**提供更多上下文**:
- 在任务描述中详细说明需求和约束
- 提供相关的设计文档链接或参考
- 列出关键的技术栈和依赖

**启用代码库扫描**:
- 确保 `kfc.codex.autoScan` 设置为 `true`
- 更新 `.claudeignore` 排除无关文件,加快扫描速度

**使用合适的任务类型**:
- `design`: 设计评审和架构决策
- `requirements`: 需求分析
- `implementation`: 代码实现
- `debug`: 问题调试
- `review`: 代码review

**提供反馈**:
- 在分析结果WebView中点击 "有用" 或 "无用" 按钮
- 提供具体的改进建议
- 系统会基于反馈优化推理提示词

### Q10: 如何管理执行成本?

**成本因素**:
- Codex API调用次数
- 深度推理时长
- 代码库扫描范围

**节省成本的建议**:

1. **合理使用auto模式**:
   - 让系统自动选择执行模式
   - 简单任务使用本地agent (免费)

2. **限制代码库扫描范围**:
   ```
   # .claudeignore
   node_modules/
   dist/
   *.log
   *.test.ts  # 排除测试文件
   ```

3. **使用缓存**:
   - 代码库扫描结果会缓存24小时
   - 重复执行相同任务时会利用缓存

4. **拆分大任务**:
   - 将复杂任务拆分为多个小任务
   - 每个小任务独立执行,避免整体重试

5. **设置合理的超时时间**:
   - 避免设置过长的超时时间
   - 防止长时间占用资源

6. **监控配额使用**:
   ```bash
   # 按 Cmd+Shift+P / Ctrl+Shift+P
   # 输入 "Kiro: View Codex Monitor Panel"
   # 查看API配额使用情况
   ```

---

## 故障排查

### MCP服务器相关问题

#### 问题: MCP服务器无法启动

**症状**:
- 输出日志显示 "MCP server failed to start"
- 任务执行时提示 "MCP client not connected"

**可能原因**:
1. Codex CLI未安装或版本不兼容
2. 端口被其他进程占用
3. 权限不足
4. 环境变量配置错误

**解决步骤**:
1. 验证Codex CLI安装:
   ```bash
   codex --version
   # 应显示版本号,如 Codex CLI v1.2.0
   ```

2. 检查端口占用:
   ```bash
   # macOS/Linux
   lsof -i :8765

   # Windows
   netstat -ano | findstr :8765
   ```
   如果被占用,修改 `.claude/codex/mcp-config.json` 中的端口号。

3. 检查执行权限:
   ```bash
   ls -l $(which codex)
   # 应显示可执行权限 (x)

   # 如无权限,执行:
   chmod +x $(which codex)
   ```

4. 检查环境变量:
   ```bash
   echo $PATH
   # 确保包含Codex CLI所在目录
   ```

5. 查看详细日志:
   - 打开输出面板 (View → Output → Kiro for CC)
   - 设置日志级别为DEBUG:
     ```json
     { "kfc.codex.logLevel": "DEBUG" }
     ```
   - 查找 `[MCPLifecycleManager]` 相关错误信息

**相关日志位置**: `.claude/codex/mcp-server.log`

#### 问题: MCP服务器频繁断开连接

**症状**:
- 任务执行中途失败
- 日志显示 "MCP connection lost"

**可能原因**:
1. 网络不稳定
2. MCP服务器超时配置过短
3. 系统资源不足

**解决步骤**:
1. 增加超时时间:
   编辑 `.claude/codex/mcp-config.json`:
   ```json
   {
     "timeout": 600000  // 从5分钟增加到10分钟
   }
   ```

2. 检查系统资源:
   - 查看CPU和内存使用率
   - 关闭不必要的应用程序
   - 重启VSCode

3. 启用心跳检查:
   系统默认每30秒发送心跳检查,如果连续3次失败会尝试重连。

**相关日志位置**: `.claude/codex/execution-history/`

### 执行失败问题

#### 问题: 任务执行超时

**症状**:
- 进度停滞在某个阶段
- 2分钟后显示超时错误

**可能原因**:
1. 任务过于复杂
2. 代码库扫描范围过大
3. 网络延迟高

**解决步骤**:
1. 增加超时配置:
   ```json
   {
     "kfc.codex.timeout": 300000  // 5分钟
   }
   ```

2. 缩小扫描范围:
   更新 `.claudeignore`,排除大型目录:
   ```
   node_modules/
   .git/
   dist/
   build/
   coverage/
   *.min.js
   ```

3. 将大任务拆分:
   - 将一个大任务拆分为多个小任务
   - 每个小任务独立执行

4. 检查中间结果:
   超时后,系统会保存中间结果到 `.claude/codex/intermediate/`
   查看已完成的部分,调整后继续执行。

**相关日志位置**: `.claude/codex/execution-history/{taskId}.log`

#### 问题: 分析结果不准确或不相关

**症状**:
- 深度分析结果与预期不符
- 推荐方案不适用于当前项目

**可能原因**:
1. 任务描述不够清晰
2. 代码库扫描未启用或范围不当
3. 缺少关键上下文信息

**解决步骤**:
1. 改进任务描述:
   - 明确说明需求和约束
   - 列出关键技术栈
   - 提供参考文档或示例

   **示例对比**:
   ```
   ❌ 不佳: "实现用户登录"

   ✅ 良好: "实现用户登录功能,要求:
   - 支持邮箱和手机号登录
   - 使用JWT进行会话管理
   - 需要集成第三方OAuth2 (Google, GitHub)
   - 技术栈: Node.js + Express + MongoDB
   - 安全要求: 密码加密存储, 防暴力破解"
   ```

2. 启用代码库扫描:
   ```json
   {
     "kfc.codex.autoScan": true
   }
   ```

3. 指定相关文件:
   在任务描述中明确列出需要分析的文件:
   ```
   相关文件:
   - src/auth/auth.service.ts
   - src/users/users.model.ts
   - config/jwt.config.ts
   ```

4. 提供反馈:
   - 在分析结果WebView中点击 "无用" 按钮
   - 提供改进建议
   - 系统会基于反馈优化提示词

**相关日志位置**: `.claude/codex/feedback.json`

### 性能问题

#### 问题: 代码库扫描速度慢

**症状**:
- 扫描阶段耗时超过30秒
- 进度停滞在 "正在分析代码库..." 阶段

**可能原因**:
1. 项目文件数量过多 (>500个)
2. 未排除node_modules等大型目录
3. 文件依赖关系复杂

**解决步骤**:
1. 优化 `.claudeignore`:
   ```
   # 依赖和构建产物
   node_modules/
   bower_components/
   vendor/
   dist/
   build/
   .next/
   out/

   # 测试和覆盖率
   coverage/
   .nyc_output/

   # 缓存和临时文件
   .cache/
   tmp/
   temp/
   *.log

   # 压缩和资源文件
   *.min.js
   *.min.css
   *.map
   static/assets/
   ```

2. 使用增量扫描:
   - 系统会自动检测文件修改时间
   - 仅重新分析变更的文件
   - 缓存有效期: 24小时

3. 限制扫描范围:
   使用白名单仅扫描相关目录:
   ```json
   {
     "codex": {
       "security": {
         "allowedPaths": [
           "src/**",
           "tests/**"
         ]
       }
     }
   }
   ```

4. 监控扫描进度:
   查看输出日志中的 `[CodebaseAnalyzer]` 信息:
   ```
   [CodebaseAnalyzer] Scanning workspace...
   [CodebaseAnalyzer] Found 150 files to analyze
   [CodebaseAnalyzer] Using cached results for 120 files
   [CodebaseAnalyzer] Analyzing 30 modified files...
   ```

**相关日志位置**: `.claude/codex/codebase-scan.log`

#### 问题: 内存使用过高

**症状**:
- VSCode变慢或无响应
- 系统内存使用率>80%
- 输出日志显示 "Memory usage exceeds 500MB"

**可能原因**:
1. 代码库过大
2. 并发任务过多
3. 缓存占用过多内存

**解决步骤**:
1. 减少并发任务数:
   编辑 `.claude/codex/mcp-config.json`:
   ```json
   {
     "maxConcurrentTasks": 1  // 从默认3降低到1
   }
   ```

2. 手动清理缓存:
   ```bash
   rm -rf .claude/codex/cache/*
   ```

3. 缩小扫描范围 (参考上一节)

4. 重启VSCode:
   - 保存当前工作
   - 完全退出VSCode
   - 重新打开项目

**相关日志位置**: `.claude/codex/memory-monitor.log`

### 权限问题

#### 问题: 无法访问某些文件

**症状**:
- 错误信息: "Permission denied"
- 日志显示: "File blocked by .claudeignore"

**可能原因**:
1. 文件在 `.claudeignore` 中被排除
2. 文件在白名单之外
3. 操作系统文件权限不足

**解决步骤**:
1. 检查 `.claudeignore`:
   ```bash
   cat .claudeignore
   # 查看是否包含该文件的模式
   ```
   如果需要访问,从 `.claudeignore` 中移除对应规则。

2. 检查白名单配置:
   ```bash
   cat .claude/settings/kfc-settings.json
   # 查看 codex.security.allowedPaths
   ```
   如果配置了白名单,确保目标文件在白名单内。

3. 检查文件权限:
   ```bash
   ls -l /path/to/file
   # 确保当前用户有读取权限

   # 如无权限,执行:
   chmod 644 /path/to/file
   ```

4. 查看安全日志:
   ```bash
   cat .claude/codex/security-log.json
   # 查找被拦截的文件访问记录
   ```

**相关日志位置**: `.claude/codex/security-log.json`

#### 问题: 危险命令被拦截

**症状**:
- 弹出警告对话框: "Codex正在尝试执行危险命令"
- 命令未执行

**原因**:
- 系统检测到潜在的危险Shell命令 (如 `rm -rf`, `sudo`)

**解决步骤**:
1. **仔细阅读警告信息**:
   - 确认命令内容
   - 了解风险级别 (Critical / High / Medium)
   - 查看拦截原因

2. **评估命令必要性**:
   - 如果确实需要执行,点击 "允许执行"
   - 如果不确定,点击 "拒绝"

3. **查看命令日志**:
   ```bash
   cat .claude/codex/security-log.json
   # 查找command类型的日志
   ```

4. **调整安全策略** (不推荐):
   如果频繁遇到误拦截,可以调整策略:
   ```json
   {
     "codex": {
       "security": {
         "requireShellConfirmation": false  // 不推荐
       }
     }
   }
   ```
   > ⚠️ **警告**: 禁用Shell命令确认会降低安全性,不推荐使用。

**相关日志位置**: `.claude/codex/security-log.json`

### 网络问题

#### 问题: Codex API调用失败

**症状**:
- 错误信息: "API call failed"
- 网络请求超时

**可能原因**:
1. 网络连接不稳定
2. API密钥无效或过期
3. API配额不足
4. 防火墙或代理拦截

**解决步骤**:
1. 检查网络连接:
   ```bash
   ping api.anthropic.com
   # 测试网络连通性
   ```

2. 验证API密钥:
   - 按 `Cmd+Shift+P` / `Ctrl+Shift+P`
   - 输入 "Kiro: Configure Codex API Key"
   - 重新输入API密钥

3. 检查API配额:
   - 访问Codex控制面板查看配额使用情况
   - 或通过命令: "Kiro: View Codex Monitor Panel"

4. 配置代理 (如需要):
   ```bash
   export HTTP_PROXY=http://proxy.example.com:8080
   export HTTPS_PROXY=http://proxy.example.com:8080
   ```

5. 查看网络日志:
   启用DEBUG日志,查看详细的网络请求信息:
   ```json
   { "kfc.codex.logLevel": "DEBUG" }
   ```

**相关日志位置**: `.claude/codex/network.log`

### 配置问题

#### 问题: 配置文件格式错误

**症状**:
- 错误信息: "Config validation failed"
- 无法保存设置

**可能原因**:
1. JSON格式错误 (缺少引号、逗号等)
2. 配置项类型错误
3. 配置文件损坏

**解决步骤**:
1. 验证JSON格式:
   使用在线JSON验证工具 (如 jsonlint.com) 或VSCode内置验证:
   - 打开配置文件
   - 查看右下角是否有错误提示

2. 检查配置schema:
   参考默认配置模板:
   ```json
   {
     "codex": {
       "defaultMode": "auto",
       "timeout": 120000,
       "autoScan": true,
       "mcp": {
         "port": 8765,
         "timeout": 300000,
         "logLevel": "INFO"
       },
       "security": {
         "allowedPaths": [],
         "requireShellConfirmation": true
       }
     }
   }
   ```

3. 恢复默认配置:
   ```bash
   # 备份当前配置
   cp .claude/settings/kfc-settings.json .claude/settings/kfc-settings.json.backup

   # 删除配置文件,让系统重新生成
   rm .claude/settings/kfc-settings.json

   # 重启VSCode
   ```

4. 查看配置验证日志:
   ```bash
   # 输出面板 → Kiro for CC
   # 查找 [ConfigManager] 相关错误
   ```

**相关日志位置**: `.claude/codex/config-validation.log`

---

## 附录

### A. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| **Codex模式** | Codex Mode | 使用Claude Codex进行任务执行的工作模式 |
| **本地agent模式** | Local Agent Mode | 使用kiro-for-cc内置agent系统进行任务执行的工作模式 |
| **任务复杂度评分** | Complexity Score | 系统对任务难度的量化评估,范围1-10分 |
| **MCP服务器** | MCP Server | Model Context Protocol服务器,Codex能力的通信接口 |
| **Deep-thinking模式** | Deep-thinking Mode | 启用sequential-thinking深度推理的执行模式 |
| **代码库扫描** | Codebase Scan | 自动分析项目代码结构和依赖关系的过程 |
| **会话ID** | Session ID | 唯一标识一次Codex任务执行的标识符,格式: `codex-{timestamp}-{uuid}` |
| **推理链** | Thinking Chain | 深度推理过程中的思考步骤序列 |
| **路由决策** | Routing Decision | 系统根据任务特征选择执行模式的过程 |
| **偏好学习** | Preference Learning | 系统根据用户历史决策调整推荐算法的机制 |

### B. 文件和目录结构

```
.claude/                              # 扩展数据根目录
├── codex/                            # Codex相关数据
│   ├── mcp-config.json              # MCP服务器配置
│   ├── sessions.json                # 会话记录
│   ├── preferences.json             # 用户偏好统计
│   ├── security-log.json            # 安全审计日志
│   ├── sensitive-access.log         # 敏感文件访问日志
│   ├── execution-history/           # 执行历史
│   │   ├── {taskId}.log            # 任务执行日志
│   │   └── {taskId}-report.md      # 任务执行报告
│   ├── intermediate/                # 中间结果 (取消或超时时)
│   │   └── {taskId}.json           # 中间状态
│   └── cache/                       # 缓存数据
│       ├── codebase-scan/          # 代码库扫描缓存
│       └── complexity-analysis/    # 复杂度分析缓存
├── specs/                           # Spec文档
│   └── {feature-name}/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
├── settings/
│   └── kfc-settings.json           # 扩展配置
└── system-prompts/
    └── spec-workflow-starter.md   # Spec工作流系统提示词

.claudeignore                        # Codex文件访问黑名单
.vscode/
└── settings.json                   # 工作区级别配置 (可选)
```

### C. 配置选项参考

#### VSCode设置

| 设置项 | 类型 | 默认值 | 说明 |
|-------|------|-------|------|
| `kfc.codex.defaultMode` | enum | `auto` | 默认执行模式: `auto` / `local` / `codex` |
| `kfc.codex.timeout` | number | `120000` | Codex超时时间 (毫秒) |
| `kfc.codex.autoScan` | boolean | `true` | 是否自动扫描代码库 |
| `kfc.codex.logLevel` | enum | `INFO` | 日志级别: `DEBUG` / `INFO` / `WARN` / `ERROR` |

#### MCP配置 (`.claude/codex/mcp-config.json`)

```json
{
  "port": 8765,                  // MCP服务器端口
  "timeout": 300000,             // 单次请求超时 (毫秒)
  "logLevel": "INFO",            // 日志级别
  "maxConcurrentTasks": 3        // 最大并发任务数
}
```

#### 安全配置 (`.claude/settings/kfc-settings.json`)

```json
{
  "codex": {
    "security": {
      "allowedPaths": [          // 白名单路径 (glob模式)
        "src/**",
        "tests/**"
      ],
      "requireShellConfirmation": true  // 是否拦截Shell命令
    }
  }
}
```

### D. 常用命令列表

| 命令 | 快捷键 | 说明 |
|------|-------|------|
| `Kiro: Configure Codex API Key` | - | 配置Codex API密钥 |
| `Kiro: View Codex Execution History` | - | 查看执行历史 |
| `Kiro: View Codex Monitor Panel` | - | 打开监控面板 |
| `Kiro: Export Diagnostic Report` | - | 导出诊断报告 |
| `Kiro: Deep Analysis with Codex` | - | 对当前文档启用深度分析 |
| `Kiro: Clear Codex Cache` | - | 清理缓存 |
| `Kiro: Reload Codex Config` | - | 重新加载配置 |

### E. 错误代码参考

| 错误代码 | 含义 | 解决方法 |
|---------|------|---------|
| `E001` | Codex CLI未安装 | 安装Codex CLI |
| `E002` | MCP服务器启动失败 | 检查端口占用和权限 |
| `E003` | API密钥无效 | 重新配置API密钥 |
| `E004` | 任务执行超时 | 增加超时配置或拆分任务 |
| `E005` | 文件访问被拒绝 | 检查`.claudeignore`和白名单 |
| `E006` | 配置文件格式错误 | 验证JSON格式 |
| `E007` | 内存使用超限 | 减少并发数或清理缓存 |
| `E008` | 网络连接失败 | 检查网络和代理配置 |
| `E009` | 代码库扫描失败 | 缩小扫描范围,检查文件权限 |
| `E010` | 深度推理失败 | 检查API配额和网络连接 |

### F. 性能优化建议

**代码库扫描优化**:
- 使用 `.claudeignore` 排除 `node_modules`, `dist` 等大型目录
- 配置白名单仅扫描相关目录
- 利用缓存机制 (24小时有效期)

**内存优化**:
- 减少最大并发任务数 (默认3 → 1)
- 定期清理缓存: `rm -rf .claude/codex/cache/*`
- 拆分大任务为多个小任务

**网络优化**:
- 使用稳定的网络连接
- 配置合理的超时时间
- 启用本地缓存减少API调用

**执行效率优化**:
- 提供清晰详细的任务描述
- 启用代码库扫描提供更多上下文
- 使用合适的任务类型标签
- 充分利用偏好学习机制

### G. 安全最佳实践

**文件保护**:
1. 始终保持 `.claudeignore` 文件更新
2. 排除所有敏感文件和目录
3. 定期检查 `sensitive-access.log` 审计日志

**API密钥管理**:
1. 使用VSCode SecretStorage存储密钥
2. 不要在代码或配置文件中明文保存
3. 定期轮换API密钥

**命令执行控制**:
1. 保持 `requireShellConfirmation` 启用
2. 仔细审查所有危险命令警告
3. 记录所有命令执行日志

**配置备份**:
1. 定期备份 `.claude/settings/kfc-settings.json`
2. 配置文件修改前自动创建备份
3. 使用版本控制跟踪配置变更

**审计和监控**:
1. 定期检查 `security-log.json`
2. 监控API配额使用情况
3. 查看执行历史发现异常模式

### H. 获取帮助

**官方资源**:
- GitHub仓库: https://github.com/notdp/kiro-for-cc
- 问题反馈: https://github.com/notdp/kiro-for-cc/issues
- VSCode Marketplace: https://marketplace.visualstudio.com/items?itemName=heisebaiyun.kiro-for-cc

**社区支持**:
- GitHub Discussions: https://github.com/notdp/kiro-for-cc/discussions
- Discord频道: (待建立)

**提交bug报告**:
1. 导出诊断报告: "Kiro: Export Diagnostic Report"
2. 在GitHub Issues创建新issue
3. 附上诊断报告和复现步骤
4. 说明预期行为和实际行为

**功能建议**:
1. 在GitHub Discussions的Ideas分类发帖
2. 详细描述使用场景和需求
3. 说明期望的功能行为
4. 参与社区讨论

---

**文档版本**: 1.0.0
**最后更新**: 2025-01-15
**适用版本**: Kiro for Claude Code v0.3.0+

如有疑问或建议,欢迎在GitHub提出issue或参与讨论。
