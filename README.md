# 一周训练记录（PWA 版）

这是一套适合手机浏览器和 iPhone 主屏幕使用的静态网页。

现在包含可选的“AI 陪练”实时语音模式：可以读取今日训练、语音打卡、控制休息计时、在计时结束时鼓励，并记录 1–10 分主观难度。

训练计划采用模块化编排：内置胸部与三头、背部与二头、肩部稳定、腿部与腹部/Core、全身高强度、手臂与握力、灵活性补强和休息恢复模块。每周七天可以拖动切图手柄调整模块顺序或更换当天模块，默认安排两个休息日；全身高强度和次日恢复强制绑定并作为整体移动。模块、拖动、绑定、导航和完成状态图标均使用深色与白色的极简线性位图切图。

新版不会迁移旧的固定七天计划和旧打卡。首次打开后会初始化新版模块，本周打卡从零开始；以后进入新的一周时会自动生成干净的默认编排，同时保留用户编辑过的模块内容。

## 文件说明

- `index.html`：主页面
- `manifest.webmanifest`：PWA 清单
- `sw.js`：离线缓存
- `icons/app-icon-192.png` / `icons/app-icon-512.png`：PWA 位图应用图标
- `icons/module/*.png`：独立居中的训练模块、拖动手柄和绑定状态切图
- `icons/ui/*.png`：独立居中的底部导航与完成状态切图
- `ui-icons.css`：全局切图图标样式
- `ai-companion.js` / `ai-companion.css`：AI 陪练前端
- `plan-modules.css`：每周模块编排和模块编辑样式
- `netlify/functions/realtime-session.mjs`：创建 OpenAI Realtime WebRTC 会话的安全服务端代理

## AI 陪练部署配置

AI 陪练需要服务端保护 OpenAI API Key，因此不能只部署在 GitHub Pages。推荐按下方 Netlify 方式部署，并在 Netlify 的 Site configuration → Environment variables 中设置：

- `OPENAI_API_KEY`：OpenAI API Key，仅保存在 Netlify 服务端。
- `AI_COMPANION_ACCESS_TOKEN`：自己生成的随机访问码，建议至少 24 位。
- `OPENAI_REALTIME_MODEL`：可选，默认 `gpt-realtime-mini`。
- `OPENAI_REALTIME_VOICE`：可选，默认 `marin`。

部署完成后，在网页“计划 → AI 陪练 → 连接设置”中填写同一个 `AI_COMPANION_ACCESS_TOKEN`。不要把 `OPENAI_API_KEY` 填入网页，也不要提交到 Git。

麦克风和 WebRTC 要求通过 HTTPS 访问。首次开始陪练时，浏览器会请求麦克风权限。

## GitHub Pages 部署

1. 新建一个 GitHub 仓库
2. 把这些文件上传到仓库根目录
3. 打开仓库 `Settings`
4. 进入 `Pages`
5. Source 选择 `Deploy from a branch`
6. Branch 选 `main`，文件夹选 `/root`
7. 保存后等待生成网址

生成后，你会得到类似：

`https://你的用户名.github.io/仓库名/`

## Netlify 部署

### 方法一：拖拽部署
1. 把整套文件放进一个文件夹
2. 打开 Netlify
3. 直接把文件夹拖进部署区域

### 方法二：连接 GitHub
1. 在 Netlify 选择 `Add new site`
2. 连接 GitHub 仓库
3. Build command 留空
4. Publish directory 留空或填 `/`
5. 直接部署

## iPhone 主屏幕使用方式

1. 用 Safari 打开部署后的固定网址
2. 点击“分享”
3. 选择“添加到主屏幕”
4. 以后都从主屏幕打开

## 很重要

不要从这些环境长期使用：
- 聊天里的网页预览
- 文件预览器
- 临时 HTML 打开器
- 会变化地址的在线预览链接

因为这类环境的本地存储不稳定，容易让记录看起来像丢失。

## 备份建议

网页已经带有：
- 导出所有记录（JSON）
- 导入记录（JSON）

建议每周导出一次备份。
