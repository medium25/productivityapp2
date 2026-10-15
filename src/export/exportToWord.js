import { Document, Packer, Paragraph, HeadingLevel } from 'docx'
import { saveAs } from './fileSaver'

export async function exportToWord(data, t) {
  const children = [new Paragraph({ text: data.title, heading: HeadingLevel.TITLE })]

  if (data.records.length === 0) {
    children.push(new Paragraph({ text: t('export.noData') }))
  } else {
    data.records.forEach((r) => {
      children.push(new Paragraph({ text: Object.values(r).join(' — ') }))
    })
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${data.id}-export.docx`)
}
