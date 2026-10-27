// Files on the user's disk - through the browser. Where it can (the File
// System Access API: Chrome, Edge), a file opened is kept hold of - its
// handle - and saving writes it back there, without asking; "Save as" asks
// where. Where it can't, a file picker for opening and a download for
// saving, every time.

const jsonFiles = [{ description: "Tabula documents", accept: { "application/json": [".json"] } }];

const canPick = () => typeof(window) !== "undefined" && typeof(window.showOpenFilePicker) === "function";
const cancelled = (error) => error && error.name === "AbortError";

// The file the user picks - { name, text, handle } (handle null where
// there's none to keep) - or null if they pick none.
export async function openFile(accept = ".json,application/json") {
  if (canPick()) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: jsonFiles });
      const file = await handle.getFile();
      return { name: file.name, text: await file.text(), handle };
    } catch (error) {
      if (cancelled(error)) return null;
      throw error;
    }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      file.text().then((text) => resolve({ name: file.name, text, handle: null }), reject);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// `text` saved - to `handle`, the file it came from, if there is one and
// it's not to go elsewhere (`as`); else where the user says, `name`
// suggested. { name, handle } where it went - or null if they said nowhere.
// Without the API: downloaded, as `name`.
export async function saveFile({ name, text, handle = null, as = false }) {
  if (handle && !as) {
    await write(handle, text);
    return { name: handle.name, handle };
  }
  if (typeof(window) !== "undefined" && typeof(window.showSaveFilePicker) === "function") {
    try {
      const chosen = await window.showSaveFilePicker({ suggestedName: name, types: jsonFiles });
      await write(chosen, text);
      return { name: chosen.name, handle: chosen };
    } catch (error) {
      if (cancelled(error)) return null;
      throw error;
    }
  }
  download(name, text);
  return { name, handle: null };
}

async function write(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

function download(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}
