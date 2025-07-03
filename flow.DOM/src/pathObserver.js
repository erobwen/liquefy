// pathObserver.js
export function observePathChange(callback) {
  let currentPath = window.location.pathname;

  const notify = () => {
    const newPath = window.location.pathname;
    if (newPath !== currentPath) {
      currentPath = newPath;
      callback(newPath);
    }
  };

  // Patch pushState
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    notify();
  };

  // Patch replaceState
  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    notify();
  };

  // Listen to popstate (back/forward)
  window.addEventListener('popstate', () => {
    notify();
  });

  // Optional: Immediately invoke callback with current path
  callback(currentPath);

  // Return a cleanup function to restore original behavior
  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', notify);
  };
}