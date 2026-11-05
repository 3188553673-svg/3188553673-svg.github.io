> 当前游戏入口：<https://3188553673-svg.github.io/alien-sniper/>。已启用免费的云端中转服务器。双方刷新后重新建房即可，不用下载文件或运行本地 Node.js。[部署说明](./DEPLOYMENT.md)。

# 狙击外星人 · GitHub Pages 版

双人“你狙我躲”：准备阶段 6 秒，狙击阶段 30 秒、三发子弹。身体命中、三发未中或时间耗尽后换边；头部命中获胜。弹孔在回合间保留，重赛时清空。

玩家打开发布后的网页，输入代号创建房间，再把邀请链接发给朋友。朋友打开链接、输入代号即可加入。游玩不需要下载文件、安装 Node.js 或在电脑上启动服务器。

## 发布到 GitHub Pages

1. 将本文件夹的内容放到一个 GitHub 仓库根目录，包括 `.github/workflows/pages.yml` 和 `.nojekyll`。不要把上一级目录的 `online/`、依赖目录或配置凭据一起上传。
2. 仓库默认分支使用 `main`。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。
4. 推送代码到 `main`，或在 **Actions → Publish game to GitHub Pages → Run workflow** 手动发布。
5. 以部署任务实际返回的地址为准。项目网站通常是 `https://<username>.github.io/<repository>/`。

这是待发布的静态源码；文件本身不代表网站已经上线。所有页面、样式和模块路径都相对于仓库子路径，适用于项目网站。

## 联机方式

GitHub Pages 托管网页与游戏资源。当前 `connection.json` 使用 `relay`：两位玩家通过 HTTPS/WSS 连接 Render 云端游戏服务器，由服务器运行房间规则和命中判定，并分别发送各自可见的对局状态。浏览器不使用 WebRTC 传送当前对局数据。

房主关闭或刷新网页会结束当前房间。双方应保持网页开启；菜单不会暂停对局。

当前云端连接不依赖 WebRTC 穿透，但双方仍需能访问 GitHub Pages 及 Render 服务。仓库保留的 `direct` 模式仅作备用，需要 WebRTC 网络条件；不要用它替代云端中转来保证校园网联机。

## 文件

- `index.html`、`style.css`、`app.js`：界面、操作和邀请链接。
- `scene.js`、`rules.js`：3D 场景及共享命中几何。
- `p2p-transport.js`、`engine.js`：浏览器联机和房间规则。
- `vendor/`：随项目提供的依赖与许可证。
- `.github/workflows/pages.yml`：GitHub Pages 发布工作流。

## 开源组件

Three.js 使用 MIT 许可证，许可证保留于 `vendor/THREE-LICENSE.txt`。PeerJS 版本为 **1.5.5**，使用 MIT 许可证，随附文件为 `vendor/peerjs.min.js`，许可证保留于 `vendor/PEERJS-LICENSE.txt`。
