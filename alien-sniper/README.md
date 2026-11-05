> 跨网络加入失败时，请看[云端中转版部署](./DEPLOYMENT.md)。中转服务代码已提供；只有在真实云服务器上部署并配置后才会启用。

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

GitHub Pages 托管网页与游戏资源。浏览器通过 WebRTC 建立数据连接，由 PeerJS 公共信令服务帮助双方找到彼此，必要时由可用的 TURN 服务中继连接。房间规则在房主浏览器中执行，朋友浏览器接收自己可见的对局状态。

房主关闭或刷新网页会结束当前房间。双方应保持网页开启；菜单不会暂停对局。

实际跨设备、跨网络连接取决于双方网络的 WebRTC、ICE 和 TURN 可用性。同一台电脑的双浏览器测试不能替代校园网与手机网络之间的实测。

## 文件

- `index.html`、`style.css`、`app.js`：界面、操作和邀请链接。
- `scene.js`、`rules.js`：3D 场景及共享命中几何。
- `p2p-transport.js`、`engine.js`：浏览器联机和房间规则。
- `vendor/`：随项目提供的依赖与许可证。
- `.github/workflows/pages.yml`：GitHub Pages 发布工作流。

## 开源组件

Three.js 使用 MIT 许可证，许可证保留于 `vendor/THREE-LICENSE.txt`。PeerJS 版本为 **1.5.5**，使用 MIT 许可证，随附文件为 `vendor/peerjs.min.js`，许可证保留于 `vendor/PEERJS-LICENSE.txt`。
