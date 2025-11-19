#!/bin/bash

# Sam 配置更新脚本
# 用途：从插件源文件更新用户配置

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Sam 配置更新脚本 ===${NC}\n"

SOURCE_DIR="$PROJECT_DIR/src/resources/prompts"
USER_CONFIG_DIR="$HOME/.claude/sam-config"

# 检查用户配置目录是否存在
if [ ! -d "$USER_CONFIG_DIR" ]; then
    echo -e "${YELLOW}配置目录不存在，请先运行部署脚本：${NC}"
    echo "  npm run setup-sam-config"
    exit 1
fi

# 备份现有配置
BACKUP_DIR="$USER_CONFIG_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}备份现有配置...${NC}"
if [ -f "$USER_CONFIG_DIR/spec-workflow-starter.md" ]; then
    cp "$USER_CONFIG_DIR/spec-workflow-starter.md" \
       "$BACKUP_DIR/spec-workflow-starter_$TIMESTAMP.md"
    echo "备份: $BACKUP_DIR/spec-workflow-starter_$TIMESTAMP.md"
fi

# 更新配置文件
echo -e "\n${GREEN}更新配置文件...${NC}"
cp "$SOURCE_DIR/spec-workflow-starter.md" "$USER_CONFIG_DIR/"
echo "✓ spec-workflow-starter.md"

# 可选文件
if [ -f "$SOURCE_DIR/PM_QUICK_REFERENCE.md" ]; then
    cp "$SOURCE_DIR/PM_QUICK_REFERENCE.md" "$USER_CONFIG_DIR/"
    echo "✓ PM_QUICK_REFERENCE.md"
fi

if [ -f "$SOURCE_DIR/PM_ENHANCEMENT_SUMMARY.md" ]; then
    cp "$SOURCE_DIR/PM_ENHANCEMENT_SUMMARY.md" "$USER_CONFIG_DIR/"
    echo "✓ PM_ENHANCEMENT_SUMMARY.md"
fi

echo -e "\n${GREEN}=== 更新完成 ===${NC}\n"
echo "配置位置: $USER_CONFIG_DIR"
echo "备份位置: $BACKUP_DIR"
echo ""
echo "如需恢复之前的配置："
echo "  cp $BACKUP_DIR/spec-workflow-starter_$TIMESTAMP.md \\"
echo "     $USER_CONFIG_DIR/spec-workflow-starter.md"
