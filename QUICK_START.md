# Kiro for Claude Code - 快速开始

## 🚀 Slash 命令（推荐）

在 Claude Code CLI 中直接使用：

```bash
/install     # 一键构建和安装到 VSCode/Cursor
/build       # 仅构建 .vsix 包（不安装）
/dev         # 启动开发模式（watch + F5 说明）
/dev-help    # 查看所有可用命令和工作流
/publish     # 发布新版本到 Marketplace
```

## 📦 或使用 NPM 脚本

```bash
npm run install:local
```

就这么简单！脚本会自动：
- ✅ 编译 TypeScript
- ✅ 打包扩展
- ✅ 安装到 VSCode/Cursor
- ✅ 提供安装成功提示

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm run install:local` | 自动检测并安装 |
| `npm run install:vscode` | 仅安装到 VSCode |
| `npm run install:cursor` | 仅安装到 Cursor |
| `npm run install:both` | 同时安装到两者 |
| `npm run quick-update` | 快速编译（开发模式） |
| `npm run watch` | 监听文件变化自动编译 |
| `npm run compile` | 手动编译 |
| `npm run package` | 仅打包（不安装） |

## 开发流程

### 日常开发（推荐）

**使用 Slash 命令：**
```bash
/dev    # 启动开发模式，会引导你使用 watch + F5 工作流
```

**或手动操作：**
```bash
# 1. 启动 watch 模式
npm run watch

# 2. 按 F5 启动 Extension Development Host

# 3. 修改代码后，在 Extension Development Host 中：
#    - macOS: Cmd+R
#    - Windows/Linux: Ctrl+R
```

### 测试新版本

**使用 Slash 命令：**
```bash
/install    # 一键构建、打包、安装
```

**或使用 NPM：**
```bash
# 完整编译、打包、安装
npm run install:local

# 重启 VSCode/Cursor 查看效果
```

## 问题排查

### 插件未更新？

```bash
# 1. 禁用插件
# 2. 等待 2 秒
# 3. 启用插件
# 4. 重启编辑器
```

### 编译错误？

```bash
# 重新安装依赖
npm install

# 清理后重新编译
npm run compile
```

### 脚本权限错误？

```bash
chmod +x scripts/*.sh
```

## 详细文档

- [完整安装指南](docs/LOCAL_INSTALL.md)
- [Sam 功能说明](docs/SAM_INTEGRATION.md)
- [项目 README](README.md)

---

**提示**：首次安装请使用 `npm install` 安装依赖。
