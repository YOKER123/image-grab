/**
 * main.js —— 官网交互脚本
 * 1. 导航栏滚动吸顶（毛玻璃 + 阴影）
 * 2. 移动端汉堡菜单开合
 * 3. 滚动监听：当前区块导航高亮
 * 4. IntersectionObserver：元素滚动进入视口时淡入上移
 */
(function () {
  "use strict";

  /* ---------------- 导航栏滚动吸顶 ---------------- */

  const navbar = document.getElementById("navbar");

  function onScroll() {
    navbar.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll(); // 初始执行一次（刷新时可能已处于滚动位置）

  /* ---------------- 移动端汉堡菜单 ---------------- */

  const burger = document.getElementById("burger");
  const navLinks = document.getElementById("navLinks");

  burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });

  // 点击导航链接后自动收起菜单（移动端体验）
  navLinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------------- 滚动监听：导航高亮 ---------------- */

  const sections = ["intro", "features", "install", "download"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const links = new Map();
  navLinks.querySelectorAll("a[data-section]").forEach((a) => {
    links.set(a.dataset.section, a);
  });

  // IntersectionObserver 观察 section，进入视口中线即高亮对应导航
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.remove("is-active"));
        const link = links.get(entry.target.id);
        if (link) link.classList.add("is-active");
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );

  sections.forEach((sec) => spy.observe(sec));

  /* ---------------- 滚动进入动画 ---------------- */

  const revealEls = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    // 不支持或用户偏好减少动画：直接全部显示
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target); // 只播放一次
          }
        });
      },
      { threshold: 0.12 }
    );

    revealEls.forEach((el) => revealObserver.observe(el));
  }
})();
