const encoder = new TextEncoder()

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(value: number) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
}

function u32(value: number) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, item) => sum + item.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const item of parts) {
    output.set(item, offset)
    offset += item.length
  }
  return output
}

function dosDateTime(date: Date) {
  const year = Math.max(date.getFullYear(), 1980)
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosTime, dosDate }
}

export type ZipEntry = { name: string; data: Uint8Array | string }

export function createStoredZip(entries: ZipEntry[], modifiedAt = new Date()) {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0
  const { dosTime, dosDate } = dosDateTime(modifiedAt)

  for (const entry of entries) {
    const name = encoder.encode(entry.name.replaceAll('\\', '/'))
    const data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data
    const checksum = crc32(data)
    const localHeader = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
      u32(checksum), u32(data.length), u32(data.length), u16(name.length), u16(0), name,
    ])
    localParts.push(localHeader, data)

    const centralHeader = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate),
      u32(checksum), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0),
      u16(0), u32(0), u32(localOffset), name,
    ])
    centralParts.push(centralHeader)
    localOffset += localHeader.length + data.length
  }

  const central = concat(centralParts)
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(localOffset), u16(0),
  ])
  return concat([...localParts, central, end])
}

export async function sha256Hex(data: Uint8Array | string) {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', source)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
