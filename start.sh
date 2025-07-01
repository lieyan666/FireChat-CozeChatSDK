#!/bin/bash

# FireChat-CozeChatSDK 启动脚本
# 作者: FireChat Team
# 描述: 快速启动 Coze Chat SDK 后端服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${2}${1}${NC}"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查文件是否存在
file_exists() {
    [ -f "$1" ]
}

# 主函数
main() {
    print_message "🔥 FireChat - Coze Chat SDK 启动脚本" "$BLUE"
    echo
    
    # 检查 Node.js
    if ! command_exists node; then
        print_message "❌ 错误: 未找到 Node.js，请先安装 Node.js (>= 14.0.0)" "$RED"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    print_message "✅ Node.js 版本: v$NODE_VERSION" "$GREEN"
    
    # 检查 npm
    if ! command_exists npm; then
        print_message "❌ 错误: 未找到 npm" "$RED"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    print_message "✅ npm 版本: $NPM_VERSION" "$GREEN"
    
    # 检查 package.json
    if ! file_exists "package.json"; then
        print_message "❌ 错误: 未找到 package.json 文件" "$RED"
        exit 1
    fi
    
    # 强制安装/更新依赖（OTA更新需要）
    print_message "📦 正在安装/更新依赖..." "$YELLOW"
    npm install
    if [ $? -eq 0 ]; then
        print_message "✅ 依赖安装/更新成功" "$GREEN"
    else
        print_message "❌ 依赖安装/更新失败" "$RED"
        exit 1
    fi
    
    print_message "🔄 正在拉取最新代码..." "$YELLOW"
    git pull
    if [ $? -eq 0 ]; then
        print_message "✅ 代码拉取成功" "$GREEN"
    else
        print_message "❌ 代码拉取失败" "$RED"
        exit 1
    fi
    
    echo
    print_message "🚀 正在启动服务..." "$BLUE"
    echo
    
    # 启动服务
    if [ "$1" = "dev" ] || [ "$1" = "development" ]; then
        print_message "🔧 开发模式启动" "$YELLOW"
        export NODE_ENV=development
        npm run dev
    elif [ "$1" = "prod" ] || [ "$1" = "production" ]; then
        print_message "🏭 生产模式启动" "$GREEN"
        export NODE_ENV=production
        npm start
    else
        print_message "🏭 默认模式启动" "$GREEN"
        npm start
    fi
}

# 显示帮助信息
show_help() {
    echo "FireChat-CozeChatSDK 启动脚本"
    echo
    echo "用法:"
    echo "  ./start.sh [模式]"
    echo
    echo "模式:"
    echo "  dev, development    开发模式 (使用 nodemon，NODE_ENV=development)"
    echo "  prod, production    生产模式 (NODE_ENV=production)"
    echo "  (默认)              默认模式 (使用配置文件中的环境设置)"
    echo
    echo "示例:"
    echo "  ./start.sh          # 默认模式启动"
    echo "  ./start.sh dev      # 开发模式启动"
    echo "  ./start.sh prod     # 生产模式启动"
    echo
}

# 处理命令行参数
case "$1" in
    -h|--help|help)
        show_help
        exit 0
        ;;
    *)
        main "$1"
        ;;
esac