/**
 * background.js —— Service Worker
 * 职责：
 *   1. 接收内容脚本提取到的图片列表，暂存到 chrome.storage.local
 *   2. 打开扩展内的图片预览页 gallery.html
 *   3. 转发消息（例如预览页请求关闭标签等）
 *
 * 说明：MV3 的 Service Worker 里没有 URL.createObjectURL / DOM canvas，
 * 所以「转 PNG + 触发下载」放在预览页（扩展页面）中执行，见 gallery.js。
 */

/** 预览页地址 */
const GALLERY_PAGE = "gallery.html";

/* ------------------------- 消息处理 ------------------------- */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  switch (message.type) {
    // 内容脚本提取完成
    case "IMAGES_COLLECTED":
      handleImagesCollected(message)
        .then((count) => sendResponse({ ok: true, count }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true; // 异步响应

    // 预览页请求读取上次的提取结果
    case "GET_LAST_RESULT":
      chrome.storage.local.get("grab_result").then((data) => {
        sendResponse({ ok: true, result: data.grab_result || null });
      });
      return true;

    // 预览页上报下载完成（用于统计，可扩展为通知）
    case "DOWNLOAD_FINISHED":
      console.log(`[图提取] 本次共下载 ${message.success || 0} 张，失败 ${message.failed || 0} 张`);
      sendResponse({ ok: true });
      return true;

    default:
      return;
  }
});

/** 保存提取结果并打开预览页 */
async function handleImagesCollected(message) {
  const images = Array.isArray(message.images) ? message.images : [];

  await chrome.storage.local.set({
    grab_result: {
      images,
      pageUrl: message.pageUrl || "",
      pageTitle: message.pageTitle || "",
      platform: message.platform || "",
      time: Date.now(),
    },
  });

  // 复用已打开的预览页，避免开一堆标签
  const url = chrome.runtime.getURL(GALLERY_PAGE);
  const opened = await chrome.tabs.query({ url: url + "*" });

  if (opened.length) {
    await chrome.tabs.update(opened[0].id, { active: true, url });
  } else {
    await chrome.tabs.create({ url });
  }

  // 设置角标提示
  if (chrome.action && chrome.action.setBadgeText) {
    chrome.action.setBadgeText({ text: String(images.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#4f7cff" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 8000);
  }

  return images.length;
}

/* --------------------- 点击扩展图标：打开预览页 --------------------- */

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL(GALLERY_PAGE) });
  });
}
