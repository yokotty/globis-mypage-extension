(() => {
  "use strict";

  const logic = globalThis.GlobisMypageLogic;
  const RUN_DELAYS_MS = [0, 500, 1200, 2500, 5000];
  const NOTIFICATION_OBS_DEBOUNCE_MS = 200;
  const NOTIFICATION_PERIODIC_MS = 2000;
  const NOTIFICATION_EXPAND_DELAY_MS = 500;
  const NOTIFICATION_DEDUPE_DELAY_MS = 1000;
  const RECENT_POST_OBS_DEBOUNCE_MS = 200;
  const URL_POLL_MS = 500;

  const POST_SELECTOR = "div.relative.rounded-t-3xl.bg-white";
  const LIKE_CHIP_SELECTOR = "div.relative.rounded-full.h-6.w-fit.cursor-pointer";
  const MORE_BUTTON_SELECTOR = ".flex.justify-end.mr-3 > button";
  const TABS_SELECTOR = "#tabs";
  const DISCUSSION_TOOLBAR_SELECTOR = "div.flex.justify-between.md\\:py-6.relative";
  const HEADER_NAV_SELECTOR = "#header-desktop-nav";
  const CURRENT_USER_NAME_SELECTOR = "aside.menu .text-sm.break-words";

  const ITEM_CLASS = "infiniteLoadingItem";
  const STYLE_ID = "vc-mypage-extension-style";
  const EXPANDED_ATTR = "data-vc-expanded";
  const ELLIPSIS_CLASS = "vc-ellipsis";
  const DUPLICATE_ATTR = "data-vc-duplicate";
  const RECENT_POST_ATTR = "data-vc-recent-post";
  const RECENT_POST_EXPANDED_ATTR = "data-vc-recent-expanded";
  const RECENT_POST_ORIGINAL_CLASS_ATTR = "data-vc-recent-original-class";
  const PROFILE_EMAIL_COPY_BUTTON_ATTR = "data-vc-profile-email-copy";
  const PROFILE_EMAIL_COPY_ROW_ATTR = "data-vc-profile-email-copy-row";
  const DEDUPE_LINES = 5;
  const MIN_BODY_CHARS = 20;

  let clickHandlerInstalled = false;
  let recentPostClickHandlerInstalled = false;
  let recentPostObserverInstalled = false;
  let recentPostObserverTimer = 0;
  let profileEmailCopyClickHandlerInstalled = false;
  let profileEmailCopyObserverInstalled = false;
  let profileEmailCopyObserverTimer = 0;
  let discussionObserverInstalled = false;
  let discussionExpandScheduled = false;
  let notificationListObserver = null;
  let notificationFinderObserver = null;
  let notificationPeriodicTimer = null;
  let urlPollTimer = null;
  let lastUrl = location.href;
  let bootstrapped = false;
  let notificationExpandEnabledAt = Date.now() + NOTIFICATION_EXPAND_DELAY_MS;
  let notificationDedupeEnabledAt = Date.now() +
    NOTIFICATION_EXPAND_DELAY_MS +
    NOTIFICATION_DEDUPE_DELAY_MS;

  function isDiscussionPage(pathname = location.pathname) {
    return /^\/my\/cm(\/|$)/.test(pathname);
  }

  function isHomePage(pathname = location.pathname) {
    return /^\/my\/?$/.test(pathname);
  }

  function isExcludedDiscussionPage(pathname = location.pathname) {
    return /^\/my\/cm\/740(\/|$)/.test(pathname);
  }

  function shouldRunOnThisPage() {
    return isDiscussionPage() && !isExcludedDiscussionPage();
  }

  function shouldRunNotificationFeaturesOnThisPage() {
    return isDiscussionPage();
  }

  function shouldRunContentFeaturesOnThisPage() {
    return /^\/my(\/|$)/.test(location.pathname);
  }

  function storageApi() {
    return globalThis.chrome && chrome.storage && chrome.storage.sync
      ? chrome.storage.sync
      : null;
  }

  function loadSettings() {
    const api = storageApi();
    if (!api || !logic) {
      return Promise.resolve(logic ? logic.normalizeSettings() : {});
    }

    return new Promise((resolve) => {
      api.get(logic.SETTINGS_KEY, (result) => {
        const raw = result ? result[logic.SETTINGS_KEY] : undefined;
        resolve(logic.normalizeSettings(raw));
      });
    });
  }

  function notificationNowMs() {
    return Date.now();
  }

  function getCurrentUserName() {
    const nameEl = document.querySelector(CURRENT_USER_NAME_SELECTOR);
    return nameEl && typeof nameEl.textContent === "string"
      ? nameEl.textContent.trim()
      : "";
  }

  function getMainSection(postEl) {
    return postEl.querySelector(":scope > .text-black2.grid.grid-cols-1");
  }

  function getPostAuthorName(postEl) {
    const section = getMainSection(postEl);
    if (!section) return "";

    const preferredNameEl = section.querySelector(
      ":scope > div:first-child div.font-bold.text-\\[13px\\].md\\:text-\\[11px\\]"
    );
    if (preferredNameEl && typeof preferredNameEl.textContent === "string") {
      return preferredNameEl.textContent.trim();
    }

    const fallbackNameEl = section.querySelector(
      ":scope > div:first-child span.text-\\[13px\\].font-bold"
    );
    return fallbackNameEl && typeof fallbackNameEl.textContent === "string"
      ? fallbackNameEl.textContent.trim()
      : "";
  }

  function getLikeChip(postEl) {
    const section = getMainSection(postEl);
    if (section) {
      const sectionChip = section.querySelector(`:scope > ${LIKE_CHIP_SELECTOR}`);
      if (sectionChip) return sectionChip;
    }
    return postEl.querySelector(LIKE_CHIP_SELECTOR);
  }

  function shouldExpandPost(postEl) {
    const chip = getLikeChip(postEl);
    const likeState = logic.parseLikeState(chip);
    return logic.shouldAutoExpandPost(
      likeState,
      getPostAuthorName(postEl),
      getCurrentUserName()
    );
  }

  function isLikedPost(postEl) {
    const chip = getLikeChip(postEl);
    return logic.shouldAutoCollapseOnLike(logic.parseLikeState(chip));
  }

  function clickAllMoreButtons() {
    const postEls = document.querySelectorAll(POST_SELECTOR);
    let clicked = 0;

    for (const postEl of postEls) {
      if (!shouldExpandPost(postEl)) continue;
      const btn = postEl.querySelector(MORE_BUTTON_SELECTOR);
      if (!logic.isMoreLabel(btn && btn.textContent)) continue;
      btn.click();
      clicked += 1;
    }

    return clicked;
  }

  function collapsePostViaToggle(postEl) {
    if (!isLikedPost(postEl)) return false;
    const btn = postEl.querySelector(MORE_BUTTON_SELECTOR);
    if (!logic.isCloseLabel(btn && btn.textContent)) return false;
    btn.click();
    return true;
  }

  function adjustTabsHeight() {
    const tabsEl = document.querySelector(TABS_SELECTOR);
    if (!tabsEl) return;
    tabsEl.classList.remove("md:h-[52px]");
    tabsEl.classList.add("md:h-[42px]");
  }

  function adjustDiscussionToolbarPadding() {
    const toolbarEls = document.querySelectorAll(DISCUSSION_TOOLBAR_SELECTOR);
    for (const toolbarEl of toolbarEls) {
      toolbarEl.classList.remove("md:py-6");
      toolbarEl.classList.add("md:py-3");
    }
  }

  function adjustHeaderNavPadding() {
    const navEl = document.querySelector(HEADER_NAV_SELECTOR);
    if (!navEl) return;
    navEl.classList.remove("py-[7px]");
    navEl.classList.add("py-[1px]");
  }

  function compactDiscussionLayout() {
    adjustTabsHeight();
    adjustDiscussionToolbarPadding();
    adjustHeaderNavPadding();
  }

  function runDiscussionLayoutFeatures(settings) {
    if (!shouldRunOnThisPage() || !logic) return;
    if (!settings.compactDiscussionLayout) return;
    compactDiscussionLayout();
  }

  function scheduleDiscussionExpand(settings) {
    if (!shouldRunOnThisPage() || !logic) return;
    if (!settings.discussionAutoExpand) return;
    if (discussionExpandScheduled) return;

    discussionExpandScheduled = true;
    requestAnimationFrame(() => {
      discussionExpandScheduled = false;
      const clicked = clickAllMoreButtons();
      if (clicked > 0) {
        setTimeout(() => scheduleDiscussionExpand(settings), 120);
      }
    });
  }

  function runDiscussionFeatures(settings) {
    if (!shouldRunOnThisPage() || !logic) return;
    runDiscussionLayoutFeatures(settings);
    scheduleDiscussionExpand(settings);
  }

  function installDiscussionObserver(settings) {
    if (discussionObserverInstalled) return;
    if (!settings.discussionAutoExpand && !settings.compactDiscussionLayout) return;
    if (typeof MutationObserver !== "function" || !document.documentElement) return;

    discussionObserverInstalled = true;
    const observer = new MutationObserver((mutations) => {
      if (!shouldRunOnThisPage()) return;
      for (const mutation of mutations) {
        if (mutation.type !== "childList") continue;
        runDiscussionLayoutFeatures(settings);
        scheduleDiscussionExpand(settings);
        return;
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleCollapseForPost(postEl) {
    const tryCollapse = () => collapsePostViaToggle(postEl);
    setTimeout(tryCollapse, 60);
    setTimeout(tryCollapse, 180);
    setTimeout(tryCollapse, 400);
    setTimeout(tryCollapse, 800);
  }

  function installDiscussionClickHandler() {
    if (clickHandlerInstalled) return;
    clickHandlerInstalled = true;

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const chip = target.closest(LIKE_CHIP_SELECTOR);
      if (!chip) return;
      const postEl = chip.closest(POST_SELECTOR);
      if (!postEl) return;
      const mainChip = getLikeChip(postEl);
      if (mainChip !== chip) return;
      scheduleCollapseForPost(postEl);
    }, true);
  }

  function injectNotificationStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${ITEM_CLASS}[${DUPLICATE_ATTR}="true"] {
        height: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        box-shadow: none !important;
        background: transparent !important;
        overflow: hidden !important;
      }

      .${ITEM_CLASS}[${DUPLICATE_ATTR}="true"] * {
        display: none !important;
      }

      .${ITEM_CLASS} p.line-clamp-2 {
        line-height: 1.2;
      }

      .${ITEM_CLASS} .editor-content,
      .${ITEM_CLASS} .editor-content p {
        line-height: 1.3;
      }

      .${ITEM_CLASS} .ProseMirror-trailingBreak,
      .${ITEM_CLASS} .ProseMirror-separator {
        display: none;
      }

      .editor-content[${EXPANDED_ATTR}="true"] {
        display: block !important;
        -webkit-box-orient: initial !important;
        -webkit-line-clamp: unset !important;
        overflow: visible !important;
        max-height: none !important;
      }

      [${RECENT_POST_ATTR}][${RECENT_POST_EXPANDED_ATTR}="true"] {
        height: auto !important;
      }

      [${RECENT_POST_ATTR}][${RECENT_POST_EXPANDED_ATTR}="true"] .editor-content {
        display: block !important;
        -webkit-box-orient: initial !important;
        -webkit-line-clamp: unset !important;
        overflow: visible !important;
        max-height: none !important;
      }

      button[${PROFILE_EMAIL_COPY_BUTTON_ATTR}] {
        border: 1px solid #b7c7e6 !important;
        border-radius: 6px !important;
        background: #ffffff !important;
        color: #0e357f !important;
        font-size: 11px !important;
        line-height: 1 !important;
        padding: 6px 8px !important;
        margin-left: 10px !important;
        white-space: nowrap !important;
      }

      button[${PROFILE_EMAIL_COPY_BUTTON_ATTR}]:hover {
        background: #eef4ff !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getNotificationItems(root = document) {
    if (root.classList && root.classList.contains(ITEM_CLASS)) return [root];
    return Array.from(root.querySelectorAll(`.${ITEM_CLASS}`));
  }

  function getNotificationTitleText(item) {
    const title = item.querySelector("p.line-clamp-2");
    return title ? title.textContent || "" : "";
  }

  function getBodyKey(editor) {
    const text = (editor.innerText || editor.textContent || "").trim();
    if (!text) return "";
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, DEDUPE_LINES)
      .join("\n");
  }

  function applyFullNotificationPreview(editor) {
    editor.classList.remove("line-clamp-3");
    editor.classList.remove("line-clamp-4");
    editor.classList.remove("line-clamp-2");
    editor.classList.add("line-clamp-none");

    editor.style.display = "block";
    editor.style.removeProperty("-webkit-box-orient");
    editor.style.removeProperty("-webkit-line-clamp");
    editor.style.overflow = "visible";
    editor.style.maxHeight = "none";

    const existing = editor.querySelector(`.${ELLIPSIS_CLASS}`);
    if (existing) existing.remove();

    editor.setAttribute(EXPANDED_ATTR, "true");
  }

  function applyNotificationPreviews(items, now) {
    for (const item of items) {
      const editor = item.querySelector(".editor-content");
      if (!editor) continue;
      if (!logic.shouldPreviewNotificationTitle(getNotificationTitleText(item))) continue;
      if (now < notificationExpandEnabledAt) continue;
      applyFullNotificationPreview(editor);
    }
  }

  function clearDuplicateMarks(items) {
    for (const item of items) {
      item.style.display = "";
      item.style.height = "";
      item.style.minHeight = "";
      item.style.margin = "";
      item.style.padding = "";
      item.style.overflow = "";
      item.style.border = "";
      item.style.boxShadow = "";
      item.style.background = "";
      item.removeAttribute(DUPLICATE_ATTR);
    }
  }

  function markDuplicate(item) {
    const isSpacer = (el) => {
      if (!el || !el.classList) return false;
      if (el.classList.contains("items-start") && el.classList.contains("w-full")) return true;
      if (el.classList.contains("relative") && el.classList.contains("mr-3")) return true;
      return false;
    };

    let prev = item.previousElementSibling;
    while (prev && isSpacer(prev)) {
      const toRemove = prev;
      prev = prev.previousElementSibling;
      toRemove.remove();
    }

    item.style.display = "block";
    item.style.height = "0px";
    item.style.minHeight = "0px";
    item.style.margin = "0px";
    item.style.padding = "0px";
    item.style.overflow = "hidden";
    item.style.border = "0";
    item.style.boxShadow = "none";
    item.style.background = "transparent";
    item.setAttribute(DUPLICATE_ATTR, "true");
  }

  function getVisualItems(items) {
    return items
      .map((item) => {
        const rect = item.getBoundingClientRect();
        return { item, top: rect.top, left: rect.left, height: rect.height };
      })
      .filter((entry) => Number.isFinite(entry.top) && entry.height > 0)
      .sort((a, b) => (a.top - b.top) || (a.left - b.left))
      .map((entry) => entry.item);
  }

  function applyDuplicateMarks(items) {
    const firstByKey = new Map();
    for (const item of getVisualItems(items)) {
      if (!logic.shouldDedupeNotificationTitle(getNotificationTitleText(item))) continue;
      const editor = item.querySelector(".editor-content");
      if (!editor) continue;
      const key = getBodyKey(editor);
      if (!key || key.length < MIN_BODY_CHARS) continue;

      if (!firstByKey.has(key)) {
        firstByKey.set(key, item);
        continue;
      }
      markDuplicate(item);
    }
  }

  function isRecentPostDetailLabel(text) {
    return typeof text === "string" && text.trim() === "詳細を見る";
  }

  function findRecentPostButton(card) {
    const buttons = Array.from(card.querySelectorAll("button"));
    return buttons.find((button) =>
      isRecentPostDetailLabel(button.textContent)
    ) || null;
  }

  function findRecentPostCardFromEditor(editor) {
    let el = editor.parentElement;
    for (let depth = 0; el && depth < 8; depth += 1, el = el.parentElement) {
      if (
        el.classList &&
        el.classList.contains("shadow-md") &&
        el.querySelector(".editor-content") === editor &&
        findRecentPostButton(el)
      ) {
        return el;
      }
    }
    return null;
  }

  function getRecentPostCards(root = document) {
    const cards = [];
    const seen = new Set();
    for (const editor of Array.from(root.querySelectorAll(".editor-content"))) {
      const card = findRecentPostCardFromEditor(editor);
      if (!card || seen.has(card)) continue;
      seen.add(card);
      cards.push(card);
    }
    return cards;
  }

  function getRecentPostEditor(card) {
    return card.querySelector(".editor-content");
  }

  function expandRecentPostCard(card) {
    const editor = getRecentPostEditor(card);
    if (!editor) return;

    if (!editor.hasAttribute(RECENT_POST_ORIGINAL_CLASS_ATTR)) {
      editor.setAttribute(RECENT_POST_ORIGINAL_CLASS_ATTR, editor.className);
    }

    editor.classList.remove("line-clamp-3");
    editor.classList.remove("line-clamp-4");
    editor.classList.remove("line-clamp-2");
    editor.classList.add("line-clamp-none");
    editor.style.display = "block";
    editor.style.removeProperty("-webkit-box-orient");
    editor.style.removeProperty("-webkit-line-clamp");
    editor.style.overflow = "visible";
    editor.style.maxHeight = "none";

    card.setAttribute(RECENT_POST_EXPANDED_ATTR, "true");
    card.setAttribute("aria-expanded", "true");
  }

  function collapseRecentPostCard(card) {
    const editor = getRecentPostEditor(card);
    if (!editor) return;

    const originalClass = editor.getAttribute(RECENT_POST_ORIGINAL_CLASS_ATTR);
    if (originalClass) {
      editor.className = originalClass;
    } else {
      editor.classList.remove("line-clamp-none");
      editor.classList.add("line-clamp-3");
    }

    editor.style.display = "";
    editor.style.removeProperty("-webkit-box-orient");
    editor.style.removeProperty("-webkit-line-clamp");
    editor.style.overflow = "";
    editor.style.maxHeight = "";

    card.setAttribute(RECENT_POST_EXPANDED_ATTR, "false");
    card.setAttribute("aria-expanded", "false");
  }

  function toggleRecentPostCard(card) {
    if (card.getAttribute(RECENT_POST_EXPANDED_ATTR) === "true") {
      collapseRecentPostCard(card);
      return;
    }
    expandRecentPostCard(card);
  }

  function enhanceRecentPostCards(root = document) {
    if (!isHomePage()) return;
    injectNotificationStyle();

    for (const card of getRecentPostCards(root)) {
      const editor = getRecentPostEditor(card);
      const button = findRecentPostButton(card);
      if (!editor || !button) continue;

      card.setAttribute(RECENT_POST_ATTR, "true");
      if (!card.hasAttribute(RECENT_POST_EXPANDED_ATTR)) {
        card.setAttribute(RECENT_POST_EXPANDED_ATTR, "false");
      }
      if (!editor.hasAttribute(RECENT_POST_ORIGINAL_CLASS_ATTR)) {
        editor.setAttribute(RECENT_POST_ORIGINAL_CLASS_ATTR, editor.className);
      }

      card.style.cursor = "pointer";
      card.setAttribute(
        "aria-expanded",
        card.getAttribute(RECENT_POST_EXPANDED_ATTR) === "true" ? "true" : "false"
      );
    }
  }

  function installRecentPostClickHandler() {
    if (recentPostClickHandlerInstalled) return;
    recentPostClickHandlerInstalled = true;

    document.addEventListener("click", (event) => {
      if (!isHomePage()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("a, button, input, select, textarea, [contenteditable='true']")) {
        return;
      }
      const card = target.closest(`[${RECENT_POST_ATTR}]`);
      if (!card) return;

      event.preventDefault();
      event.stopPropagation();
      toggleRecentPostCard(card);
    }, true);
  }

  function installRecentPostObserver(settings) {
    if (recentPostObserverInstalled) return;
    if (!settings.recentPostsInlineExpand) return;
    if (typeof MutationObserver !== "function" || !document.body) return;

    recentPostObserverInstalled = true;

    const observer = new MutationObserver(() => {
      clearTimeout(recentPostObserverTimer);
      recentPostObserverTimer = setTimeout(() => {
        enhanceRecentPostCards();
      }, RECENT_POST_OBS_DEBOUNCE_MS);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function isEmailText(text) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((text || "").trim());
  }

  function getProfileModalRoot() {
    const modal = document.querySelector("#base-modal");
    if (!modal) return null;
    const title = modal.querySelector("h2");
    if (!title || !title.textContent.includes("プロフィール")) return null;
    return modal;
  }

  function getProfileEmailRows(root = document) {
    const modal = root.matches && root.matches("#base-modal")
      ? root
      : getProfileModalRoot();
    if (!modal) return [];

    const labels = Array.from(modal.querySelectorAll('label[for="mail"], label[for="alumniMail"]'));
    return labels
      .map((label) => {
        let row = label.parentElement;
        for (let depth = 0; row && depth < 5; depth += 1, row = row.parentElement) {
          const emailEl = row.querySelector("span.text-\\[13px\\]");
          if (emailEl && isEmailText(emailEl.textContent)) {
            return { row, label, emailEl };
          }
        }
        return null;
      })
      .filter(Boolean);
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }
    return copied;
  }

  async function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_error) {
        // Fall through to the legacy copy path.
      }
    }
    return fallbackCopyText(text);
  }

  function setProfileCopyButtonStatus(button, text) {
    const original = button.getAttribute("data-vc-copy-label") || "コピー";
    button.textContent = text;
    clearTimeout(button._vcCopyStatusTimer);
    button._vcCopyStatusTimer = setTimeout(() => {
      button.textContent = original;
    }, 1400);
  }

  function enhanceProfileEmailCopyButtons(root = document) {
    if (!document.body) return;
    const rows = getProfileEmailRows(root);
    if (rows.length === 0) return;

    injectNotificationStyle();

    for (const { row, emailEl } of rows) {
      if (row.hasAttribute(PROFILE_EMAIL_COPY_ROW_ATTR)) continue;

      const valueWrap = emailEl.parentElement;
      if (!valueWrap) continue;
      const valueContainer = valueWrap.parentElement || valueWrap;
      valueContainer.style.display = "flex";
      valueContainer.style.alignItems = "center";
      valueContainer.style.gap = "0";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "コピー";
      button.setAttribute("data-vc-copy-label", "コピー");
      button.setAttribute(PROFILE_EMAIL_COPY_BUTTON_ATTR, "true");
      button.dataset.email = emailEl.textContent.trim();
      button.setAttribute("aria-label", `${emailEl.textContent.trim()} をコピー`);
      valueContainer.appendChild(button);
      row.setAttribute(PROFILE_EMAIL_COPY_ROW_ATTR, "true");
    }
  }

  function installProfileEmailCopyClickHandler() {
    if (profileEmailCopyClickHandlerInstalled) return;
    profileEmailCopyClickHandlerInstalled = true;

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest(`button[${PROFILE_EMAIL_COPY_BUTTON_ATTR}]`);
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      const email = button.dataset.email || "";
      copyText(email).then((ok) => {
        setProfileCopyButtonStatus(button, ok ? "コピー済み" : "失敗");
      });
    }, true);
  }

  function installProfileEmailCopyObserver(settings) {
    if (profileEmailCopyObserverInstalled) return;
    if (!settings.profileEmailCopy) return;
    if (typeof MutationObserver !== "function" || !document.body) return;

    profileEmailCopyObserverInstalled = true;
    const observer = new MutationObserver(() => {
      clearTimeout(profileEmailCopyObserverTimer);
      profileEmailCopyObserverTimer = setTimeout(() => {
        enhanceProfileEmailCopyButtons();
      }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function runNotificationFeatures(settings, root = document) {
    if (!shouldRunNotificationFeaturesOnThisPage() || !logic) return;
    if (!settings.notificationPreview && !settings.notificationDedupe) return;

    injectNotificationStyle();
    const items = getNotificationItems(root);
    if (items.length === 0) return;
    const now = notificationNowMs();
    if (settings.notificationPreview) applyNotificationPreviews(items, now);
    if (settings.notificationDedupe) {
      clearDuplicateMarks(items);
      if (now >= notificationDedupeEnabledAt) applyDuplicateMarks(items);
    }
  }

  function runRecentPostFeatures(settings) {
    if (!isHomePage() || !logic) return;
    if (!settings.recentPostsInlineExpand) return;
    enhanceRecentPostCards();
  }

  function runProfileEmailCopyFeatures(settings) {
    if (!logic || !settings.profileEmailCopy) return;
    enhanceProfileEmailCopyButtons();
  }

  function runEnabledFeatures(settings) {
    if (!shouldRunContentFeaturesOnThisPage() || !logic) return;

    runDiscussionFeatures(settings);
    runNotificationFeatures(settings);
    runRecentPostFeatures(settings);
    runProfileEmailCopyFeatures(settings);
  }

  function getNotificationListParent() {
    const item = document.querySelector(`.${ITEM_CLASS}`);
    return item ? item.parentElement : null;
  }

  function startNotificationListObserver(settings, listParent) {
    if (notificationListObserver) notificationListObserver.disconnect();

    let timer = null;
    const observer = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        runNotificationFeatures(settings, listParent);
      }, NOTIFICATION_OBS_DEBOUNCE_MS);
    });

    observer.observe(listParent, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
    notificationListObserver = observer;
  }

  function tryStartNotificationListObserver(settings) {
    const listParent = getNotificationListParent();
    if (!listParent) return false;
    runNotificationFeatures(settings, listParent);
    startNotificationListObserver(settings, listParent);
    return true;
  }

  function watchForNotificationList(settings) {
    if (tryStartNotificationListObserver(settings)) return;
    if (notificationFinderObserver || !document.body) return;

    notificationFinderObserver = new MutationObserver(() => {
      if (!tryStartNotificationListObserver(settings)) return;
      notificationFinderObserver.disconnect();
      notificationFinderObserver = null;
    });
    notificationFinderObserver.observe(document.body, { childList: true, subtree: true });
  }

  function startPeriodicNotificationRun(settings) {
    if (notificationPeriodicTimer) return;
    notificationPeriodicTimer = setInterval(() => {
      runNotificationFeatures(settings);
    }, NOTIFICATION_PERIODIC_MS);
  }

  function installNotificationReruns(settings) {
    if (!settings.notificationPreview && !settings.notificationDedupe) return;
    if (typeof MutationObserver === "function") {
      watchForNotificationList(settings);
    }
    startPeriodicNotificationRun(settings);
  }

  function runStartupFeatures(settings) {
    if (shouldRunOnThisPage() && settings.discussionAutoCollapseOnLike) {
      installDiscussionClickHandler();
    }
    installDiscussionObserver(settings);
    installNotificationReruns(settings);
    if (settings.recentPostsInlineExpand) {
      installRecentPostClickHandler();
      installRecentPostObserver(settings);
    }
    if (settings.profileEmailCopy) {
      installProfileEmailCopyClickHandler();
      installProfileEmailCopyObserver(settings);
    }
    for (const delay of RUN_DELAYS_MS) {
      setTimeout(() => runEnabledFeatures(settings), delay);
    }
  }

  function runStartupFeaturesFromStorage() {
    if (!shouldRunContentFeaturesOnThisPage()) return;
    loadSettings().then(runStartupFeatures);
  }

  function onUrlChange() {
    if (lastUrl === location.href) return;
    lastUrl = location.href;
    runStartupFeaturesFromStorage();
  }

  function hookHistory() {
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      onUrlChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      onUrlChange();
    };

    window.addEventListener("popstate", onUrlChange);
  }

  function startUrlPoll() {
    if (urlPollTimer) return;
    urlPollTimer = setInterval(onUrlChange, URL_POLL_MS);
  }

  function bootstrap() {
    if (bootstrapped) return;
    bootstrapped = true;
    hookHistory();
    startUrlPoll();
    runStartupFeaturesFromStorage();
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
