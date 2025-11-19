# Codex CLI 安装指南

本文档提供Codex CLI的详细安装说明，帮助您在kiro-for-cc扩展中使用Codex工作流编排功能。

## 目录

- [系统要求](#系统要求)
- [安装步骤](#安装步骤)
- [验证安装](#验证安装)
- [常见问题](#常见问题)
- [故障排查](#故障排查)

---

## 系统要求

在安装Codex CLI之前，请确保您的系统满足以下要求：

### 操作系统

- **macOS**: 10.15 (Catalina) 或更高版本
- **Windows**: Windows 10 或更高版本
- **Linux**: Ubuntu 20.04 LTS 或其他主流发行版

### 软件依赖

- **Node.js**: 18.0.0 或更高版本
- **npm**: 8.0.0 或更高版本（随Node.js安装）
- **VSCode**: 1.80.0 或更高版本

### 硬件要求

- **内存**: 至少4GB RAM（推荐8GB或更多）
- **存储空间**: 至少500MB可用空间
- **网络**: 稳定的互联网连接（用于下载和API调用）

---

## 安装步骤

### 方法1：使用npm全局安装（推荐）

这是最简单的安装方法，适用于所有平台。

```bash
# 1. 安装Codex CLI
npm install -g @anthropic-ai/codex-cli

# 2. 验证安装
codex --version
```

### 方法2：使用源码安装

如果您需要最新的开发版本或进行自定义修改：

```bash
# 1. 克隆仓库
git clone https://github.com/anthropics/codex-cli.git
cd codex-cli

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 全局链接
npm link

# 5. 验证安装
codex --version
```

### 方法3：使用包管理器

#### macOS (使用Homebrew)

```bash
# 1. 更新Homebrew
brew update

# 2. 安装Codex CLI
brew install anthropic/tap/codex

# 3. 验证安装
codex --version
```

#### Windows (使用Chocolatey)

```powershell
# 1. 安装Codex CLI
choco install codex-cli

# 2. 验证安装
codex --version
```

#### Linux (使用apt)

```bash
# 1. 添加Anthropic仓库
curl -fsSL https://packages.anthropic.com/gpg | sudo apt-key add -
echo "deb https://packages.anthropic.com/apt stable main" | sudo tee /etc/apt/sources.list.d/anthropic.list

# 2. 更新包列表
sudo apt update

# 3. 安装Codex CLI
sudo apt install codex-cli

# 4. 验证安装
codex --version
```

---

## 验证安装

安装完成后，请执行以下步骤验证安装是否成功：

### 1. 检查版本

```bash
codex --version
```

**预期输出**:
```
codex version 1.2.3
```

### 2. 检查帮助信息

```bash
codex --help
```

**预期输出**:
```
Usage: codex [options] [command]

Claude Codex CLI - Deep reasoning and analysis for complex tasks

Options:
  -V, --version     output the version number
  -h, --help        display help for command

Commands:
  mcp-server        Start the MCP server
  analyze [file]    Analyze code or document
  help [command]    display help for command
```

### 3. 在VSCode中验证

1. 重新启动VSCode
2. 打开kiro-for-cc扩展
3. 检查输出面板（Output → Kiro for Claude Code）
4. 应该看到类似以下的日志：

```
[MCPLifecycleManager] ========================================
[MCPLifecycleManager] Codex CLI检测成功
[MCPLifecycleManager] ========================================
[MCPLifecycleManager] Codex CLI版本: codex version 1.2.3
[MCPLifecycleManager] 版本检查通过: 1.2.3 >= 1.0.0
```

---

## 常见问题

### Q1: 安装后提示"command not found: codex"

**原因**:
- npm全局安装路径未添加到系统PATH
- 安装过程未正确完成

**解决方案**:

**macOS/Linux**:
```bash
# 检查npm全局安装路径
npm config get prefix

# 将npm全局bin目录添加到PATH（在~/.bashrc或~/.zshrc中）
export PATH="$(npm config get prefix)/bin:$PATH"

# 重新加载配置
source ~/.bashrc  # 或 source ~/.zshrc
```

**Windows**:
1. 打开"系统环境变量"设置
2. 编辑PATH变量
3. 添加npm全局安装路径（通常为`%APPDATA%\npm`）
4. 重启命令行窗口

---

### Q2: 版本过低警告

**错误信息**:
```
Codex CLI版本 0.9.5 可能不受支持。推荐使用1.0.0及以上版本。
```

**解决方案**:
```bash
# 卸载旧版本
npm uninstall -g @anthropic-ai/codex-cli

# 安装最新版本
npm install -g @anthropic-ai/codex-cli@latest

# 验证版本
codex --version
```

---

### Q3: Windows上遇到权限错误

**错误信息**:
```
Error: EPERM: operation not permitted
```

**解决方案**:
1. 以管理员身份运行PowerShell或命令提示符
2. 重新执行安装命令
3. 或者配置npm使用用户目录：

```powershell
npm config set prefix %APPDATA%\npm
```

---

### Q4: Linux上安装失败

**错误信息**:
```
npm ERR! Error: EACCES: permission denied
```

**解决方案**:

**方法1**: 使用sudo（不推荐）
```bash
sudo npm install -g @anthropic-ai/codex-cli
```

**方法2**: 配置npm使用用户目录（推荐）
```bash
# 创建全局安装目录
mkdir ~/.npm-global

# 配置npm使用该目录
npm config set prefix '~/.npm-global'

# 添加到PATH（在~/.bashrc或~/.zshrc中）
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc

# 重新加载配置
source ~/.bashrc

# 重新安装
npm install -g @anthropic-ai/codex-cli
```

---

### Q5: MCP服务器启动失败

**错误信息**:
```
[MCPLifecycleManager] Failed to start: spawn codex ENOENT
```

**可能原因**:
1. Codex CLI未正确安装
2. PATH配置问题
3. VSCode未重启

**解决方案**:
1. 在终端中验证：`codex --version`
2. 重新启动VSCode
3. 检查VSCode输出面板的详细日志
4. 如果问题仍然存在，尝试重新安装Codex CLI

---

## 故障排查

### 启用详细日志

如果遇到问题，可以启用详细日志模式：

1. 打开VSCode设置（`Cmd/Ctrl + ,`）
2. 搜索"kfc.codex.logLevel"
3. 设置为"DEBUG"
4. 重新启动VSCode
5. 查看输出面板获取详细日志

### 检查系统环境

运行以下命令检查系统环境：

```bash
# 检查Node.js版本
node --version

# 检查npm版本
npm --version

# 检查npm全局安装路径
npm config get prefix

# 检查PATH变量
echo $PATH  # macOS/Linux
echo %PATH%  # Windows

# 列出全局安装的包
npm list -g --depth=0
```

### 完全卸载和重新安装

如果所有方法都失败，尝试完全卸载和重新安装：

```bash
# 1. 卸载Codex CLI
npm uninstall -g @anthropic-ai/codex-cli

# 2. 清理npm缓存
npm cache clean --force

# 3. 验证卸载成功
codex --version  # 应该显示"command not found"

# 4. 重新安装
npm install -g @anthropic-ai/codex-cli@latest

# 5. 验证安装
codex --version
```

---

## 获取帮助

如果以上方法都无法解决您的问题，可以通过以下渠道获取帮助：

1. **查看官方文档**: [https://docs.anthropic.com/claude/docs/codex-installation](https://docs.anthropic.com/claude/docs/codex-installation)
2. **GitHub Issues**: [https://github.com/anthropics/codex-cli/issues](https://github.com/anthropics/codex-cli/issues)
3. **社区论坛**: [https://community.anthropic.com](https://community.anthropic.com)
4. **kiro-for-cc扩展Issues**: [https://github.com/kiro-for-cc/issues](https://github.com/kiro-for-cc/issues)

---

## 下一步

安装成功后，您可以：

1. 配置Codex API密钥（在VSCode设置中）
2. 查看[Codex工作流编排使用指南](./codex-workflow-orchestration.md)
3. 尝试使用深度推理功能分析复杂的设计文档
4. 探索代码库扫描和智能任务路由功能

---

**文档版本**: 1.0.0
**最后更新**: 2025-01-18
**适用于**: kiro-for-cc v0.3.0+, Codex CLI v1.0.0+
