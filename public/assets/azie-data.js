// Shared client for the generic per-app JSON state store (server/routes/data.js).
// Each tool keeps its own in-memory data model as before; this just persists
// that whole model to the database instead of (or alongside) localStorage.
(function () {
  const timers = {};

  async function load(appId) {
    const res = await fetch(`/api/data/${encodeURIComponent(appId)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'تعذر تحميل البيانات من الخادم');
    }
    const json = await res.json();
    return json.data && typeof json.data === 'object' ? json.data : {};
  }

  async function save(appId, data) {
    const res = await fetch(`/api/data/${encodeURIComponent(appId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'تعذر حفظ البيانات على الخادم');
    }
    return res.json();
  }

  // Coalesces rapid successive saves (e.g. several mutations in one user
  // action) into a single request instead of one per mutation.
  function debouncedSave(appId, getData, delay) {
    clearTimeout(timers[appId]);
    timers[appId] = setTimeout(() => {
      save(appId, getData()).catch((err) => {
        console.error(`AzieData: فشل حفظ بيانات ${appId}:`, err);
      });
    }, delay || 500);
  }

  window.AzieData = { load, save, debouncedSave };
})();
