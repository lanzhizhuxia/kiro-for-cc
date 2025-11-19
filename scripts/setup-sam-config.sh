#!/bin/bash

# Sam 配置部署脚本
# 用途：将插件中的 Sam 配置部署到用户目录

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Sam 配置部署脚本 ===${NC}\n"

# 1. 检查源文件是否存在
SOURCE_DIR="$PROJECT_DIR/src/resources/prompts"
if [ ! -f "$SOURCE_DIR/spec-workflow-starter.md" ]; then
    echo -e "${RED}错误: 找不到源配置文件${NC}"
    echo "路径: $SOURCE_DIR/spec-workflow-starter.md"
    exit 1
fi

# 2. 创建用户配置目录
USER_CONFIG_DIR="$HOME/.claude/sam-config"
echo "创建配置目录: $USER_CONFIG_DIR"
mkdir -p "$USER_CONFIG_DIR"

# 3. 复制配置文件
echo -e "\n${YELLOW}复制配置文件...${NC}"
cp "$SOURCE_DIR/spec-workflow-starter.md" "$USER_CONFIG_DIR/"

# 可选：复制其他配置文件
if [ -f "$SOURCE_DIR/PM_QUICK_REFERENCE.md" ]; then
    cp "$SOURCE_DIR/PM_QUICK_REFERENCE.md" "$USER_CONFIG_DIR/"
fi

if [ -f "$SOURCE_DIR/PM_ENHANCEMENT_SUMMARY.md" ]; then
    cp "$SOURCE_DIR/PM_ENHANCEMENT_SUMMARY.md" "$USER_CONFIG_DIR/"
fi

# 4. 创建本地符号链接（开发用）
LOCAL_PROMPT_DIR="$PROJECT_DIR/.claude/system-prompts"
mkdir -p "$LOCAL_PROMPT_DIR"

if [ -L "$LOCAL_PROMPT_DIR/spec-workflow-starter.md" ] || [ -f "$LOCAL_PROMPT_DIR/spec-workflow-starter.md" ]; then
    echo -e "\n${YELLOW}警告: 本地配置文件已存在${NC}"
    read -p "是否替换为符号链接到用户配置? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm "$LOCAL_PROMPT_DIR/spec-workflow-starter.md"
        ln -s "$USER_CONFIG_DIR/spec-workflow-starter.md" "$LOCAL_PROMPT_DIR/spec-workflow-starter.md"
        echo -e "${GREEN}✓ 已创建符号链接${NC}"
    fi
else
    ln -s "$USER_CONFIG_DIR/spec-workflow-starter.md" "$LOCAL_PROMPT_DIR/spec-workflow-starter.md"
    echo -e "${GREEN}✓ 已创建符号链接${NC}"
fi

# 5. 创建 README
cat > "$USER_CONFIG_DIR/README.md" << 'EOF'
# Sam 配置文件

此目录包含 Sam (Spec Automation Manager) 的配置文件。

## 文件说明

- `spec-workflow-starter.md` - Sam 的系统提示词（定义工作流程）
- `PM_QUICK_REFERENCE.md` - 决策速查表（可选）
- `PM_ENHANCEMENT_SUMMARY.md` - 完整能力说明（可选）

## 更新配置

当 Kiro for Claude Code 插件更新时，运行以下命令更新配置：

```bash
cd /path/to/kiro-for-cc
./scripts/update-sam-config.sh
```

## 自定义配置

你可以直接编辑这些文件来自定义 Sam 的行为。
修改会立即生效（无需重启 VS Code）。

## 恢复默认配置

如果想恢复默认配置，重新运行部署脚本：

```bash
cd /path/to/kiro-for-cc
./scripts/setup-sam-config.sh
```
EOF

echo -e "\n${GREEN}=== 部署完成 ===${NC}\n"
echo "配置位置: $USER_CONFIG_DIR"
echo ""
echo "下一步："
echo "  1. 配置文件已部署到 ~/.claude/sam-config/"
echo "  2. 你可以编辑这些文件来自定义 Sam 的行为"
echo "  3. 在任何项目中，Sam 都会使用这些配置"
echo ""
echo "更新配置: ./scripts/update-sam-config.sh"
