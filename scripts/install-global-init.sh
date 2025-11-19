#!/bin/bash
# 安装全局 init-sam-project 脚本
# 用途：将 init-sam-project 部署到用户的全局 PATH 中

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== 安装全局 init-sam-project 脚本 ===${NC}\n"

# 1. 创建 ~/.local/bin 目录
LOCAL_BIN="$HOME/.local/bin"
echo "创建目录: $LOCAL_BIN"
mkdir -p "$LOCAL_BIN"

# 2. 复制脚本内容
DEST_FILE="$LOCAL_BIN/init-sam-project"
echo -e "\n${YELLOW}安装脚本到: $DEST_FILE${NC}"

cat > "$DEST_FILE" << 'SCRIPT_EOF'
#!/bin/bash
# Sam + Spec开发环境一键初始化脚本
# 用途: 在任何项目中快速配置Sam系统和Spec工作流
# 作者: Claude Code
# 版本: 1.0.1

set -e  # 遇到错误立即退出

echo "🚀 初始化Sam + Spec开发环境..."
echo ""

# 检查是否在git仓库中
if [ ! -d .git ]; then
    echo "⚠️  警告: 当前目录不是git仓库"
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 取消初始化"
        exit 1
    fi
fi

# 1. 创建目录结构
echo "📁 创建目录结构..."
mkdir -p .claude/system-prompts .claude/specs docs/specs/{in-progress,completed,pending}

# 2. 创建Sam符号链接
echo "🔗 创建Sam配置符号链接..."
ln -sf ~/.claude/sam-config/spec-workflow-starter.md .claude/system-prompts/spec-workflow-starter.md
ln -sf ~/.claude/sam-config/PM_QUICK_REFERENCE.md .claude/PM_QUICK_REFERENCE.md
ln -sf ~/.claude/sam-config/PM_ENHANCEMENT_SUMMARY.md docs/specs/PM_ENHANCEMENT_SUMMARY.md

# 3. 创建需求索引（如果不存在）
if [ ! -f docs/specs/REQUIREMENTS_INDEX.md ]; then
    echo "📋 创建需求索引文件..."
    cat > docs/specs/REQUIREMENTS_INDEX.md << 'EOF'
# 需求编号索引

| 编号 | 需求名称 | 状态 | 创建时间 | 完成时间 |
|------|---------|------|---------|---------|

> **说明**:
> - 状态: `pending`(待处理) | `in-progress`(进行中) | `completed`(已完成) | `cancelled`(已取消)
> - 需求编号从 REQ-001 开始递增
EOF
else
    echo "✓ 需求索引文件已存在，跳过"
fi

# 4. 添加.gitignore规则
echo "🔒 配置.gitignore..."
if [ -f .gitignore ]; then
    # 检查是否已有规则
    if ! grep -q "^\.claude/specs/" .gitignore; then
        echo "" >> .gitignore
        echo "# Sam工作目录（临时文件）" >> .gitignore
        echo ".claude/specs/" >> .gitignore
        echo ".claude/codex/" >> .gitignore
    else
        echo "✓ .gitignore规则已存在，跳过"
    fi
else
    cat > .gitignore << 'EOF'
# Sam工作目录（临时文件）
.claude/specs/
.claude/codex/
EOF
fi

# 5. 添加Codex MCP
echo ""
echo "📦 安装Codex MCP服务器..."

# 先检查是否已经安装
if claude mcp list 2>/dev/null | grep -q "codex-cli"; then
    echo "✓ Codex MCP已经安装，跳过"
else
    # 尝试安装（不使用-y参数）
    if echo "" | claude mcp add codex-cli npx @anthropic-ai/codex-cli 2>/dev/null; then
        echo "✓ Codex MCP安装成功"
    else
        echo "⚠️  Codex MCP自动安装失败，请手动运行:"
        echo "   claude mcp add codex-cli npx @anthropic-ai/codex-cli"
        echo ""
        read -p "是否现在手动安装? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            claude mcp add codex-cli npx @anthropic-ai/codex-cli
        fi
    fi
