#!/bin/bash

# Chrome Pilot MCP 部署脚本
# 支持全局安装（~/.claude.json）和项目级安装（.mcp.json）
#
# 用法:
#   bash deploy.sh              # 交互式选择
#   bash deploy.sh --global     # 直接全局安装
#   bash deploy.sh --project /path/to/project  # 直接项目安装
#   bash deploy.sh --force      # 覆盖已有配置
#
# 安全性保证：
# - 只添加/更新 chrome-pilot 配置，不影响其他配置
# - 更新前自动备份原配置文件
# - 使用 JSON 解析器安全更新，不会破坏文件格式

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
INSTALL_DIR="$HOME/.config/chrome-pilot-mcp"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CLAUDE_SETTINGS="$HOME/.claude.json"
CLAUDE_PROJECTS_DIR="$HOME/.claude/projects"
FORCE=false
MODE=""           # global / project / ""(interactive)
TARGET_PROJECT=""  # 项目路径（--project 模式）

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --global)
            MODE="global"
            shift
            ;;
        --project)
            MODE="project"
            TARGET_PROJECT="$2"
            if [ -z "$TARGET_PROJECT" ]; then
                echo -e "${RED}错误: --project 需要指定路径${NC}"
                exit 1
            fi
            shift 2
            ;;
        *)
            echo -e "${RED}未知参数: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Chrome Pilot MCP 部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================
# [1/5] 检查环境
# ============================================================
echo -e "${YELLOW}[1/5] 检查环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 Node.js，请先安装${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "  Node.js: ${GREEN}$NODE_VERSION${NC}"

# ============================================================
# [2/5] 构建项目
# ============================================================
echo ""
echo -e "${YELLOW}[2/5] 构建项目...${NC}"
cd "$PROJECT_DIR"
npm install --silent
npm run build --silent
echo -e "  ${GREEN}✓ 构建成功${NC}"

# ============================================================
# [3/5] 安装到全局目录
# ============================================================
echo ""
echo -e "${YELLOW}[3/5] 安装到全局目录...${NC}"
mkdir -p "$INSTALL_DIR"

cp -r "$PROJECT_DIR/dist" "$INSTALL_DIR/"
cp "$PROJECT_DIR/package.json" "$INSTALL_DIR/"
cp -r "$PROJECT_DIR/node_modules" "$INSTALL_DIR/" 2>/dev/null || true

echo -e "  安装目录: ${GREEN}$INSTALL_DIR${NC}"
echo -e "  ${GREEN}✓ 安装完成${NC}"

# ============================================================
# [4/5] 选择安装模式
# ============================================================
echo ""
echo -e "${YELLOW}[4/5] 选择安装模式...${NC}"

