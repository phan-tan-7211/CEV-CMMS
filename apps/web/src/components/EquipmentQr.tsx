import './EquipmentQr.css'

type Props = {
  value: string
  size?: number
  className?: string
  label?: string
}

const QR_SIZE = 21
const DATA_CODEWORDS = 19
const ECC_CODEWORDS = 7

function gfMultiply(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    if (((y >>> i) & 1) !== 0) z ^= x
  }
  return z
}

function gfPow2(power: number) {
  let value = 1
  for (let i = 0; i < power; i += 1) value = gfMultiply(value, 2)
  return value
}

function generatorPolynomial(degree: number) {
  let result = [1]
  for (let i = 0; i < degree; i += 1) {
    const factor = [1, gfPow2(i)]
    const next = Array(result.length + 1).fill(0) as number[]
    result.forEach((a, ai) => factor.forEach((b, bi) => { next[ai + bi] ^= gfMultiply(a, b) }))
    result = next
  }
  return result
}

function errorCorrection(data: number[]) {
  const generator = generatorPolynomial(ECC_CODEWORDS)
  const remainder = Array(ECC_CODEWORDS).fill(0) as number[]
  for (const byte of data) {
    const factor = byte ^ remainder[0]
    remainder.shift()
    remainder.push(0)
    for (let i = 0; i < ECC_CODEWORDS; i += 1) remainder[i] ^= gfMultiply(generator[i + 1], factor)
  }
  return remainder
}

function appendBits(target: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) target.push((value >>> i) & 1)
}

function encodeData(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value))
  if (bytes.length > 17) throw new Error('QR_VALUE_TOO_LONG')
  const bits: number[] = []
  appendBits(bits, 0b0100, 4)
  appendBits(bits, bytes.length, 8)
  bytes.forEach((byte) => appendBits(bits, byte, 8))
  const capacity = DATA_CODEWORDS * 8
  for (let i = 0; i < Math.min(4, capacity - bits.length); i += 1) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, bit) => (n << 1) | bit, 0))
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11)
  return [...data, ...errorCorrection(data)]
}

type Matrix = Array<Array<boolean | null>>

function emptyMatrix(): Matrix {
  return Array.from({ length: QR_SIZE }, () => Array<boolean | null>(QR_SIZE).fill(null))
}

function setFinder(matrix: Matrix, top: number, left: number) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const y = top + r
      const x = left + c
      if (y < 0 || x < 0 || y >= QR_SIZE || x >= QR_SIZE) continue
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6
      const dark = inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
      matrix[y][x] = dark
    }
  }
}

function formatBits(mask: number) {
  const data = (1 << 3) | mask
  let remainder = data << 10
  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((remainder >>> bit) & 1) !== 0) remainder ^= 0x537 << (bit - 10)
  }
  return ((data << 10) | remainder) ^ 0x5412
}

function writeFormat(matrix: Matrix, mask: number) {
  const bits = formatBits(mask)
  const bit = (index: number) => ((bits >>> index) & 1) !== 0
  for (let i = 0; i <= 5; i += 1) matrix[i][8] = bit(i)
  matrix[7][8] = bit(6)
  matrix[8][8] = bit(7)
  matrix[8][7] = bit(8)
  for (let i = 9; i < 15; i += 1) matrix[8][14 - i] = bit(i)
  for (let i = 0; i < 8; i += 1) matrix[8][QR_SIZE - 1 - i] = bit(i)
  for (let i = 8; i < 15; i += 1) matrix[QR_SIZE - 15 + i][8] = bit(i)
  matrix[QR_SIZE - 8][8] = true
}

function baseMatrix(mask: number) {
  const matrix = emptyMatrix()
  setFinder(matrix, 0, 0)
  setFinder(matrix, 0, QR_SIZE - 7)
  setFinder(matrix, QR_SIZE - 7, 0)
  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    matrix[6][i] = i % 2 === 0
    matrix[i][6] = i % 2 === 0
  }
  writeFormat(matrix, mask)
  return matrix
}

