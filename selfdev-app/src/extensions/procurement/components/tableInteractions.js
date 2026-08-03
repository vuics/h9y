export function shouldOpenTableRow(event, selection = window.getSelection()) {
  if (event.target.closest('a, button, input, select, textarea, [role="button"]')) return false
  if (selection && !selection.isCollapsed && selection.toString().trim()) return false
  return true
}
