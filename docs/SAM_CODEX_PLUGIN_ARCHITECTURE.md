# Sam + Codex 插件架构设计

## 问题背景

用户需求：
1. **插件可分发** - 打包给朋友安装使用
2. **配置可部署** - Sam 配置需要部署到正确位置
3. **配置不被覆盖** - 编译/打包不能覆盖用户配置

## 解决方案

### 文件组织架构

```
kiro-for-cc/                         # 插件源代码
├── src/resources/prompts/
│   └── spec-workflow-starter.md    # 📝 源文件（版本控制）
│
├── dist/resources/prompts/          # 📦 编译输出（打包到插件）
│   └── spec-workflow-starter.md
│
├── .claude/system-prompts/
│   └── spec-workflow-starter.md    # 🔗 符号链接 → ~/.claude/sam-config/
│
├── scripts/
│   ├── setup-sam-config.sh         # 🚀 首次部署脚本
│   └── update-sam-config.sh        # 🔄 更新脚本
│
└── ~/.claude/sam-config/            # 🏠 用户配置目录（所有项目共享）
    ├── spec-workflow-starter.md
    ├── backups/                     # 配置备份
    └── README.md
```

### 数据流

#### 开发者流程

```
1. 修改源文件
   src/resources/prompts/spec-workflow-starter.md
   
2. 更新到用户目录
   npm run update-sam-config
   ├── 备份现有配置
   ├── 复制新配置到 ~/.claude/sam-config/
   └── 本地 .claude/system-prompts/ 通过符号链接生效
   
3. 编译打包
   npm run package
   └── webpack 复制 src/resources/ → dist/resources/
   └── 打包成 kiro-for-cc-0.6.0.vsix
```

#### 用户流程

```
1. 安装插件
   cursor --install-extension kiro-for-cc-0.6.0.vsix
   
2. 部署配置
   npm run setup-sam-config
   ├── 从插件中提取配置文件
   ├── 部署到 ~/.claude/sam-config/
   └── 创建本地符号链接
   
3. 使用 Sam
   Sam 读取 ~/.claude/sam-config/spec-workflow-starter.md
   └── 所有项目共享同一份配置
```

### 关键设计点

#### 1. 配置文件加载路径

```typescript
// src/providers/claudeCodeProvider.ts
const systemPromptPath = path.join(
  workspaceRoot,
  '.claude/system-prompts',       // 本地目录
  `${systemPromptName}.md`
);
```

**本地目录结构**：
```
项目A/.claude/system-prompts/spec-workflow-starter.md → ~/.claude/sam-config/
项目B/.claude/system-prompts/spec-workflow-starter.md → ~/.claude/sam-config/
项目C/.claude/system-prompts/spec-workflow-starter.md → ~/.claude/sam-config/
```

所有项目通过符号链接共享同一份配置！

#### 2. 编译不影响用户配置

webpack 配置：
```javascript
new CopyPlugin({
  patterns: [
    { from: 'src/resources', to: 'resources' }  // 只复制到 dist/
  ]
})
```

**结果**：
- ✅ `src/resources/` → `dist/resources/` (打包到插件)
- ❌ **不会**修改 `.claude/system-prompts/`
- ❌ **不会**修改 `~/.claude/sam-config/`

#### 3. 脚本命令

```json
{
  "scripts": {
    "setup-sam-config": "bash ./scripts/setup-sam-config.sh",
    "update-sam-config": "bash ./scripts/update-sam-config.sh"
  }
}
```

**setup-sam-config**:
- 首次部署
- 创建符号链接
- 生成 README

**update-sam-config**:
- 备份现有配置
- 更新新版本
- 保留自定义修改选项

## 配置更新策略

### 场景 1：插件版本更新

```bash
# 用户收到新版插件
cursor --install-extension kiro-for-cc-0.7.0.vsix

# 可选：更新 Sam 配置
cd /path/to/plugin/source
npm run update-sam-config

# 或者保留自定义配置（什么都不做）
```

### 场景 2：用户自定义配置

```bash
# 用户直接编辑
vi ~/.claude/sam-config/spec-workflow-starter.md

# 修改立即生效（所有项目）
# 符号链接自动同步
```

### 场景 3：恢复默认配置

```bash
# 方法1：重新部署
npm run setup-sam-config

# 方法2：从备份恢复
cp ~/.claude/sam-config/backups/spec-workflow-starter_20251119_140000.md \
   ~/.claude/sam-config/spec-workflow-starter.md
```

## 优势总结

✅ **可分发性**
- 插件包含所有配置文件
- 用户安装后一次部署即可

✅ **配置共享**
- 所有项目共享 ~/.claude/sam-config/
- 一处修改，全局生效

✅ **版本控制**
- src/resources/ 在 git 中
- 开发者可追踪配置变更

✅ **安全性**
- 用户配置不会被编译覆盖
- 更新前自动备份

✅ **灵活性**
- 用户可自定义配置
- 可选择是否更新到新版本

## 实现清单

- [x] setup-sam-config.sh 脚本
- [x] update-sam-config.sh 脚本
- [x] package.json 添加命令
- [ ] 修改 src/resources/prompts/spec-workflow-starter.md (添加 Codex 说明)
- [ ] 运行 npm run update-sam-config (部署到本地)
- [ ] 测试配置加载
- [ ] 更新 README 添加用户说明
- [ ] 打包测试（模拟用户安装）

## 下一步

1. **修改源配置文件** - 添加 Codex 集成说明
2. **实现标签解析** - tasks.md 中的 `[codex]` 标签
3. **测试完整流程** - 从修改到部署到使用
4. **编写用户文档** - 安装和使用指南

