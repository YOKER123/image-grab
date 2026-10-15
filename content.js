/**
 * content.js —— 注入「获取图片」按钮 + 扫描页面商品图片
 * 运行环境：内容脚本（页面上下文），仅在淘宝/天猫/京东/拼多多商家版匹配域名注入
 */
(function () {
  "use strict";

  // 避免同一页面被重复注入（例如 SPA 路由切换后再次执行）
  if (window.__imageGrabInjected__) return;
  window.__imageGrabInjected__ = true;

  const BTN_ID = "imagegrab-btn";
  const TOAST_ID = "imagegrab-toast";

  /** 小于该尺寸的图片视为图标 / 占位图，直接过滤 */
  const MIN_SIZE = 100;

  /* ------------------------------ 界面部分 ------------------------------ */

  /** 创建右下角悬浮按钮 */
  function createButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "获取图片";
    btn.title = "提取当前页面所有商品图片";
    btn.addEventListener("click", handleGrab);
    document.body.appendChild(btn);
  }

  /** 轻提示条 */
  let toastTimer = null;
  function showToast(message, duration = 2200) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    // 强制重排以便动画生效
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), duration);
  }

  /* ---------------------------- 图片扫描逻辑 ---------------------------- */

  /** 把任意 src 补全为绝对 URL，非法值返回 null */
  function toAbsoluteUrl(src) {
    if (!src || typeof src !== "string") return null;
    const value = src.trim();
    if (!value) return null;
    // 过滤 base64 内联图、SVG 占位图
    if (value.startsWith("data:")) return null;
    if (value.endsWith(".svg")) return null;
    try {
      return new URL(value, location.href).href;
    } catch (e) {
      return null;
    }
  }

  /**
   * 提取元素上的候选图片地址
   * 覆盖：<img> 的 src / srcset / data-src / data-lazy-src / data-original，
   *       以及 background-image 懒加载属性
   */
  function collectCandidates(el) {
    const urls = [];

    if (el.tagName === "IMG") {
      urls.push(el.currentSrc, el.src);
      // 常见懒加载属性（各平台命名不一，做兼容处理）
      ["data-src", "data-lazy-src", "data-original", "data-ks-lazyload", "data-img"].forEach((attr) => {
        urls.push(el.getAttribute(attr));
      });

      // srcset：格式为 "url1 1x, url2 2x"，取每段第一项
      const srcset = el.getAttribute("srcset") || el.getAttribute("data-srcset");
      if (srcset) {
        srcset.split(",").forEach((part) => urls.push(part.trim().split(/\s+/)[0]));
      }
    }

    // 背景图
    const bg = el.getAttribute("data-background") || el.getAttribute("data-bg");
    if (bg) urls.push(bg);

    return urls.map(toAbsoluteUrl).filter(Boolean);
  }

  /** 判断图片尺寸是否达到阈值（过滤图标 / logo / 1x1 占位图） */
  function isBigEnough(el, url) {
    const w = el.naturalWidth || parseInt(el.getAttribute("width") || "0", 10) || 0;
    const h = el.naturalHeight || parseInt(el.getAttribute("height") || "0", 10) || 0;

    // 已加载完成且尺寸过小 → 过滤
    if (w && h) return w >= MIN_SIZE && h >= MIN_SIZE;

    // 未加载出来时，用 CSS 尺寸兜底
    const rect = el.getBoundingClientRect();
    if (rect.width && rect.height) return rect.width >= MIN_SIZE && rect.height >= MIN_SIZE;

    // 完全拿不到尺寸的，先保留（交给预览页查看）
    return true;
  }

  /** 扫描整页图片 */
  function scanImages() {
    const seen = new Set();
    const result = [];

    // 1) 所有 <img>
    document.querySelectorAll("img").forEach((el) => {
      collectCandidates(el).forEach((url) => {
        if (seen.has(url)) return;
        if (!isBigEnough(el, url)) return;
        seen.add(url);
        result.push({
          url,
          width: el.naturalWidth || Math.round(el.getBoundingClientRect().width) || 0,
          height: el.naturalHeight || Math.round(el.getBoundingClientRect().height) || 0,
        });
      });
    });

    // 2) 背景图元素（商品图常用 background-image 做轮播）
    document.querySelectorAll("div, a, li, span, section").forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === "none" || !bg.includes("url(")) return;

      const matches = bg.match(/url\((['"]?)(.*?)\1\)/g) || [];
      matches.forEach((raw) => {
        const url = toAbsoluteUrl(raw.replace(/^url\((['"]?)/, "").replace(/(['"]?)\)$/, ""));
        if (!url || seen.has(url)) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return;
        seen.add(url);
        result.push({ url, width: Math.round(rect.width), height: Math.round(rect.height) });
      });
    });

    return result;
  }

  /* ------------------------------ 点击处理 ------------------------------ */

  /** 识别当前平台，方便预览页展示 */
  function detectPlatform() {
    const host = location.hostname;
    if (host.includes("taobao")) return "淘宝";
    if (host.includes("tmall")) return "天猫";
    if (host.includes("jd.com")) return "京东";
    if (host.includes("pinduoduo") || host.includes("yangkeduo")) return "拼多多商家版";
    return "未知平台";
  }

  async function handleGrab() {
    const btn = document.getElementById(BTN_ID);
    if (btn) {
      btn.disabled = true;
      btn.textContent = "正在提取…";
    }

    try {
      showToast("正在扫描页面图片…", 4000);

      // 先滚动到底部，触发懒加载图片加载出来
      await triggerLazyLoad();

      const images = scanImages();

      if (!images.length) {
        showToast("没有找到符合条件的商品图片，试试滚动页面后再点一次");
        return;
      }

      // 把结果交给 background（service worker），由它打开预览页
      await chrome.runtime.sendMessage({
        type: "IMAGES_COLLECTED",
        images,
        pageUrl: location.href,
        pageTitle: document.title,
        platform: detectPlatform(),
      });

      showToast(`已提取 ${images.length} 张图片，正在打开预览页…`);
    } catch (err) {
      console.error("[图提取] 提取失败：", err);
      showToast("提取失败：" + (err && err.message ? err.message : "未知错误"));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "获取图片";
      }
    }
  }

  /** 快速滚到底再回顶部，唤醒懒加载图片 */
  function triggerLazyLoad() {
    return new Promise((resolve) => {
      const startY = window.scrollY;
      const total = document.body.scrollHeight;
      let y = startY;
      const step = Math.max(window.innerHeight * 0.8, 400);

      const timer = setInterval(() => {
        y += step;
        window.scrollTo(0, y);
        if (y >= total) {
          clearInterval(timer);
          window.scrollTo(0, startY);
          // 给图片解码留一点时间
          setTimeout(resolve, 600);
        }
      }, 120);
    });
  }

  /* ------------------------------ 初始化 ------------------------------ */

  function init() {
    if (!document.body) return;
    createButton();
    // 页面高度变化时按钮始终固定在右下角，无需额外处理（fixed 定位）
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
