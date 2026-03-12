#!/bin/bash

# Chrome Pilot MCP 卸载脚本
# 支持从全局（~/.claude.json）或项目级（.mcp.json）卸载配置
#
# 用法:
#   bash uninstall.sh              # 交互式选择
#   bash uninstall.sh --global     # 直接卸载全局配置
#   bash uninstall.sh --project /path/to/project  # 卸载指定项目配置
#   bash uninstall.sh --files      # 同时删除安装目录

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="$HOME/.config/chrome-pilot-mcp"
CLAUDE_SETTINGS="$HOME/.claude.json"
CLAUDE_PROJECTS_DIR="$HOME/.claude/projects"
MODE=""            # global / project / ""(interactive)
TARGET_PROJECT=""  # 项目路径
REMOVE_FILES=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
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
        --files)
            REMOVE_FILES=true
            shift
            ;;
        *)
            echo -e "${RED}未知参数: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Chrome Pilot MCP 卸载脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================
# 选择卸载目标
# ============================================================
if [ -z "$MODE" ]; then
    echo -e "  请选择卸载方式:"
    echo -e "    ${CYAN}1)${NC} 全局卸载 (从 ~/.claude.json 移除)"
    echo -e "    ${CYAN}2)${NC} 项目级卸载 (从项目 .mcp.json 移除)"
    echo ""
    printf "  > "
    read -r CHOICE

    case "$CHOICE" in
        1)
            MODE="global"
            ;;
        2)
            MODE="project"
            # 扫描哪些项目的 .mcp.json 包含 chrome-pilot
            # 使用 node.js 递归回溯解码路径 + 检查 chrome-pilot key
            declare -a FOUND_PROJECTS=()
            while IFS= read -r project_path; do
                [ -n "$project_path" ] && FOUND_PROJECTS+=("$project_path")
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
    if (found.length) {
        const projPath = found[0];
        const mcpFile = path.join(projPath, '.mcp.json');
        try {
            const c = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
            if (c.mcpServers && 'chrome-pilot' in c.mcpServers) console.log(projPath);
        } catch(e) {}
    }
}
" 2>/dev/null)

            if [ ${#FOUND_PROJECTS[@]} -eq 0 ]; then
                echo -e "  ${YELLOW}⚠ 未找到含有 chrome-pilot 配置的项目${NC}"
                exit 0
            fi

            echo ""
            echo -e "  以下项目包含 chrome-pilot 配置:"
            for i in "${!FOUND_PROJECTS[@]}"; do
                echo -e "    ${CYAN}$((i+1)))${NC} ${FOUND_PROJECTS[$i]}"
            done
            echo ""
            printf "  > "
            read -r PROJECT_CHOICE

            if ! [[ "$PROJECT_CHOICE" =~ ^[0-9]+$ ]] || [ "$PROJECT_CHOICE" -lt 1 ] || [ "$PROJECT_CHOICE" -gt ${#FOUND_PROJECTS[@]} ]; then
                echo -e "  ${RED}错误: 无效的选择${NC}"
                exit 1
            fi

            TARGET_PROJECT="${FOUND_PROJECTS[$((PROJECT_CHOICE-1))]}"
            ;;
        *)
            echo -e "  ${RED}错误: 无效的选择，请输入 1 或 2${NC}"
            exit 1
            ;;
    esac
fi

# ============================================================
# 执行卸载
# ============================================================
echo ""

# ---- 全局卸载 ----
if [ "$MODE" = "global" ]; then
    echo -e "${YELLOW}[1/2] 移除全局 Claude Code 配置...${NC}"
    if [ -f "$CLAUDE_SETTINGS" ]; then
        BACKUP_FILE="${CLAUDE_SETTINGS}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$CLAUDE_SETTINGS" "$BACKUP_FILE"

        RESULT=$(node -e "
const fs = require('fs');
try {
    const settings = JSON.parse(fs.readFileSync('$CLAUDE_SETTINGS', 'utf8'));
    if (settings.mcpServers && 'chrome-pilot' in settings.mcpServers) {
        delete settings.mcpServers['chrome-pilot'];
        fs.writeFileSync('$CLAUDE_SETTINGS', JSON.stringify(settings, null, 2));
        console.log('removed');
    } else {
        console.log('not_found');
    }
} catch (err) {
    console.log('error:' + err.message);
    process.exit(1);
}
" 2>&1)

        if [ "$RESULT" = "removed" ]; then
            echo -e "  ${GREEN}✓ 已从 ~/.claude.json 移除 chrome-pilot${NC}"
        elif [ "$RESULT" = "not_found" ]; then
            echo -e "  ${YELLOW}⚠ 未在 mcpServers 中找到 chrome-pilot，跳过${NC}"
        else
            echo -e "  ${RED}✗ 移除失败: $RESULT${NC}"
            cp "$BACKUP_FILE" "$CLAUDE_SETTINGS"
            echo -e "  ${GREEN}✓ 已恢复备份${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠ 未找到 Claude 设置文件，跳过${NC}"
    fi

# ---- 项目级卸载 ----
elif [ "$MODE" = "project" ]; then
    MCP_JSON="$TARGET_PROJECT/.mcp.json"
    echo -e "${YELLOW}[1/2] 移除项目配置...${NC}"
    echo -e "  目标: ${BLUE}$MCP_JSON${NC}"

    if [ ! -f "$MCP_JSON" ]; then
        echo -e "  ${YELLOW}⚠ 未找到 .mcp.json，跳过${NC}"
    else
        BACKUP_FILE="${MCP_JSON}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$MCP_JSON" "$BACKUP_FILE"

        RESULT=$(node -e "
const fs = require('fs');
try {
    const config = JSON.parse(fs.readFileSync('$MCP_JSON', 'utf8'));
    if (config.mcpServers && 'chrome-pilot' in config.mcpServers) {
        delete config.mcpServers['chrome-pilot'];
        fs.writeFileSync('$MCP_JSON', JSON.stringify(config, null, 2) + '\n');
        console.log('removed');
    } else {
        console.log('not_found');
    }
} catch (err) {
    console.log('error:' + err.message);
    process.exit(1);
}
" 2>&1)

        if [ "$RESULT" = "removed" ]; then
            echo -e "  ${GREEN}✓ 已从 $MCP_JSON 移除 chrome-pilot${NC}"
        elif [ "$RESULT" = "not_found" ]; then
            echo -e "  ${YELLOW}⚠ 未在 .mcp.json 中找到 chrome-pilot，跳过${NC}"
        else
            echo -e "  ${RED}✗ 移除失败: $RESULT${NC}"
            cp "$BACKUP_FILE" "$MCP_JSON"
            echo -e "  ${GREEN}✓ 已恢复备份${NC}"
        fi
    fi
fi

# ---- 移除安装目录 ----
echo ""
echo -e "${YELLOW}[2/2] 安装文件...${NC}"
if [ "$REMOVE_FILES" = true ]; then
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
        echo -e "  ${GREEN}✓ 已删除 $INSTALL_DIR${NC}"
    else
        echo -e "  ${YELLOW}⚠ 安装目录不存在，跳过${NC}"
    fi
else
    echo -e "  ${YELLOW}保留安装文件: $INSTALL_DIR${NC}"
    echo -e "  ${YELLOW}(使用 --files 参数同时删除安装目录)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  卸载完成${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}重启 Claude Code 后生效${NC}"
