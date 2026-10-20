export function exportMarkdown(content: string): string {
  return content.trim() + '\n';
}
export function exportPlainText(content: string): string {
  return content.replace(/[#*_`]/g, '').trim() + '\n';
}
