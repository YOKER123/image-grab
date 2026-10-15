/**
 * gallery.js —— 预览页逻辑
 * 1. 从 chrome.storage.local 读取提取结果并网格化展示
 * 2. 全选 / 反选 / 清空 / 已选数量统计
 * 3. 勾选后批量下载，统一转换为 PNG，文件名为「商品图_001.png」
 */

"use strict";

/* ------------------------------ 全局状态 ------------------------------ */

const state = {
  images: [],      // [{ url, width, height }]
  selected: new Set(),
  downloading: false,
};

/* ------------------------------ DOM 引用 ------------------------------ */

const els = {
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  pageInfo: document.getElementById("pageInfo"),
  selectedCount: document.getElementById("selectedCount"),
  totalCount: document.getElementById("totalCount"),
  selectAll: document.getElementById("selectAll"),
  invertSelect: document.getElementById("invertSelect"),
  clearSelect: document.getElementById("clearSelect"),
  downloadBtn: document.getElementById("downloadBtn"),
  progress: document.getElementById("progress"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  toast: document.getElementById("toast"),
};

/* ------------------------------ 工具函数 ------------------------------ */

/** 轻提示 */
let toastTimer = null;
function showToast(text, duration = 2600) {
  els.toast.textContent = text;
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), duration);
}

/** 序号补零：1 → 001 */
function pad(n, len = 3) {
  return String(n).padStart(len, "0");
}

/** 从 URL 推断原始扩展名 */
function extOf(url) {
  const clean = url.split("?")[0].split("#")[0];
  const m = clean.match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : "jpg";
}

/* ------------------------------ 渲染 ------------------------------ */

function render() {
  els.grid.innerHTML = "";
  els.totalCount.textContent = String(state.images.length);
  els.empty.hidden = state.images.length > 0;

  state.images.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = String(index);
    if (state.selected.has(index)) card.classList.add("is-selected");

    // 复选框
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "card__check";
    check.checked = state.selected.has(index);
    check.addEventListener("click", (e) => {
      e.stopPropagation(); // 阻止冒泡，避免与卡片点击互相干扰
      toggleIndex(index, check.checked);
    });

    // 缩略图（懒加载，避免一次请求几百张图）
    const img = document.createElement("img");
    img.className = "card__thumb";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = item.url;
    img.alt = `商品图 ${index + 1}`;
    img.addEventListener("error", () => {
      img.alt = "图片加载失败（可能已失效或不允许跨站引用）";
      img.style.objectFit = "cover";
    });

    // 尺寸信息
    const meta = document.createElement("div");
    meta.className = "card__meta";
    const size = document.createElement("span");
    size.className = "card__size";
    size.textContent = item.width && item.height ? `${item.width} × ${item.height}` : extOf(item.url).toUpperCase();
    const seq = document.createElement("span");
    seq.textContent = `#${pad(index + 1)}`;
    meta.append(size, seq);

    card.append(check, img, meta);

    // 点击整张卡片也可以切换选中
    card.addEventListener("click", () => {
      const next = !state.selected.has(index);
      check.checked = next;
      toggleIndex(index, next);
    });

    els.grid.appendChild(card);
  });

  updateCounter();
}

/** 切换某个下标的选中态 */
function toggleIndex(index, checked) {
  if (checked) state.selected.add(index);
  else state.selected.delete(index);

  const card = els.grid.querySelector(`.card[data-index="${index}"]`);
  if (card) card.classList.toggle("is-selected", checked);

  updateCounter();
}

function updateCounter() {
  els.selectedCount.textContent = String(state.selected.size);
  els.downloadBtn.disabled = state.selected.size === 0 || state.downloading;
}

/* ------------------------------ PNG 转换 ------------------------------ */

/**
 * 把任意格式图片转换为 PNG Blob
 * 优先 fetch + createImageBitmap（可绕过部分跨域限制），失败则回退为原图
 */
