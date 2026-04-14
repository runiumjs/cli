const MAX_FILENAME_LENGTH = 200;

/**
 * Converts a file path to a valid filename by replacing invalid characters
 * @param filePath
 * @param replacement
 */
export function convertPathToValidFileName(
  filePath: string,
  replacement: string = '-'
): string {
  let filename = filePath.trim();

  // replace path separators (both forward and backward slashes)
  filename = filename.replace(/^\/+/, '');
  filename = filename.replace(/[/\\]/g, replacement);

  // replace invalid filename characters
  // Windows: < > : " | ? * and control characters (0-31)
  // also replacing common problematic characters
  // eslint-disable-next-line no-control-regex
  filename = filename.replace(/[.<>:"|?*\x00-\x1F]/g, replacement);

  // remove leading/trailing dots and spaces (problematic on Windows)
  filename = filename.replace(/^[.\s]+|[.\s]+$/g, '');

  // replace multiple consecutive replacement characters with a single one
  const replacementRegex = new RegExp(
    `${replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}+`,
    'g'
  );
  filename = filename.replace(replacementRegex, replacement);

  if (filename.length > MAX_FILENAME_LENGTH) {
    filename = filename.substring(0, MAX_FILENAME_LENGTH);
  }

  return filename.toLowerCase();
}
