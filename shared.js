(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }
  root.GlobisMypageLogic = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SETTINGS_KEY = "settings";
  const DEFAULT_SETTINGS = Object.freeze({
    discussionAutoExpand: true,
    discussionAutoCollapseOnLike: true,
    compactDiscussionLayout: true,
    notificationPreview: true,
    notificationDedupe: true,
    recentPostsInlineExpand: true,
    profileEmailCopy: true,
    googleCalendarSync: true
  });

  function normalizeSettings(value) {
    const normalized = { ...DEFAULT_SETTINGS };
    if (!value || typeof value !== "object") return normalized;

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof value[key] === "boolean") {
        normalized[key] = value[key];
      }
    }
    return normalized;
  }

  function parseLikeState(chipEl) {
    if (!chipEl) return "unliked";

    if (chipEl.classList && chipEl.classList.contains("bg-primary2")) return "liked";
    if (chipEl.classList && chipEl.classList.contains("bg-gray2")) return "unliked";

    const iconPath = chipEl.querySelector ? chipEl.querySelector("svg path") : null;
    const d = iconPath && typeof iconPath.getAttribute === "function"
      ? (iconPath.getAttribute("d") || "")
      : "";
    if (d.startsWith("M13.12 2.06")) return "liked";
    if (d.startsWith("M21 8h-6.31")) return "unliked";

    const countEl = chipEl.querySelector ? chipEl.querySelector("span") : null;
    const text = countEl && typeof countEl.textContent === "string"
      ? countEl.textContent.trim()
      : "";

    if (text === "+") return "unliked";
    if (text.length > 0) return "liked";

    return "unliked";
  }

  function isMoreLabel(text) {
    if (typeof text !== "string") return false;
    return text.trim().toLowerCase() === "more";
  }

  function isCloseLabel(text) {
    if (typeof text !== "string") return false;
    return text.trim() === "閉じる";
  }

  function normalizeDisplayName(name) {
    if (typeof name !== "string") return "";
    return name.replace(/\s+/g, " ").trim();
  }

  function isOwnPost(authorName, currentUserName) {
    const normalizedAuthor = normalizeDisplayName(authorName);
    const normalizedCurrentUser = normalizeDisplayName(currentUserName);
    return normalizedAuthor.length > 0 && normalizedAuthor === normalizedCurrentUser;
  }

  function shouldAutoExpandPost(likeState, authorName, currentUserName) {
    return likeState === "unliked" && !isOwnPost(authorName, currentUserName);
  }

  function shouldAutoCollapseOnLike(likeState) {
    return likeState === "liked";
  }

  function normalizeNotificationText(text) {
    return (text || "").replace(/\s+/g, "").trim();
  }

  function isMentionNotificationTitle(text) {
    return normalizeNotificationText(text).includes("であなたにメンションしました");
  }

  function isReactionNotificationTitle(text) {
    return normalizeNotificationText(text).includes("であなたにリアクションしました");
  }

  function shouldPreviewNotificationTitle(text) {
    return isMentionNotificationTitle(text);
  }

  function shouldDedupeNotificationTitle(text) {
    return isMentionNotificationTitle(text) || isReactionNotificationTitle(text);
  }

  return {
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
    normalizeSettings,
    parseLikeState,
    isMoreLabel,
    isCloseLabel,
    normalizeDisplayName,
    isOwnPost,
    shouldAutoExpandPost,
    shouldAutoCollapseOnLike,
    normalizeNotificationText,
    isMentionNotificationTitle,
    isReactionNotificationTitle,
    shouldPreviewNotificationTitle,
    shouldDedupeNotificationTitle
  };
});
