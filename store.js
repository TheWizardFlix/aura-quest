// store.js — the ONE persistence seam. Backend is injected (localStorage in the
// browser, a fake in tests, a server adapter in a future "Option B").
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Store = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const KEY = 'auraquest.save';
  const CORRUPT_KEY = 'auraquest.corrupt';

  function createStore(backend, core, nowDateStr) {
    function today() { return nowDateStr(); }

    function load() {
      const raw = backend.getItem(KEY);
      if (!raw) return core.freshState(today());
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        backend.setItem(CORRUPT_KEY, raw); // keep for manual recovery
        return core.freshState(today());
      }
      const rolled = core.rolloverIfNewDay(parsed, today());
      return rolled;
    }

    function save(state) {
      backend.setItem(KEY, JSON.stringify(state));
      return state;
    }

    function exportJSON(state) {
      return JSON.stringify(state, null, 2);
    }

    function importJSON(json) {
      const parsed = JSON.parse(json);
      save(parsed);
      return parsed;
    }

    return { load, save, exportJSON, importJSON };
  }

  return { createStore };
});
