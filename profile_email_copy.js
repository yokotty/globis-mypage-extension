(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GlobisProfileEmailCopy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EMAIL_LABEL_TARGETS = new Set(["mail", "alumniMail", "mailSpare"]);

  function isEmailText(text) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((text || "").trim());
  }

  function isProfileModalRoot(modal) {
    if (!modal || typeof modal.querySelector !== "function") return false;
    const title = modal.querySelector("h2");
    return Boolean(title && title.textContent.includes("プロフィール"));
  }

  function getProfileModalRoots(root) {
    const candidates = [];
    if (root && typeof root.matches === "function" && root.matches('[id="base-modal"]')) {
      candidates.push(root);
    }
    if (root && typeof root.querySelectorAll === "function") {
      candidates.push(...Array.from(root.querySelectorAll('[id="base-modal"]')));
    }
    return candidates.filter(isProfileModalRoot);
  }

  function isProfileEmailLabel(label) {
    if (!label) return false;
    const target = typeof label.getAttribute === "function"
      ? label.getAttribute("for") || ""
      : "";
    return EMAIL_LABEL_TARGETS.has(target) ||
      String(label.textContent || "").includes("メールアドレス");
  }

  function getProfileEmailRows(root) {
    return getProfileModalRoots(root)
      .flatMap((modal) => {
        const labels = Array.from(modal.querySelectorAll("label")).filter(isProfileEmailLabel);

        return labels.map((label) => {
          let row = label.parentElement;
          for (let depth = 0; row && depth < 5; depth += 1, row = row.parentElement) {
            const emailEl = row.querySelector("span.text-\\[13px\\]");
            if (emailEl && isEmailText(emailEl.textContent)) {
              return { row, label, emailEl };
            }
          }
          return null;
        });
      })
      .filter(Boolean);
  }

  return {
    isEmailText,
    isProfileModalRoot,
    getProfileModalRoots,
    isProfileEmailLabel,
    getProfileEmailRows
  };
});
