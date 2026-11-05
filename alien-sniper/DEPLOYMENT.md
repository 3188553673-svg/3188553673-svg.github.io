# 云端中转版部署

原 GitHub Pages 版本通过 PeerJS 信令服务登记房间，但游戏数据由两台浏览器直接传送。PeerJS 的免费 TURN 服务已停用，因此校园网或某些路由器下会出现创建成功、朋友加入超时。增加房间等待时间不能解决这个问题。

本版本增加独立 Node.js 游戏服务器。两位玩家各自通过 HTTPS/WSS 连接云服务器，规则和命中判定由服务器运行，数据连接不使用 WebRTC。

## 一键部署

[在 Render 部署免费游戏服务器](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2F3188553673-svg%2F3188553673-svg.github.io)

使用你自己的 Render 账号，确认服务方案为 **Free**。仓库根目录的 `render.yaml` 已包含启动命令、Node 版本和健康检查。需要登录或授权 GitHub 时由账号本人完成。此文件不包含账号密钥。

部署成功后，直接打开 Render 提供的 HTTPS 网址即可游玩；该网址会自动使用云端连接。`GET /api/health` 应返回 `{"ok":true,"mode":"relay"}`（可能还有服务版本字段）。

如果希望继续使用原来的 GitHub Pages 游戏网址，把 `alien-sniper/connection.json` 更新为真实服务地址：

```json
{
  "mode": "relay",
  "serverUrl": "https://你的实际服务域名.onrender.com"
}
```

不要填尚未存在的域名。GitHub Pages 发布完成后，双方刷新原游戏网址并重新建房，不能沿用旧直连房间。

## 当前状态

当前已部署免费的联机服务器：<https://alien-sniper-relay-3188553673.onrender.com>。

原 GitHub Pages 游戏入口 <https://3188553673-svg.github.io/alien-sniper/> 的 `connection.json` 已配置为 `relay`。双方需要刷新网页并重新创建房间，不能沿用旧的直连房间。

部署通过全部 18 项服务器及连接测试，另已通过真实公网 HTTPS/WSS 双人对局检查。服务器使用单个 Free 实例，不依赖房主电脑运行 Node.js。

## 免费实例限制

Render Free 适合个人实验和爱好项目。15 分钟无流量后会休眠，重新打开约需一分钟；客户端包含启动等待提示。实例重启、重新部署或休眠会清除进行中的房间，双方需要重新建房。

官方说明：[免费实例](https://render.com/docs/free)、[WebSocket](https://render.com/docs/websocket)、[部署按钮](https://render.com/docs/deploy-to-render)、[PeerJS TURN 停用公告](https://github.com/orgs/peers/discussions/1172)。
