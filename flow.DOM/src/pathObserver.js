// pathObserver.js
export function observePathChange(callback) {
  let currentPath = window.location.pathname;

  const notify = () => {
    const newPath = window.location.pathname;
    console.log("notify..." + newPath)
    console.log("current" + currentPath)
    if (newPath !== currentPath) {
      console.log("different");
      currentPath = newPath;
      callback(newPath);
    }
  };

  // Patch pushState
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    console.log("pushstate...");
    originalPushState.apply(this, args);
    notify();
  };

  // Patch replaceState
  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    console.log("replace state...");
    originalReplaceState.apply(this, args);
    notify();
  };

  // Listen to popstate (back/forward)
  window.addEventListener('popstate', () => {
    console.log("popstate...");
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