fi

# 6. 验证安装
echo ""
echo "✅ 验证安装..."
echo "   - Sam配置: $([ -L .claude/system-prompts/spec-workflow-starter.md ] && echo '✓' || echo '✗')"
echo "   - 需求索引: $([ -f docs/specs/REQUIREMENTS_INDEX.md ] && echo '✓' || echo '✗')"
echo "   - Codex MCP: $(claude mcp list 2>/dev/null | grep -q 'codex-cli' && echo '✓' || echo '✗')"

# 7. 创建README（可选）
if [ ! -f docs/specs/README.md ]; then
    echo ""
    read -p "是否创建Spec开发指南? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cat > docs/specs/README.md << 'EOF'
# Spec开发指南

## 快速开始

启动Sam：
```
"让Sam跟进这个需求: 实现XX功能"
"Sam继续上次的工作"
"Sam总结下这次的工作"
```

## 目录结构

```
docs/specs/
├── REQUIREMENTS_INDEX.md    # 需求编号索引（必须维护）
├── in-progress/             # 进行中的需求
├── completed/               # 已完成（归档）
└── pending/                 # 待处理（backlog）
```

## 命名规范

- **需求编号**: `REQ-XXX` (从001开始)
- **文件名**: `REQ-XXX-需求名称-文档类型.md`
- **目录名**: `REQ-XXX-需求名称/`

## Sam能力

- ✅ 自主决策agent数量和并行策略
- ✅ 自动选择技术方案（现有技术栈内）
- ✅ 跨会话任务连续性（PROGRESS.md）
- ✅ 自我复盘和改进建议

详细能力: [PM_ENHANCEMENT_SUMMARY.md](./PM_ENHANCEMENT_SUMMARY.md)
EOF
        echo "✓ 已创建 docs/specs/README.md"
    fi
fi

echo ""
echo "🎉 初始化完成！"
echo ""
echo "💡 使用方式:"
echo "   1. 启动Claude Code"
echo "   2. 对话: '让Sam跟进这个需求: 实现XX功能'"
echo "   3. Sam会自动创建需求文档并开始工作"
echo ""
echo "📚 文档位置:"
echo "   - Sam配置: .claude/system-prompts/spec-workflow-starter.md"
echo "   - 需求索引: docs/specs/REQUIREMENTS_INDEX.md"
echo "   - 能力说明: docs/specs/PM_ENHANCEMENT_SUMMARY.md"
echo ""
SCRIPT_EOF

# 3. 设置执行权限
chmod +x "$DEST_FILE"
echo -e "${GREEN}✓ 脚本已安装并设置可执行权限${NC}"

# 4. 检查PATH配置
echo -e "\n${YELLOW}检查PATH配置...${NC}"
if echo "$PATH" | grep -q "$LOCAL_BIN"; then
    echo "✓ ~/.local/bin 已在PATH中"
else
    echo "⚠️  ~/.local/bin 不在PATH中"
    echo ""
    echo "请添加以下内容到你的 shell 配置文件 (如 ~/.zshrc 或 ~/.bashrc):"
    echo ""
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    read -p "是否自动添加到 ~/.zshrc? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "" >> ~/.zshrc
        echo "# 添加 ~/.local/bin 到 PATH (用于全局脚本)" >> ~/.zshrc
        echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> ~/.zshrc
        echo -e "${GREEN}✓ 已添加到 ~/.zshrc${NC}"
        echo "⚠️  请运行以下命令使配置生效:"
        echo "   source ~/.zshrc"
    fi
fi

echo -e "\n${GREEN}=== 安装完成 ===${NC}\n"
echo "脚本位置: $DEST_FILE"
echo ""
echo "使用方法:"
echo "  1. 重启终端 (或运行 'source ~/.zshrc')"
echo "  2. 进入任何项目目录"
echo "  3. 运行: init-sam-project"
echo ""
