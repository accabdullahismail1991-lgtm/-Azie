// Shared client for per-screen permissions (server/routes/auth.js /screens/:appId).
// Each tool has its own tab/page-switching function with a different name
// and different nav markup, so this only provides small reusable primitives
// that each tool's own integration code composes: fetch the allowed set,
// hide nav items not in it, and wrap the existing switch-function so a
// blocked screen can't be reached even by a direct/programmatic call.
(function () {
  async function fetchAllowed(appId) {
    const res = await fetch(`/api/auth/screens/${encodeURIComponent(appId)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'تعذر تحميل صلاحيات الشاشات');
    }
    const json = await res.json();
    return Array.isArray(json.screens) ? json.screens : [];
  }

  // navItems: [{ key: 'vehicles', elements: [domNode, ...] }, ...]
  // Hides (display:none) the nav elements for any screen key not in `allowed`.
  function hideDisallowedNav(navItems, allowed) {
    const allowedSet = new Set(allowed);
    navItems.forEach(({ key, elements }) => {
      if (allowedSet.has(key)) return;
      (elements || []).forEach((el) => {
        if (el) el.style.display = 'none';
      });
    });
  }

  // Wraps an app's existing switch-to-screen function so navigating to a
  // screen key outside `allowed` is blocked, regardless of what triggered
  // the call (nav click, keyboard shortcut, default-tab-on-load, ...).
  function guardNavigate(originalFn, allowed, options) {
    const allowedSet = new Set(allowed);
    const opts = options || {};
    return function guarded(screenKey, ...args) {
      if (allowedSet.has(screenKey)) {
        return originalFn.call(this, screenKey, ...args);
      }
      if (typeof opts.onBlocked === 'function') {
        opts.onBlocked(screenKey);
      }
      const fallback = opts.fallback || allowed[0];
      if (fallback && fallback !== screenKey) {
        return originalFn.call(this, fallback, ...args);
      }
      return undefined;
    };
  }

  function renderNoAccess(container, appTitle) {
    if (!container) return;
    container.innerHTML = `
      <div style="padding:60px 24px;text-align:center;color:#93A0B4;font-family:'Cairo','Tajawal',sans-serif;">
        <div style="font-size:40px;margin-bottom:16px;">🔒</div>
        <div style="font-size:16px;font-weight:700;color:#E9ECF2;margin-bottom:8px;">لا توجد شاشات متاحة لك</div>
        <div style="font-size:13px;">ليست لديك صلاحية على أي شاشة داخل ${appTitle || 'هذا التطبيق'} حالياً. تواصل مع مدير المنصة لمنحك الصلاحية اللازمة.</div>
      </div>`;
  }

  window.AzieScreens = { fetchAllowed, hideDisallowedNav, guardNavigate, renderNoAccess };
})();
