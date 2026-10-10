import { createWorker } from 'tesseract.js';

/** Reads English and Turkish text from a picture on this device. Throws when no text is found. */
export async function readImageText(file: File): Promise<string> {
  const worker = await createWorker('eng+tur');
  try {
    const { data } = await worker.recognize(file);
    const text = data.text.trim();
    if (!text) throw new Error('No text found');
    return text;
  } finally { await worker.terminate(); }
}
