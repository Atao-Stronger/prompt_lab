# Prompt Lab

个人提示词库。FastAPI + SQLite 提供接口，原生 JS 单页做界面，数据存在服务器上，任何设备输入口令即可访问同一份内容。

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
  web/               前端（index.html / app.js / style.css）
docker-compose.yml   单容器部署，监听 8080
.github/workflows/   GitHub Actions 自动部署
方案.md              设计文档
```

## 本地运行

```bash
cd app
pip install -r requirements.txt
ACCESS_TOKEN=devtoken DB_PATH=../data/dev.db uvicorn main:app --port 8080
```

打开 http://127.0.0.1:8080 ，输入 `devtoken`。

## 部署

服务器一次性初始化（以 `deploy` 用户为例）：

```bash
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
sudo mkdir -p /opt/prompt_lab && sudo chown deploy:deploy /opt/prompt_lab
```

在 `/opt/prompt_lab/.env` 写入：

```
ACCESS_TOKEN=<随机口令>
```

GitHub 仓库 Settings → Secrets and variables → Actions 添加：

| Secret | 值 |
| --- | --- |
| `SSH_HOST` | 服务器 IP |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | 部署用私钥全文（包含 BEGIN/END 行） |

推送 `main` 后 Actions 会自动 rsync 源码并执行 `docker compose up -d --build`。

## 安全说明

- 目前通过 HTTP 暴露，口令在传输中是明文。请使用足够长的随机口令，且不要在其他地方复用。
- 如需 HTTPS，可后续接域名 + 反向代理，或改为仅内网访问。
- 服务器上该部署用户属于 `docker` 组，等同于 root 权限，私钥请只放在 GitHub Secrets 里。
