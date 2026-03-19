import mammoth from "mammoth";

/**
 * Parse a .docx file buffer into plain text using mammoth.
 * Returns the full text content with paragraphs preserved.
 * Throws if the extraction produces empty output.
 */
export async function parseDocxToText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages.length > 0) {
    const warnings = result.messages
      .filter((m) => m.type === "warning")
      .map((m) => m.message);
    if (warnings.length > 0) {
      console.warn("Mammoth warnings:", warnings);
    }
  }

  const text = result.value.trim();
  if (!text) {
    throw new Error("Docx file produced empty text extraction");
  }

  return text;
}
