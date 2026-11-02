# dsh-deepseek-balance

DeepSeek Harness 插件：屏幕右下角常驻一个可拖动的钱包悬浮球，点一下就能看到 DeepSeek 账号余额。

A floating wallet ball for DeepSeek Harness: click it to read your DeepSeek account balance.

## 功能

- **悬浮球**：注册在 `shell.overlay` 框架浮层，右下角常驻，不遮挡主界面；可拖动，位置记在 `localStorage`，刷新后仍在，窗口缩放时自动收回可视区域内。
- **点开即看**：总余额、充值余额、赠送余额、数据来源、更新时间，带刷新按钮；`Esc` 或点面板外关闭；靠近屏幕顶部时面板自动向下展开。
- **两种余额来源**，按顺序回退：
  1. 已登录的 DeepSeek 账号（`ctx.deepseekAccount` 钱包，充值 + 赠送分开）；
  2. 已配置的 `DEEPSEEK_API_KEY` 调用 `https://api.deepseek.com/user/balance`。
- **凭证不出 Host**：API Key 只在 Host 进程内使用；浏览器侧走插件自己的同源路由 `GET /dsh-deepseek-balance/balance`，并拒绝非本机同源请求。
- **给 agent 的工具**：同时注册 `deepseek_balance` 工具，直接在对话里问「我的余额还有多少」即可。

## 安装

需要 DeepSeek Harness `>=0.2.1-rc.5 <0.3.0`，且是带 Web 界面的 profile（Desktop 或 `dsh web`）。

**从 GitHub 安装**：让 agent 执行 `plugin_manager` 的 `install_bundle`，`target` 填：

```
git+https://github.com/cqrfzdoc/dsh-deepseek-balance.git
```

固定版本就带上 tag：

```
git+https://github.com/cqrfzdoc/dsh-deepseek-balance.git#v1.0.0
```

**从本地目录安装**：`target` 填本仓库的绝对路径。

安装后默认启用，右下角会出现悬浮球；也可以在「设置 → 插件」里启用/禁用。

## 使用

- 点击球：展开/收起余额面板。
- 拖动球：移动位置，松手即保存。
- 复位：浏览器控制台执行 `localStorage.removeItem('dsh.deepseek-balance.position')` 后刷新页面。
- 对话里问余额：agent 会调用 `deepseek_balance` 工具。

## 结构

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半：余额读取（唯一实现）、HTTP 路由、`deepseek_balance` 工具 |
| `client.js` | 浏览器半：`shell.overlay` 悬浮球与面板 |
| `cordis.patch.yml` | 插入插件行 `deepseek-balance` |
| `locale/*.json` | 插件管理器的标题与描述（中/英） |
| `icon.svg` | 插件图标 |

## 自定义

- 默认位置：`client.js` 中 `.dsdb-root` 的 `right` / `bottom`（拖动过之后改用保存的坐标）。
- 文案：`client.js` 顶部 `TEXT` 的 `zh` / `en`。
- 颜色：使用 `--dsw-alias-*` 主题令牌，自动跟随浅色/深色主题；球体本身的品牌色是插件自己的 artwork。
- 改完代码后，在「设置 → 插件」里关掉再打开本插件即可加载新代码（Host 模块不会热替换）。

## 兼容性

插件的 Host 半依赖 `webServer`、`tools` 与可选的 `deepseekAccount`、`credentials`，浏览器半依赖 `slots`、`locale` 与 `shell.overlay` 槽位。DSH 升级后若这些接口变化，需要相应调整；`engines.dsh` 只声明兼容范围，真正的保障是这些接口。

## License

[MIT](LICENSE) © 2026 Zichao Cui
