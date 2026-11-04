# Prompt Lab

个人提示词库。FastAPI + SQLite 提供接口，原生 JS 单页做界面，数据存在服务器上，任何设备输入口令即可访问同一份内容。

线上地址：<https://promptlab.zhongtao.me>

## 功能

- 分类（10 个固定类目）+ 自由标签 + 全文搜索
- 复制时自动生成 `{{变量}}` 输入框，并记住上次填写值
- 使用次数与最近使用排序，收藏置顶
- 修改正文自动保存历史快照（上限 20 条），可查看、载入
- JSON 导入 / 导出
- 单一访问口令，失败次数限流

## 目录

```
app/                 FastAPI 服务
  main.py            接口 + 静态文件托管
  seed.py            首次启动的示例提示词
  web/               前端（Bootstrap 5 自托管；index.html / app.js / style.css / vendor）
docker-compose.yml   单容器，只用自己的网络，不发布宿主机端口
.github/workflows/   push 到 main 后自动部署
方案.md              设计文档
```

## 本地运行

```bash
cd app
pip install -r requirements.txt
ACCESS_TOKEN=devtoken DB_PATH=../data/dev.db uvicorn main:app --port 8080
```

打开 <http://127.0.0.1:8080>，输入 `devtoken`。

## 线上架构

```
浏览器 ──HTTPS──▶ 网关 (Caddy, 80/443, /opt/gateway)
                     │  按域名分发
        ┌────────────┴─────────────┐
        ▼                          ▼
 mianshidao_web:3000        prompt_lab:8080
 (mianshidao 自己的网络)     (prompt_lab 自己的网络)

              SQLite /opt/prompt_lab/data/prompt_lab.db
```

- 两个应用互不加入对方的 Docker 网络，也不共享容器；唯一的公共组件是独立网关。
- 应用容器不发布宿主机端口，公网只能经网关访问，避免 HTTP 明文入口。
- 证书由网关通过 HTTP-01 自动申请和续期。
- 访问口令在服务器 `/opt/prompt_lab/.env`，不进仓库。

## 自动部署

```
git push origin main
  └─ GitHub Actions
       ├─ rsync 源码 → deploy@server:/opt/prompt_lab/（保留 .env 与 data/）
       └─ ssh: docker compose up -d --build
```

仓库 Settings → Secrets and variables → Actions 只需要一个 secret：

| Secret | 值 |
| --- | --- |
| `SSH_KEY` | 部署私钥全文（含 `BEGIN`/`END` 行） |

部署主机（`121.43.126.201`）和用户（`deploy`）直接写在 workflow 的 `env` 里，不属于敏感信息。

## 运维备注

- 网关在 `/opt/gateway`，独立 compose，配置在 `/opt/gateway/Caddyfile`。
  新增站点：改 Caddyfile 后 `docker exec gateway caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`，不中断现有站点。
- 备份直接拷贝 `/opt/prompt_lab/data/prompt_lab.db` 即可；页面里也有「导出 JSON」。
- 修改口令：编辑 `/opt/prompt_lab/.env` 后 `docker compose up -d`。

## 安全说明

- 已启用 HTTPS；口令在传输中加密。
- 服务器 `root` 仍允许密码登录，且宝塔面板对公网开放（8888）。建议改用密钥登录并限制面板来源 IP。
- 部署用户 `deploy` 属于 `docker` 组，等价于 root 权限，私钥只放在 GitHub Secrets。
