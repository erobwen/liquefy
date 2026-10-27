/**
 * PDF.js (Mozilla's pdfjs-dist), as the PDF plugin uses it: loaded the first
 * time a PDF is shown - never by what only saves or loads one, nor in the
 * tests - its worker found by Vite (`?url`).
 *
 * A PDF's document - PDF.js's own object - is kept here, by the model it's
 * the PDF of, never in a component's properties or state: those are
 * observable, and PDF.js's objects, with private fields of their own, don't
 * work through a proxy. Read again when the model's `data` changes.
 */
let library = null;

export function pdfjs() {
  if (!library) {
    library = Promise.all([
      import("pdfjs-dist/build/pdf.min.mjs"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdf, worker]) => {
      pdf.GlobalWorkerOptions.workerSrc = worker.default;
      return pdf;
    });
  }
  return library;
}

const documents = new WeakMap();

// The PDF.js document of a PDF model - `{ data }`, its bytes in base64 -
// read once for each `data` it has.
export function pdfDocument(model) {
  const data = model.data;
  const cached = documents.get(model);
  if (cached && cached.data === data) return cached.promise;
  if (cached) cached.promise.then((document) => document.destroy()).catch(() => {});
  const promise = pdfjs().then((pdf) => pdf.getDocument({ data: bytesOf(data) }).promise);
  documents.set(model, { data, promise });
  return promise;
}

// The sizes of its pages, in points (1/72 inch), rotation included -
// [{ width, height }].
export async function pageSizes(model) {
  const document = await pdfDocument(model);
  const sizes = [];
  for (let number = 1; number <= document.numPages; number++) {
    const viewport = (await document.getPage(number)).getViewport({ scale: 1 });
    sizes.push({ width: viewport.width, height: viewport.height });
  }
  return sizes;
}

// Page `number` (from 1) drawn onto `canvas`, `scale` canvas pixels to a
// point - what was being drawn there before stopped. Resolves when it's
// drawn; a drawing cut short by another resolves too.
export async function drawPage(model, number, canvas, scale) {
  const document = await pdfDocument(model);
  const page = await document.getPage(number);
  const viewport = page.getViewport({ scale });
  if (canvas.pdfTask) canvas.pdfTask.cancel();
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const task = page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport });
  canvas.pdfTask = task;
  try {
    await task.promise;
  } catch (error) {
    if (error && error.name !== "RenderingCancelledException") throw error;
  } finally {
    if (canvas.pdfTask === task) canvas.pdfTask = null;
  }
}

// Base64, as saved, to the bytes PDF.js reads.
export function bytesOf(base64) {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index);
  return bytes;
}

// A file the user picks - a PDF - as { name, data }, data its bytes in
// base64; null if they pick none.
export function choosePdf() {
  return new Promise((resolve, reject) => {
    const input = globalThis.document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: String(reader.result).replace(/^data:[^,]*,/, "") });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
