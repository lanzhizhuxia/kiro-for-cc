#!/bin/bash

# Kiro for Claude Code - 自动化打包和安装脚本
# 用途：编译、打包并安装到VSCode/Cursor

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取当前版本号
get_version() {
    grep '"version"' package.json | head -1 | awk -F '"' '{print $4}'
}

# 检测安装目标（VSCode或Cursor）
detect_target() {
    local target="$1"

    if [ -z "$target" ]; then
        # 自动检测
        if command -v code &> /dev/null; then
            echo "vscode"
        elif command -v cursor &> /dev/null; then
            echo "cursor"
        else
            echo "none"
        fi
    else
        echo "$target"
    fi
}

# 主流程
main() {
    print_info "开始自动化打包和安装流程..."

    # 1. 检查依赖
    print_info "检查依赖..."
    if ! command -v npm &> /dev/null; then
        print_error "未找到 npm，请先安装 Node.js"
        exit 1
    fi

    # 2. 编译 TypeScript
    print_info "编译 TypeScript..."
    npm run compile
    if [ $? -ne 0 ]; then
        print_error "编译失败"
        exit 1
    fi
    print_success "编译完成"

    # 3. 打包扩展
    print_info "打包扩展..."
    npm run package
    if [ $? -ne 0 ]; then
        print_error "打包失败"
        exit 1
    fi
    print_success "打包完成"

    # 4. 获取版本号和 VSIX 文件名
    VERSION=$(get_version)
    VSIX_FILE="kiro-for-cc-${VERSION}.vsix"

    if [ ! -f "$VSIX_FILE" ]; then
        print_error "找不到打包文件: $VSIX_FILE"
        exit 1
    fi

    print_success "打包文件: $VSIX_FILE"

    # 5. 检测安装目标
    TARGET=$(detect_target "$1")

    if [ "$TARGET" == "none" ]; then
        print_warning "未检测到 VSCode 或 Cursor"
        print_info "打包完成，你可以手动安装："
        print_info "  VSCode: code --install-extension $VSIX_FILE"
        print_info "  Cursor: cursor --install-extension $VSIX_FILE"
        exit 0
    fi

    # 6. 安装扩展
    if [ "$TARGET" == "vscode" ]; then
        print_info "正在安装到 VSCode..."
        code --install-extension "$VSIX_FILE"
        print_success "已安装到 VSCode"
    elif [ "$TARGET" == "cursor" ]; then
        print_info "正在安装到 Cursor..."
        cursor --install-extension "$VSIX_FILE"
        print_success "已安装到 Cursor"
    elif [ "$TARGET" == "both" ]; then
        print_info "正在安装到 VSCode 和 Cursor..."
        if command -v code &> /dev/null; then
            code --install-extension "$VSIX_FILE"
            print_success "已安装到 VSCode"
        fi
        if command -v cursor &> /dev/null; then
            cursor --install-extension "$VSIX_FILE"
            print_success "已安装到 Cursor"
        fi
    fi

    # 7. 清理提示
    print_info ""
    print_success "✨ 全部完成！"
    print_info "重启 VSCode/Cursor 以加载新版本"
    print_warning "如果插件未更新，请尝试："
    print_info "  1. 在扩展面板中禁用 Kiro for CC"
    print_info "  2. 重新启用"
    print_info "  3. 重启编辑器"
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [目标]"
    echo ""
    echo "目标选项:"
    echo "  vscode    - 仅安装到 VSCode"
    echo "  cursor    - 仅安装到 Cursor"
    echo "  both      - 同时安装到 VSCode 和 Cursor"
    echo "  (空)      - 自动检测"
    echo ""
    echo "示例:"
    echo "  $0              # 自动检测并安装"
    echo "  $0 vscode       # 仅安装到 VSCode"
    echo "  $0 both         # 安装到两者"
}

# 参数解析
if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    show_help
    exit 0
fi

# 执行主流程
main "$1"
