import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export const MAX_NOTE_CHARACTERS = 50_000;

function getExtension(filename) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  const document = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map(item => (typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean)
        .join(' ')
        .trim();

      if (pageText) pages.push(pageText);
    }
  } finally {
    await document.destroy();
  }

  return pages.join('\n\n');
}

async function extractDocxText(file) {
  const mammoth = await import('mammoth/mammoth.browser.js');
  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });

  return result.value.trim();
}

async function extractFileText(file) {
  const extension = getExtension(file.name);

  if (extension === 'txt') return (await file.text()).trim();
  if (extension === 'pdf') return extractPdfText(file);
  if (extension === 'docx') return extractDocxText(file);

  throw new Error(`${file.name} is not a supported note format.`);
}

export async function extractNotesFromFiles(files) {
  const sections = [];

  for (const file of files) {
    let text;

    try {
      text = await extractFileText(file);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'could not be read';
      throw new Error(`Could not read ${file.name}: ${reason}`, { cause: error });
    }

    if (!text) {
      throw new Error(
        `${file.name} contains no readable text. Scanned PDFs need OCR before upload.`
      );
    }

    sections.push(`--- ${file.name} ---\n${text}`);
  }

  const notes = sections.join('\n\n').trim();
  if (notes.length > MAX_NOTE_CHARACTERS) {
    throw new Error(
      `The extracted notes contain ${notes.length.toLocaleString()} characters. `
      + `Reduce them to ${MAX_NOTE_CHARACTERS.toLocaleString()} characters or fewer.`
    );
  }

  return notes;
}
