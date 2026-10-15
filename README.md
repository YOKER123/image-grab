# 图提取 ImageGrab

一款 Chrome 浏览器扩展：在**淘宝、天猫、京东、拼多多商家版**的商品详情页，一键提取页面内所有商品图片，在新标签页中集中预览、勾选，并批量下载为 **PNG** 格式。

## 功能特性

- **一键提取**：详情页右下角悬浮「获取图片」按钮，点击自动扫描页面所有商品图
- **智能过滤**：自动排除图标、logo、1x1 占位图及小于 100×100 的小图，URL 自动去重
- **懒加载兼容**：提取前自动滚动页面，唤醒 `data-src`、`data-lazy-src`、`srcset`、背景图等懒加载图片
- **集中预览**：新标签页响应式网格展示，含缩略图、尺寸信息、序号
- **自由勾选**：全选 / 反选 / 清空，实时显示已选数量
- **统一 PNG**：jpg / webp 自动经 canvas 转为 PNG；转换失败时自动降级为下载原图
- **批量下载**：通过 `chrome.downloads` 保存到默认下载目录，文件名自动编号（`商品图_001.png`），带进度与结果反馈

## 项目结构

```
image-grab/
├── manifest.json        # MV3 配置：权限、匹配域名、注入脚本
├── content.js           # 内容脚本：注入按钮 + 扫描页面图片
├── content.css          # 悬浮按钮样式
├── background.js        # Service Worker：暂存结果、打开预览页、消息转发
├── gallery.html         # 预览页骨架
├── gallery.js           # 预览页逻辑：展示、勾选、转 PNG、批量下载
├── gallery.css          # 预览页样式
├── gen_icons.py         # 图标生成脚本（纯标准库，可选）
├── icons/               # 扩展图标 16 / 48 / 128
└── docs/                # 官方宣传网站（GitHub Pages 发布用）
```

## 安装与使用

1. 下载本项目压缩包并解压到本地文件夹
2. 打开 Chrome，地址栏输入 `chrome://extensions` 回车
3. 打开右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择解压后的文件夹
5. 打开淘宝 / 天猫 / 京东 / 拼多多商家版的商品详情页，点击右下角「获取图片」
6. 在弹出的预览页中勾选需要的图片，点击「下载选中」即可批量保存为 PNG

> 注：MV3 的 Service Worker 中没有 `URL.createObjectURL` 与 DOM canvas，因此「转 PNG + 触发下载」由预览页（扩展页面）执行；`background.js` 负责暂存提取结果、打开预览页与消息转发。

## 官网

项目官网位于 `docs/` 文件夹，纯静态站点，通过 GitHub Pages 发布：
https://yoker123.github.io/image-grab/

## 推送到 GitHub（一键脚本）

项目已初始化 git 仓库并完成首次提交，在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1
```

脚本会自动完成：验证令牌 → 创建 `image-grab` 仓库 → 推送 `main` 分支 → 开启 GitHub Pages（分支 `main` + 目录 `/docs`）→ 打印线上地址。
令牌仅在当次运行使用，不会写入 `.git/config`，不会随仓库泄露。

手动操作则等价于：

```bash
git remote add origin https://github.com/YOKER123/image-grab.git
git push -u origin main
# 然后在仓库 Settings → Pages 中，Source 选 main、目录选 /docs
```

## 后续更新推送

```bash
git add .
git commit -m "更新说明"
git push
```

> 说明：本机访问 GitHub 需要走本地代理，仓库已配置 `git config http.proxy http://127.0.0.1:7890`。
> 若代理端口有变或不再需要，用 `git config --unset http.proxy` 移除该配置即可。

## 开源协议

MIT
