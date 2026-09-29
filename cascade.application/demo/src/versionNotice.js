// A notice for the demo as deployed to GitHub Pages: that site is built from
// main, which runs ahead of the packages released on npm - so the code the
// pages show may not match any installed version. The notice tells how to
// run the demo of a released version instead.
//
// Plain DOM, outside the app: it sits above #application, which the app
// fills (its root measures #application, so it adapts when the notice goes).

const deployedAt = { origin: "https://erobwen.github.io", path: "/liquefy/cascade/" };
const dismissedKey = "cascade-demo-version-notice-dismissed";

// ?version-notice shows it anywhere - to see what it looks like locally.
function isDeployedDemo() {
  const { origin, pathname, search } = window.location;
  if (new URLSearchParams(search).has("version-notice")) return true;
  return origin === deployedAt.origin && pathname.startsWith(deployedAt.path);
}

function wasDismissed() {
  try { return sessionStorage.getItem(dismissedKey) === "true"; } catch { return false; }
}

function rememberDismissed() {
  try { sessionStorage.setItem(dismissedKey, "true"); } catch { /* not remembered, then */ }
}

export function showVersionNotice(application) {
  if (!isDeployedDemo() || wasDismissed()) return;

  // The notice and the app share the body's height: the app takes the rest.
  Object.assign(document.body.style, { display: "flex", flexDirection: "column" });
  Object.assign(application.style, { height: "auto", flex: "1 1 auto", minHeight: "0" });

  const notice = document.createElement("div");
  notice.setAttribute("role", "note");
  Object.assign(notice.style, {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "10px 16px",
    background: "#fff4ce",
    color: "#4d3b00",
    borderBottom: "1px solid #e6c65c",
    fontSize: "14px",
    lineHeight: "1.4",
  });

  const code = (text) => `<code style="background:#ffe9a3; padding:1px 4px; border-radius:3px">${text}</code>`;
  const message = document.createElement("div");
  message.style.flex = "1 1 auto";
  message.innerHTML = `
    <strong>&#9888; This demo follows the latest development version.</strong>
    The implementation details shown here may not correspond to any specific
    installation of the npm packages. To see the demo for the version you
    have installed, download that release (its
    <a href="https://github.com/erobwen/liquefy/tags" style="color:inherit">tag</a>
    is ${code("v&lt;version&gt;")}), install it all, and run the demo locally:
    ${code("git clone --branch v&lt;version&gt; https://github.com/erobwen/liquefy.git")}
    &rarr; ${code("cd liquefy")} &rarr; ${code("npm install")}
    &rarr; ${code("cd cascade.application/demo")} &rarr; ${code("npm start")}
  `;

  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";
  Object.assign(close.style, {
    flex: "0 0 auto",
    border: "none",
    background: "none",
    color: "inherit",
    fontSize: "20px",
    lineHeight: "1",
    cursor: "pointer",
    padding: "0 4px",
  });
  close.addEventListener("click", () => {
    rememberDismissed();
    notice.remove();
  });

  notice.append(message, close);
  application.before(notice);
}
