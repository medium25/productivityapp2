import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportToPdf(data, t) {
  const doc = new jsPDF()
  const marginX = 14

  doc.setFontSize(18)
  doc.text(data.title, marginX, 18)

  if (data.records.length === 0) {
    doc.setFontSize(11)
    doc.text(t('export.noData'), marginX, 30)
  } else {
    autoTable(doc, {
      startY: 26,
      body: data.records.map((r) => Object.values(r)),
      margin: { left: marginX },
    })
  }

  doc.save(`${data.id}-export.pdf`)
}
