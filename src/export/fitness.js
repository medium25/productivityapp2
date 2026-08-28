// Export helpers for the Fitness workout list: PDF (jspdf + jspdf-autotable),
// Word (docx), and Excel (xlsx / SheetJS). Each function takes the already
// filtered/sorted `workouts` array (shape: { type, date, durationMin,
// calories, notes }) plus the i18next `t` function so headers and workout
// type labels are translated, and triggers a browser download of the file.
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, HeadingLevel, Packer, Paragraph, Table, TableRow, TableCell, TextRun } from 'docx'
import * as XLSX from 'xlsx'

function buildColumns(t) {
  return [
    { key: 'type', label: t('fitness.table.type') },
    { key: 'date', label: t('fitness.table.date') },
    { key: 'duration', label: t('fitness.table.duration') },
    { key: 'calories', label: t('fitness.table.calories') },
    { key: 'notes', label: t('fitness.table.notes') },
  ]
}

function buildRows(workouts, t) {
  return workouts.map((workout) => [
    t(`fitness.types.${workout.type}`),
    workout.date || '',
    Number(workout.durationMin) || 0,
    Number(workout.calories) || 0,
    workout.notes || '',
  ])
}

// Triggers a browser download of `blob` as `filename` via a temporary
// object URL + anchor click (standard browser download pattern).
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportFitnessToPDF(workouts, t) {
  const columns = buildColumns(t)
  const rows = buildRows(workouts, t)

  const doc = new jsPDF()
  doc.text(t('fitness.heading'), 14, 15)
  autoTable(doc, {
    startY: 20,
    head: [columns.map((column) => column.label)],
    body: rows,
  })
  doc.save('fitness.pdf')
}

export function exportFitnessToWord(workouts, t) {
  const columns = buildColumns(t)
  const rows = buildRows(workouts, t)

  const makeCell = (text) =>
    new TableCell({ children: [new Paragraph({ children: [new TextRun(String(text))] })] })

  const headerRow = new TableRow({
    children: columns.map((column) => makeCell(column.label)),
  })
  const dataRows = rows.map((row) => new TableRow({ children: row.map((value) => makeCell(value)) }))

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: t('fitness.heading'), heading: HeadingLevel.HEADING_1 }),
          new Table({ rows: [headerRow, ...dataRows] }),
        ],
      },
    ],
  })

  Packer.toBlob(doc).then((blob) => {
    downloadBlob(blob, 'fitness.docx')
  })
}

export function exportFitnessToExcel(workouts, t) {
  const columns = buildColumns(t)
  const rows = buildRows(workouts, t)

  const aoa = [columns.map((column) => column.label), ...rows]
  const worksheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fitness')
  XLSX.writeFile(workbook, 'fitness.xlsx')
}