function maskBit(mask: number, row: number, col: number) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0
    case 1: return row % 2 === 0
    case 2: return col % 3 === 0
    case 3: return (row + col) % 3 === 0
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0
  }
}

function placeCodewords(matrix: Matrix, codewords: number[], mask: number) {
  const bits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1))
  let index = 0
  let upward = true
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1
    for (let step = 0; step < QR_SIZE; step += 1) {
      const row = upward ? QR_SIZE - 1 - step : step
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset
        if (matrix[row][col] !== null) continue
        const raw = index < bits.length ? bits[index] === 1 : false
        matrix[row][col] = raw !== maskBit(mask, row, col)
        index += 1
      }
    }
    upward = !upward
  }
}

function penalty(matrix: Matrix) {
  const dark = (r: number, c: number) => matrix[r][c] === true
  let score = 0
  for (let axis = 0; axis < 2; axis += 1) {
    for (let line = 0; line < QR_SIZE; line += 1) {
      let runColor = false
      let runLength = 0
      for (let pos = 0; pos < QR_SIZE; pos += 1) {
        const color = axis === 0 ? dark(line, pos) : dark(pos, line)
        if (pos === 0 || color !== runColor) { runColor = color; runLength = 1 } else {
          runLength += 1
          if (runLength === 5) score += 3
          else if (runLength > 5) score += 1
        }
      }
    }
  }
  for (let r = 0; r < QR_SIZE - 1; r += 1) for (let c = 0; c < QR_SIZE - 1; c += 1) {
    const color = dark(r, c)
    if (dark(r, c + 1) === color && dark(r + 1, c) === color && dark(r + 1, c + 1) === color) score += 3
  }
  const pattern = [true, false, true, true, true, false, true]
  for (let axis = 0; axis < 2; axis += 1) for (let line = 0; line < QR_SIZE; line += 1) for (let start = 0; start <= QR_SIZE - 7; start += 1) {
    const matches = pattern.every((color, i) => (axis === 0 ? dark(line, start + i) : dark(start + i, line)) === color)
    if (!matches) continue
    const before = start >= 4 && [1, 2, 3, 4].every((i) => !(axis === 0 ? dark(line, start - i) : dark(start - i, line)))
    const after = start + 10 < QR_SIZE && [7, 8, 9, 10].every((i) => !(axis === 0 ? dark(line, start + i) : dark(start + i, line)))
    if (before || after) score += 40
  }
  const darkCount = matrix.flat().filter(Boolean).length
  score += Math.floor(Math.abs(darkCount * 20 - QR_SIZE * QR_SIZE * 10) / (QR_SIZE * QR_SIZE)) * 10
  return score
}

export function equipmentQrMatrix(value: string) {
  const codewords = encodeData(value)
  let best: boolean[][] | null = null
  let bestPenalty = Number.POSITIVE_INFINITY
  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = baseMatrix(mask)
    placeCodewords(matrix, codewords, mask)
    const score = penalty(matrix)
    if (score < bestPenalty) {
      bestPenalty = score
      best = matrix.map((row) => row.map(Boolean))
    }
  }
  return best || []
}

export function EquipmentQr({ value, size = 112, className = '', label }: Props) {
  const normalized = value.trim()
  if (!normalized) return null
  const matrix = equipmentQrMatrix(normalized)
  const quiet = 4
  const viewSize = QR_SIZE + quiet * 2
  return <figure className={`equipment-qr ${className}`.trim()} aria-label={`Mã QR ${normalized}`}>
    <svg width={size} height={size} viewBox={`0 0 ${viewSize} ${viewSize}`} role="img" aria-label={`QR ${normalized}`} shapeRendering="crispEdges">
      <rect width={viewSize} height={viewSize} fill="white" />
      {matrix.map((row, y) => row.map((dark, x) => dark ? <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width="1" height="1" fill="black" /> : null))}
    </svg>
    {label !== '' ? <figcaption>{label || normalized}</figcaption> : null}
  </figure>
}
