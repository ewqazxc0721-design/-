# 一周训练记录（PWA 版）

这是一套适合手机浏览器和 iPhone 主屏幕使用的静态网页。

## 文件说明

- `index.html`：主页面
- `manifest.webmanifest`：PWA 清单
- `sw.js`：离线缓存
- `icons/app-icon.svg`：应用图标

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