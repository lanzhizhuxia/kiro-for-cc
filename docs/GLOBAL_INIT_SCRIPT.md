# 全局 init-sam-project 脚本

## 概述

`init-sam-project` 是一个全局命令行工具，用于在任何项目中快速初始化 Sam + Spec 开发环境。

## 安装

### 自动安装（推荐）

在 Kiro for Claude Code 项目目录中运行：

```bash
npm run install-global-init
```

该脚本会：
1. 创建 `~/.local/bin` 目录
2. 安装 `init-sam-project` 脚本
3. 自动配置 PATH 环境变量（需要确认）
4. 设置执行权限

### 手动安装

如果你更喜欢手动安装：

```bash
# 1. 创建目录
mkdir -p ~/.local/bin

# 2. 复制脚本
cp scripts/install-global-init.sh ~/.local/bin/
bash ~/.local/bin/install-global-init.sh

# 3. 添加到 PATH (如果还没有)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## 使用方法

### 在新项目中初始化

```bash
# 1. 进入项目目录
cd ~/my-awesome-project

# 2. 运行初始化脚本
init-sam-project
```

### 脚本会自动完成

1. ✅ 创建目录结构
   - `.claude/system-prompts/`
   - `.claude/specs/`
   - `docs/specs/{in-progress,completed,pending}`

2. ✅ 创建 Sam 符号链接
   - `.claude/system-prompts/spec-workflow-starter.md` → `~/.claude/sam-config/spec-workflow-starter.md`
   - `.claude/PM_QUICK_REFERENCE.md` → `~/.claude/sam-config/PM_QUICK_REFERENCE.md`
   - `docs/specs/PM_ENHANCEMENT_SUMMARY.md` → `~/.claude/sam-config/PM_ENHANCEMENT_SUMMARY.md`

3. ✅ 创建需求索引
   - `docs/specs/REQUIREMENTS_INDEX.md`

4. ✅ 配置 .gitignore
   - 排除 `.claude/specs/` (临时文件)
   - 排除 `.claude/codex/` (会话数据)

5. ✅ 安装 Codex MCP 服务器
   - 自动检测是否已安装
   - 交互式安装流程

6. ✅ 验证安装
   - Sam 配置链接
   - 需求索引文件
   - Codex MCP 状态

7. ✅ 可选创建 Spec 开发指南
   - `docs/specs/README.md`

## 初始化后使用 Sam

```bash
# 启动 Claude Code，然后对话：
"让Sam跟进这个需求: 实现用户认证功能"
"Sam继续上次的工作"
"Sam总结下这次的工作"
```

Sam 会自动：
- ✅ 决定 agent 数量和并行策略
- ✅ 选择技术方案（现有技术栈内）
- ✅ 跨会话任务连续性（PROGRESS.md）
- ✅ 自我复盘和改进建议

## 前置条件

在使用 `init-sam-project` 之前，需要确保：

1. **Sam 配置已部署**（在任意 Kiro for CC 项目中运行一次）：
   ```bash
   npm run setup-sam-config
   ```

2. **Claude CLI 已安装**：
   ```bash
   # 检查是否安装
   claude --version

   # 如果未安装，请访问：
   # https://docs.anthropic.com/claude/docs/claude-cli
   ```

## 验证安装

```bash
# 1. 检查脚本是否在 PATH 中
which init-sam-project
# 应该输出: /Users/你的用户名/.local/bin/init-sam-project

# 2. 测试运行
init-sam-project --help
# 或者在测试项目中运行
```

## 故障排查

### 问题：找不到命令 init-sam-project

**原因**：`~/.local/bin` 不在 PATH 中

**解决方案**：
```bash
# 添加到 PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 问题：Codex MCP 安装失败

**原因**：`claude` 命令不可用或版本过低

**解决方案**：
```bash
# 1. 检查 Claude CLI
claude --version

# 2. 手动安装 Codex MCP
claude mcp add codex-cli npx @anthropic-ai/codex-cli

# 3. 验证
claude mcp list
```

### 问题：符号链接创建失败

**原因**：`~/.claude/sam-config/` 目录不存在

**解决方案**：
```bash
# 在 Kiro for CC 项目中运行
cd /path/to/kiro-for-cc
npm run setup-sam-config
```

## 更新脚本

当 Kiro for Claude Code 更新后，重新运行安装脚本即可：

```bash
cd /path/to/kiro-for-cc
npm run install-global-init
```

## 卸载

```bash
# 删除脚本
rm ~/.local/bin/init-sam-project

# 可选：从 PATH 中移除（编辑 ~/.zshrc）
# 删除这一行: export PATH="$HOME/.local/bin:$PATH"
```

## 相关文档

- [Sam 配置管理](../scripts/setup-sam-config.sh)
- [PM 能力说明](../docs/specs/PM_ENHANCEMENT_SUMMARY.md)
- [Sam 自动化指南](./SAM_AUTO_IMPLEMENTATION_GUIDE.md)
- [Codex 集成指南](./SAM_CODEX_INTEGRATION_GUIDE.md)

## 版本历史

- **v1.0.1** (2025-11-19): 修复 `claude mcp add` 命令参数错误
- **v1.0.0** (2025-11-19): 首次发布，支持一键初始化 Sam + Spec 环境
