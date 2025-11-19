# 本地打包和安装指南

本文档介绍如何在本地开发、打包和安装 Kiro for Claude Code 扩展。

## 快速开始

### 方式 1: Slash 命令（最推荐）⭐

在 Claude Code CLI 中直接使用：

```bash
/install     # 一键构建和安装到 VSCode/Cursor
/build       # 仅构建 .vsix 包（不安装）
/dev         # 启动开发模式（watch + F5）
/dev-help    # 查看所有可用命令
/publish     # 发布新版本到 Marketplace
```

**优势：**
- ✅ 无需记忆复杂命令
- ✅ 自动检测环境和编辑器
- ✅ 友好的错误提示和引导
- ✅ 一致的开发体验

### 方式 2: NPM 脚本

使用 NPM 脚本来简化流程：

```bash
# 编译 + 打包 + 自动安装（自动检测 VSCode/Cursor）
npm run install:local

# 或者指定安装目标
npm run install:vscode   # 仅安装到 VSCode
npm run install:cursor   # 仅安装到 Cursor
npm run install:both     # 同时安装到两者
```

**流程说明：**
1. ✅ 自动编译 TypeScript
2. ✅ 自动打包成 .vsix 文件
3. ✅ 自动安装到指定编辑器
4. ✅ 提供安装成功提示

### 方式 3: 开发模式（F5）

适用于频繁修改代码的场景：

1. 在 VSCode 中打开本项目
2. 按 `F5` 键
3. 会自动打开一个新的 VSCode 窗口（Extension Development Host）
4. 在新窗口中打开你的工作项目，插件已自动加载

**开发时快速重新编译：**

```bash
# 仅编译（不打包安装）
npm run quick-update

# 或者
npm run compile

# 然后在 Extension Development Host 窗口中按 Cmd+R (macOS) / Ctrl+R (Linux/Windows) 重新加载
```

### 方式 3: 手动操作

如果你想完全手动控制：

```bash
# 1. 安装依赖（首次）
npm install

# 2. 编译 TypeScript
npm run compile

# 3. 打包
npm run package

# 4. 安装（会生成 kiro-for-cc-{version}.vsix）
code --install-extension kiro-for-cc-0.2.9.vsix
# 或
cursor --install-extension kiro-for-cc-0.2.9.vsix
```

## 脚本详解

### `scripts/build-and-install.sh`

功能完整的自动化脚本，包含：
- ✅ 依赖检查
- ✅ TypeScript 编译
- ✅ VSIX 打包
- ✅ 自动检测安装目标
- ✅ 错误处理和彩色输出

**用法：**

```bash
./scripts/build-and-install.sh           # 自动检测
./scripts/build-and-install.sh vscode    # 仅 VSCode
./scripts/build-and-install.sh cursor    # 仅 Cursor
./scripts/build-and-install.sh both      # 两者都安装
```

### `scripts/quick-update.sh`

快速编译脚本，适用于开发模式：

```bash
./scripts/quick-update.sh
```

然后在 Extension Development Host 中按 `Cmd+R` / `Ctrl+R` 重新加载。

## 常见问题

### Q1: 安装后插件没有更新

**解决方案：**

1. 在扩展面板中找到 "Kiro for Claude Code"
2. 点击"禁用" → 等待 2 秒 → 点击"启用"
3. 重启 VSCode/Cursor
4. 查看版本号是否更新

**验证版本号：**
- 打开扩展面板
- 找到 "Kiro for Claude Code"
- 查看版本号是否与 `package.json` 中的一致

### Q2: 打包失败

**可能原因：**

1. **TypeScript 编译错误**
   ```bash
   npm run compile  # 查看编译错误
   ```

2. **缺少依赖**
   ```bash
   npm install
   ```

3. **vsce 未安装**
   ```bash
   npm install -g vsce
   # 或
   npm install --save-dev vsce
   ```

### Q3: 如何回退到之前的版本

**方法 1: 从 Marketplace 重新安装**

```bash
# 卸载本地版本
code --uninstall-extension heisebaiyun.kiro-for-cc

# 从 Marketplace 安装
code --install-extension heisebaiyun.kiro-for-cc
```

**方法 2: 安装旧的 VSIX 文件**

如果你保留了之前的 .vsix 文件：

```bash
code --install-extension kiro-for-cc-0.2.8.vsix
```

### Q4: 脚本权限错误

```bash
chmod +x scripts/build-and-install.sh
chmod +x scripts/quick-update.sh
```

### Q5: WSL 路径问题

如果在 WSL 环境中遇到路径问题，脚本会自动处理 Windows 路径转换。

## 开发工作流建议

### 日常开发流程

```bash
# 1. 启动 watch 模式（自动编译）
npm run watch

# 2. 按 F5 启动 Extension Development Host

# 3. 修改代码后，在 Extension Development Host 中按 Cmd+R 重新加载

# 4. 测试功能
```

### 准备发布流程

```bash
# 1. 更新版本号
# 编辑 package.json 中的 "version" 字段

# 2. 完整测试
npm run install:local

# 3. 在实际项目中测试所有功能

# 4. 确认无误后提交代码
git add .
git commit -m "chore: bump version to x.x.x"
git tag vx.x.x
git push && git push --tags
```

## 与原 Kiro for CC 的关系

### 安装行为

当你使用 `npm run install:local` 时：

- ✅ **会覆盖升级**现有的 "Kiro for Claude Code" 插件
- ❌ **不会安装**一个新的独立插件
- 原因：VSCode 通过 `publisher.extensionName` 识别插件

### Sam 工作方式

**重要：插件版本的 Sam 与 CLI 的 Sam 是同一个！**

- **工作目录**：完全共享 `.claude/specs/`
- **系统提示词**：共享 `.claude/system-prompts/spec-workflow-starter.md`
- **PROGRESS.md**：共享进度文件
- **唯一区别**：插件提供 UI 按钮和可视化进度

**示例场景：**

```bash
# CLI 启动
$ claude "让Sam跟进需求：用户认证"
# 创建 .claude/specs/user-authentication/PROGRESS.md

# 插件自动检测并显示进度图标 🔄
# 右键点击可继续工作
```

### 混合使用

你可以自由切换：

- **插件启动** → CLI 查看文件
- **CLI 启动** → 插件查看进度
- **插件继续** → CLI 继续
- 完全无缝，因为它们操作相同的文件

## 目录结构

```
kiro-for-cc/
├── scripts/
│   ├── build-and-install.sh    # 自动化打包安装脚本
│   ├── quick-update.sh         # 快速编译脚本
│   ├── build-prompts.js        # Prompt 构建脚本
│   └── watch-prompts.js        # Prompt 监听脚本
├── src/                        # 源代码
├── docs/                       # 文档
│   ├── LOCAL_INSTALL.md        # 本文档
│   └── SAM_INTEGRATION.md      # Sam 使用指南
├── package.json                # 项目配置
└── kiro-for-cc-x.x.x.vsix     # 打包输出（gitignore）
```

## 相关链接

- [README.md](../README.md) - 项目主文档
- [SAM_INTEGRATION.md](./SAM_INTEGRATION.md) - Sam 功能详解
- [CLAUDE.md](../CLAUDE.md) - 项目开发指南

---

**版本**: 0.2.9+
**最后更新**: 2025-01-18
