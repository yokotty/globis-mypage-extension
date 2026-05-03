const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_SETTINGS,
  normalizeSettings,
  parseLikeState,
  isMoreLabel,
  isCloseLabel,
  normalizeDisplayName,
  isOwnPost,
  shouldAutoExpandPost,
  shouldAutoCollapseOnLike,
  shouldPreviewNotificationTitle,
  shouldDedupeNotificationTitle
} = require("./shared.js");

function makeClassList(initial = []) {
  const set = new Set(initial);
  return {
    contains(name) {
      return set.has(name);
    }
  };
}

function makeChip({ classes = [], countText = "" } = {}) {
  return {
    classList: makeClassList(classes),
    querySelector(selector) {
      if (selector !== "span") return null;
      return { textContent: countText };
    }
  };
}

test("normalizeSettings merges known boolean keys with defaults", () => {
  const settings = normalizeSettings({
    discussionAutoExpand: false,
    notificationPreview: false,
    notificationDedupe: false,
    recentPostsInlineExpand: false,
    profileEmailCopy: false,
    unknown: false
  });

  assert.equal(settings.discussionAutoExpand, false);
  assert.equal(settings.notificationPreview, false);
  assert.equal(settings.notificationDedupe, false);
  assert.equal(settings.recentPostsInlineExpand, false);
  assert.equal(settings.profileEmailCopy, false);
  assert.equal(Object.hasOwn(settings, "unknown"), false);
});

test("parseLikeState prefers class hints", () => {
  assert.equal(parseLikeState(makeChip({ classes: ["bg-primary2"], countText: "+" })), "liked");
  assert.equal(parseLikeState(makeChip({ classes: ["bg-gray2"], countText: "1" })), "unliked");
});

test("parseLikeState falls back to count text", () => {
  assert.equal(parseLikeState(makeChip({ countText: "+" })), "unliked");
  assert.equal(parseLikeState(makeChip({ countText: "2" })), "liked");
});

test("labels match only expected controls", () => {
  assert.equal(isMoreLabel(" more "), true);
  assert.equal(isMoreLabel("more!"), false);
  assert.equal(isCloseLabel(" 閉じる "), true);
  assert.equal(isCloseLabel("more"), false);
});

test("own post detection normalizes whitespace", () => {
  assert.equal(normalizeDisplayName("  横田   順平 "), "横田 順平");
  assert.equal(isOwnPost("横田 順平", " 横田   順平 "), true);
  assert.equal(isOwnPost("中村 憲太朗", "横田 順平"), false);
});

test("discussion expansion skips liked and own posts", () => {
  assert.equal(shouldAutoExpandPost("unliked", "中村 憲太朗", "横田 順平"), true);
  assert.equal(shouldAutoExpandPost("unliked", "横田 順平", "横田 順平"), false);
  assert.equal(shouldAutoExpandPost("liked", "中村 憲太朗", "横田 順平"), false);
});

test("collapse is enabled only for liked posts", () => {
  assert.equal(shouldAutoCollapseOnLike("liked"), true);
  assert.equal(shouldAutoCollapseOnLike("unliked"), false);
});

test("notification title predicates distinguish preview and dedupe targets", () => {
  const mention = "横田さんがクラスであなたにメンションしました";
  const reaction = "横田さんがクラスであなたにリアクションしました";

  assert.equal(shouldPreviewNotificationTitle(mention), true);
  assert.equal(shouldPreviewNotificationTitle(reaction), false);
  assert.equal(shouldDedupeNotificationTitle(mention), true);
  assert.equal(shouldDedupeNotificationTitle(reaction), true);
});
