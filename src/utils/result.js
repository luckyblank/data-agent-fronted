export function getColumns(rows) {
  return [...new Set(rows.flatMap(row => Object.keys(row || {})))]
}

export function numericValue(value) {
  if (value == null || typeof value === 'boolean') return null
  if (typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function numericColumns(rows, columns = getColumns(rows)) {
  return columns.filter(column => {
    const values = rows.map(row => row[column]).filter(value => value != null && value !== '')
    return values.length > 0 && values.every(value => numericValue(value) !== null)
  })
}

export function formatCell(value) {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
}

export function createCsv(rows, columns = getColumns(rows)) {
  const escape = value => {
    let text = value == null ? '' : formatCell(value)
    // Prevent text cells from being interpreted as spreadsheet formulas.
    if (numericValue(value) === null && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return '\uFEFF' + [columns.map(escape).join(','), ...rows.map(row => columns.map(column => escape(row[column])).join(','))].join('\r\n')
}
