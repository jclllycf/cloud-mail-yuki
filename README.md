<div align="center">

# Yuki Mail

*A quiet place for your letters.*

一个温馨、轻量、个人化的小型邮箱站。

[在线使用](https://mail.jcllyuki.com) · [联系 YUKI](mailto:jclllycf@gmail.com)

</div>

## 产品展示

以下截图全部来自 **真实 Yuki Mail 前端**，通过本地隔离的演示 API 注入虚构数据生成；不包含真实邮件、账号、验证码、IP 或业务统计。

| 收件箱 | 数据分析 |
|:--|:--|
| ![Yuki Mail Inbox](showcase/assets/inbox.png) | ![Yuki Mail Analytics](showcase/assets/analytics.png) |

| 个人设置 | 系统设置 |
|:--|:--|
| ![Yuki Mail Settings](showcase/assets/settings.png) | ![Yuki Mail System Settings](showcase/assets/system-settings.png) |

<p align="center">
  <img src="showcase/assets/mobile.png" width="320" alt="Yuki Mail mobile inbox" />
</p>

## Warm Letter UI

Yuki Mail 在 Cloud Mail 的完整邮件能力之上加入了一套更温和、清晰、适合长期日常使用的 UI：

- **Clay Letter**：暖纸张与陶土色，默认主题。
- **Sage Garden**：象牙白与低饱和鼠尾草绿。
- **Cocoa Night**：暖黑、奶油文字与低饱和铜色。
- 统一的本地 SVG 图标系统、可见键盘焦点、响应式布局和 Soft Product Motion。
- 改进 Inbox、Reader、Compose、账号切换、Dialog、设置与管理界面的视觉一致性。
- HTML 邮件在未声明背景时自然继承主题；发件人明确指定的排版仍被尊重。

## 核心能力

Yuki Mail 保留并扩展了 Cloud Mail 的主要能力：

- Cloudflare Workers 上的 Serverless 邮箱服务。
- 多邮箱地址、收件箱、已发送、草稿、星标和管理后台。
- Resend / Cloudflare Email 发信，支持富文本、附件和发送状态。
- R2 附件存储、D1 数据库、KV 缓存。
- RBAC 权限、用户/角色/注册码/系统设置。
- Workers AI 验证码识别。
- ECharts 数据分析与邮件增长可视化。
- Turnstile、转发、Webhook、第三方 OAuth 等上游能力。

## AI Agent & MCP

Yuki Mail 也可以作为 AI Agent 的 MCP-native 邮件基础设施，当前提供 8 个工具：

**读取工具**
- `cloud_mail_list`
- `cloud_mail_search`
- `cloud_mail_get`
- `cloud_mail_get_verification_code`
- `cloud_mail_get_attachment`

**受保护写工具**
- `cloud_mail_send`
- `cloud_mail_delete`
- `cloud_mail_create_mailbox`

支持三种安全模式：

- `readonly`：本地硬阻止所有写操作。
- `ask`：默认推荐；读取自动执行，写操作由 MCP Host 请求用户批准。
- `full`：允许 Agent 直接执行写操作。

完整接入说明见 [MCP Setup & Integration Guide](docs/MCP_SETUP_GUIDE.md)。

## 技术栈

- **Platform**: Cloudflare Workers
- **Backend**: Hono + Drizzle
- **Frontend**: Vue 3 + Vite + Element Plus
- **Mail**: Resend / Cloudflare Email
- **Data**: Cloudflare D1 + KV
- **Storage**: Cloudflare R2
- **Charts**: ECharts
- **Agent integration**: Model Context Protocol (MCP)

## 项目结构

```text
cloud-mail-yuki/
├─ mail-worker/              # Cloudflare Worker 后端
├─ mail-vue/                 # Vue 前端
├─ packages/mcp-server/      # MCP Server
├─ docs/                     # MCP / 研究文档
└─ showcase/                 # 仅用于 GitHub 展示的隔离演示数据与真实前端截图
```

## 本地开发与部署

前端位于 `mail-vue/`，Worker 位于 `mail-worker/`。部署配置沿用 Cloudflare Workers / Wrangler 工作流。

不要提交 `.env`、API Token、Cloudflare Secret 或真实邮箱数据。仓库中的 showcase fixture 只监听本地回环地址，用于生成安全展示截图，不连接生产数据库。

## About

**Yuki Mail**

Designed & maintained by **YUKI**

- Version：当前版本信息可在应用内 System Settings → About 查看
- Website: [mail.jcllyuki.com](https://mail.jcllyuki.com)
- Contact: [jclllycf@gmail.com](mailto:jclllycf@gmail.com)
- Support / Feedback: [GitHub Issues](https://github.com/jclllycf/cloud-mail-yuki/issues)

## Open-source acknowledgements

Yuki Mail 基于 [Cloud Mail by maillab](https://github.com/maillab/cloud-mail) 继续开发。上游版权声明与 MIT License 保留在 [LICENSE](LICENSE) 中。

上游项目使用提示作为次级说明保留：本项目仅供学习交流，禁止用于违法业务。请遵守当地法规，作者不承担任何法律责任。

## License

MIT — 详见 [LICENSE](LICENSE)。
