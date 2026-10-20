export function exportMarkdown(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

export function exportPlainText(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n';
}
