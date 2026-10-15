import * as XLSX from 'xlsx'

export function exportToExcel(data, t) {
  const rows = data.records.length
    ? data.records.map((r) => Object.values(r))
    : [[t('export.noData')]]

  const sheet = XLSX.utils.aoa_to_sheet([[data.title], [], ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, data.title.slice(0, 31))
  XLSX.writeFile(wb, `${data.id}-export.xlsx`)
}
