export const responseAttachmentLimits = { maxFiles: 5, maxFileBytes: 10 * 1024 * 1024, maxTotalBytes: 20 * 1024 * 1024 }

export function validateResponseInput(text, files) {
  if (!text.trim() && files.length === 0) return 'Добавьте текст ответа или хотя бы одно вложение.'
  if (files.length > responseAttachmentLimits.maxFiles) return `Можно загрузить не более ${responseAttachmentLimits.maxFiles} файлов.`
  if (files.some(file => file.size > responseAttachmentLimits.maxFileBytes)) return 'Размер одного файла не должен превышать 10 МБ.'
  if (files.reduce((total, file) => total + file.size, 0) > responseAttachmentLimits.maxTotalBytes) return 'Общий размер вложений не должен превышать 20 МБ.'
  return null
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл.'))
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1])
    reader.readAsDataURL(file)
  })
}

export async function responseFilesPayload(files) {
  return Promise.all(files.map(async file => ({
    filename: file.name,
    content_type: file.type || null,
    data_base64: await fileToBase64(file),
  })))
}

export function downloadBlob({ blob, filename }) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