if [ -z "$MODE" ]; then
    # 交互式选择
    echo ""
    echo -e "  请选择安装方式:"
    echo -e "    ${CYAN}1)${NC} 全局安装 (写入 ~/.claude.json，所有项目可用)"
    echo -e "    ${CYAN}2)${NC} 项目级安装 (写入指定项目的 .mcp.json)"
    echo ""
    printf "  > "
    read -r CHOICE

    case "$CHOICE" in
        1)
            MODE="global"
            ;;
        2)
            MODE="project"
            # 扫描 ~/.claude/projects/ 提取项目路径
            # 使用 node.js 递归回溯解码（- 可能是 / _ - 三种原始字符）
            declare -a PROJECT_PATHS=()
            while IFS= read -r project_path; do
                [ -n "$project_path" ] && PROJECT_PATHS+=("$project_path")
            done < <(node -e "
const fs = require('fs');
const path = require('path');
const dir = '$CLAUDE_PROJECTS_DIR';
if (!fs.existsSync(dir)) process.exit(0);
const entries = fs.readdirSync(dir).filter(e => {
    try { return fs.statSync(path.join(dir, e)).isDirectory(); } catch(e) { return false; }
}).sort();
for (const enc of entries) {
    const parts = enc.replace(/^-/, '').split('-');
    const found = [];
    function walk(base, name, i) {
        if (found.length) return;
        if (i >= parts.length) {
            const full = path.join(base, name);
            try { if (fs.statSync(full).isDirectory()) found.push(full); } catch(e) {}
            return;
        }
        const p = parts[i];
        const asDir = path.join(base, name);
        try { if (fs.statSync(asDir).isDirectory()) walk(asDir, p, i + 1); } catch(e) {}
        walk(base, name + '_' + p, i + 1);
        walk(base, name + '-' + p, i + 1);
    }
    if (parts.length > 0) walk('/', parts[0], 1);
    if (found.length) console.log(found[0]);
}
" 2>/dev/null)

            if [ ${#PROJECT_PATHS[@]} -eq 0 ]; then
                echo -e "  ${RED}错误: 未找到任何已知项目路径${NC}"
                echo -e "  ${YELLOW}请使用 --project <path> 手动指定${NC}"
                exit 1
            fi

            echo ""
            echo -e "  已发现的项目:"
            for i in "${!PROJECT_PATHS[@]}"; do
                echo -e "    ${CYAN}$((i+1)))${NC} ${PROJECT_PATHS[$i]}"
            done
            echo ""
            printf "  > "
            read -r PROJECT_CHOICE

            # 验证输入
            if ! [[ "$PROJECT_CHOICE" =~ ^[0-9]+$ ]] || [ "$PROJECT_CHOICE" -lt 1 ] || [ "$PROJECT_CHOICE" -gt ${#PROJECT_PATHS[@]} ]; then
                echo -e "  ${RED}错误: 无效的选择${NC}"
                exit 1
            fi

            TARGET_PROJECT="${PROJECT_PATHS[$((PROJECT_CHOICE-1))]}"
            ;;
        *)
            echo -e "  ${RED}错误: 无效的选择，请输入 1 或 2${NC}"
            exit 1
            ;;
    esac
fi

# 验证项目路径
if [ "$MODE" = "project" ]; then
    if [ ! -d "$TARGET_PROJECT" ]; then
        echo -e "  ${RED}错误: 项目目录不存在: $TARGET_PROJECT${NC}"
        exit 1
    fi
    echo -e "  模式: ${GREEN}项目级安装${NC}"
    echo -e "  目标: ${GREEN}$TARGET_PROJECT/.mcp.json${NC}"
else
    echo -e "  模式: ${GREEN}全局安装${NC}"
    echo -e "  目标: ${GREEN}~/.claude.json${NC}"
fi

# ============================================================
# [5/5] 写入配置
# ============================================================
echo ""
echo -e "${YELLOW}[5/5] 写入配置...${NC}"

# ---- 全局安装 ----
if [ "$MODE" = "global" ]; then
    if [ -f "$CLAUDE_SETTINGS" ]; then
        BACKUP_FILE="${CLAUDE_SETTINGS}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$CLAUDE_SETTINGS" "$BACKUP_FILE"
        echo -e "  备份原配置: ${GREEN}$BACKUP_FILE${NC}"

        UPDATE_RESULT=$(node -e "
const fs = require('fs');
try {
    const settings = JSON.parse(fs.readFileSync('$CLAUDE_SETTINGS', 'utf8'));
    if (!settings.mcpServers) settings.mcpServers = {};
    const existed = 'chrome-pilot' in settings.mcpServers;
    if (existed && !$FORCE) {
        console.log('exists');
    } else {
        settings.mcpServers['chrome-pilot'] = {
            type: 'stdio',
            command: 'node',
            args: ['$INSTALL_DIR/dist/index.js'],
            env: {}
        };
        fs.writeFileSync('$CLAUDE_SETTINGS', JSON.stringify(settings, null, 2));
        console.log(existed ? 'updated' : 'added');
    }
} catch (err) {
    console.log('error:' + err.message);
    process.exit(1);
}
" 2>&1)

        if [ "$UPDATE_RESULT" = "added" ]; then
            echo -e "  ${GREEN}✓ 已添加 chrome-pilot 到全局 mcpServers${NC}"
        elif [ "$UPDATE_RESULT" = "updated" ]; then
            echo -e "  ${GREEN}✓ 已更新 chrome-pilot 配置${NC}"
        elif [ "$UPDATE_RESULT" = "exists" ]; then
            echo -e "  ${YELLOW}⚠ chrome-pilot 配置已存在，跳过（使用 --force 覆盖）${NC}"
        else
            echo -e "  ${RED}✗ 更新失败: $UPDATE_RESULT${NC}"
            echo -e "  ${YELLOW}正在恢复备份...${NC}"
            cp "$BACKUP_FILE" "$CLAUDE_SETTINGS"
            echo -e "  ${GREEN}✓ 已恢复原配置${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠ 未找到 Claude 全局设置文件，跳过自动配置${NC}"
    fi

# ---- 项目级安装 ----
elif [ "$MODE" = "project" ]; then
    MCP_JSON="$TARGET_PROJECT/.mcp.json"

    if [ -f "$MCP_JSON" ]; then
        BACKUP_FILE="${MCP_JSON}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$MCP_JSON" "$BACKUP_FILE"
        echo -e "  备份原配置: ${GREEN}$BACKUP_FILE${NC}"
    fi

    UPDATE_RESULT=$(node -e "
const fs = require('fs');
const path = '$MCP_JSON';
try {
    let config = {};
    if (fs.existsSync(path)) {
        config = JSON.parse(fs.readFileSync(path, 'utf8'));
    }
    if (!config.mcpServers) config.mcpServers = {};
    const existed = 'chrome-pilot' in config.mcpServers;
    if (existed && !$FORCE) {
        console.log('exists');
    } else {
        config.mcpServers['chrome-pilot'] = {
            command: 'node',
            args: ['$INSTALL_DIR/dist/index.js']
        };
        fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
        console.log(existed ? 'updated' : 'added');
    }
} catch (err) {
    console.log('error:' + err.message);
    process.exit(1);
}
" 2>&1)

    if [ "$UPDATE_RESULT" = "added" ]; then
        echo -e "  ${GREEN}✓ 已添加 chrome-pilot 到 $MCP_JSON${NC}"
    elif [ "$UPDATE_RESULT" = "updated" ]; then
        echo -e "  ${GREEN}✓ 已更新 chrome-pilot 配置${NC}"
    elif [ "$UPDATE_RESULT" = "exists" ]; then
        echo -e "  ${YELLOW}⚠ chrome-pilot 配置已存在，跳过（使用 --force 覆盖）${NC}"
    else
        echo -e "  ${RED}✗ 更新失败: $UPDATE_RESULT${NC}"
        if [ -f "$BACKUP_FILE" ]; then
            echo -e "  ${YELLOW}正在恢复备份...${NC}"
            cp "$BACKUP_FILE" "$MCP_JSON"
            echo -e "  ${GREEN}✓ 已恢复原配置${NC}"
        fi
    fi
fi

# ============================================================
# 输出结果
# ============================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "安装位置: ${BLUE}$INSTALL_DIR${NC}"
if [ "$MODE" = "project" ]; then
    echo -e "配置文件: ${BLUE}$TARGET_PROJECT/.mcp.json${NC}"
else
    echo -e "配置文件: ${BLUE}~/.claude.json${NC}"
fi
echo ""
echo -e "${BLUE}前置条件：${NC}"
echo -e "  1. Chrome >= 144"
echo -e "  2. 在 Chrome 中打开 chrome://inspect/#remote-debugging 并启用远程调试"
echo ""
echo -e "${BLUE}重启 Claude Code 后生效${NC}"
