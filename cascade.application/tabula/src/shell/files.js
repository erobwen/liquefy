// Files on the user's disk - through the browser: a file picker for
// opening, a download for saving.

// The file the user picks - its name and its text - or null if they pick
// none.
export function openFile(accept = ".json,application/json") {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      file.text().then((text) => resolve({ name: file.name, text }), reject);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function saveFile(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}