async function toPngBlob(url) {
  const res = await fetch(url, { credentials: "omit", mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const blob = await res.blob();
  if (blob.type === "image/png") return { blob, converted: false };

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("canvas 转换失败");
  return { blob: png, converted: true };
}

/** 调用 chrome.downloads 下载一个 blob */
function downloadBlob(blob, filename) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    chrome.downloads.download({ url: objectUrl, filename, saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError || downloadId === undefined) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(chrome.runtime.lastError?.message || "下载失败"));
        return;
      }
      // 给浏览器留出读取时间后再释放内存
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      resolve(downloadId);
    });
  });
}

/* ------------------------------ 下载主流程 ------------------------------ */

async function downloadSelected() {
  if (state.downloading || !state.selected.size) return;

  const indexes = [...state.selected].sort((a, b) => a - b);
  state.downloading = true;
  els.downloadBtn.disabled = true;
  els.progress.hidden = false;

  let success = 0;
  let failed = 0;

  for (let i = 0; i < indexes.length; i++) {
    const index = indexes[i];
    const item = state.images[index];
    const percent = Math.round((i / indexes.length) * 100);

    els.progressFill.style.width = `${percent}%`;
    els.progressText.textContent = `正在下载 ${i + 1} / ${indexes.length}：商品图_${pad(index + 1)}.png`;

    try {
      const { blob } = await toPngBlob(item.url);
      await downloadBlob(blob, `商品图_${pad(index + 1)}.png`);
      success++;
      markBadge(index, "已下载", false);
    } catch (err) {
      // 转换失败则退而求其次：直接下载原图，保证不丢图
      try {
        await downloadBlob(
          await (await fetch(item.url, { credentials: "omit" })).blob(),
          `商品图_${pad(index + 1)}.${extOf(item.url)}`
        );
        markBadge(index, "已下载原图", false);
        success++;
      } catch (e2) {
        failed++;
        markBadge(index, "失败", true);
        console.warn("[图提取] 下载失败：", item.url, e2);
      }
    }
  }

  els.progressFill.style.width = "100%";
  els.progressText.textContent = `完成：成功 ${success} 张${failed ? `，失败 ${failed} 张` : ""}`;
  setTimeout(() => {
    els.progress.hidden = true;
    els.progressFill.style.width = "0";
  }, 1800);

  state.downloading = false;
  updateCounter();
  showToast(`下载完成：成功 ${success} 张${failed ? `，失败 ${failed} 张` : ""}`);

  // 通知 background 记录结果
  chrome.runtime.sendMessage({ type: "DOWNLOAD_FINISHED", success, failed }).catch(() => {});
}

/** 在卡片上打状态角标 */
function markBadge(index, text, isError) {
  const card = els.grid.querySelector(`.card[data-index="${index}"]`);
  if (!card) return;
  let badge = card.querySelector(".card__badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "card__badge";
    card.appendChild(badge);
  }
  badge.textContent = text;
  badge.classList.toggle("card__badge--error", !!isError);
}

/* ------------------------------ 事件绑定 ------------------------------ */

els.selectAll.addEventListener("click", () => {
  state.images.forEach((_, i) => state.selected.add(i));
  render();
});

els.invertSelect.addEventListener("click", () => {
  const next = new Set();
  state.images.forEach((_, i) => {
    if (!state.selected.has(i)) next.add(i);
  });
  state.selected = next;
  render();
});

els.clearSelect.addEventListener("click", () => {
  state.selected.clear();
  render();
});

els.downloadBtn.addEventListener("click", downloadSelected);

/* ------------------------------ 初始化 ------------------------------ */

async function init() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_LAST_RESULT" });
    const result = res && res.result;

    if (!result || !result.images || !result.images.length) {
      els.pageInfo.textContent = "暂无提取记录";
      els.empty.hidden = false;
      return;
    }

    state.images = result.images;
    els.pageInfo.textContent = `${result.platform || ""} · ${result.pageTitle || "未命名页面"}（${result.images.length} 张）`;

    // 默认全选，方便直接点「下载选中」
    state.images.forEach((_, i) => state.selected.add(i));
    render();
  } catch (err) {
    console.error("[图提取] 读取结果失败：", err);
    els.pageInfo.textContent = "读取失败，请重新在商品页点击「获取图片」";
    els.empty.hidden = false;
  }
}

init();
