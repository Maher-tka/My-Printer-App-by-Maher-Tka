export const MAX_BACKGROUND_PIXELS = 16_000_000

export function parseBackgroundColor(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Choose a valid background color.')
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number
  ]
}

export function assertBackgroundDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new Error('The artwork has invalid image dimensions.')
  if (width * height > MAX_BACKGROUND_PIXELS)
    throw new Error(
      'Background editing supports images up to 16 megapixels. Import a smaller image to edit its background.'
    )
}

/** Removes only matching pixels connected to the image edge; enclosed details survive. */
export async function removeEdgeBackground(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  hex: string,
  tolerance: number,
  signal?: AbortSignal
): Promise<Uint8ClampedArray> {
  assertBackgroundDimensions(width, height)
  if (input.length !== width * height * 4) throw new Error('Invalid artwork pixel data.')
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 100)
    throw new Error('Tolerance must be between 0 and 100.')
  const color = parseBackgroundColor(hex)
  const threshold = tolerance * 2.55
  const pixels = new Uint8ClampedArray(input)
  const visited = new Uint8Array(width * height)
  const queue = new Uint32Array(width * height)
  let head = 0
  let tail = 0
  const enqueue = (index: number): void => {
    if (visited[index]) return
    visited[index] = 1
    const offset = index * 4
    if (
      pixels[offset + 3] !== 0 &&
      Math.max(
        Math.abs(pixels[offset] - color[0]),
        Math.abs(pixels[offset + 1] - color[1]),
        Math.abs(pixels[offset + 2] - color[2])
      ) > threshold
    )
      return
    queue[tail++] = index
  }
  signal?.throwIfAborted()
  for (let x = 0; x < width; x++) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width)
    enqueue(y * width + width - 1)
  }
  while (head < tail) {
    const index = queue[head++]
    pixels[index * 4 + 3] = 0
    const x = index % width
    if (x > 0) enqueue(index - 1)
    if (x < width - 1) enqueue(index + 1)
    if (index >= width) enqueue(index - width)
    if (index < width * (height - 1)) enqueue(index + width)
    if (head % 65536 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      signal?.throwIfAborted()
    }
  }
  return pixels
}

/** Composites a solid color behind transparency without moving or resizing artwork. */
export function addSolidBackground(input: Uint8ClampedArray, hex: string): Uint8ClampedArray {
  const color = parseBackgroundColor(hex)
  if (input.length % 4 !== 0) throw new Error('Invalid artwork pixel data.')
  const pixels = new Uint8ClampedArray(input)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3] / 255
    for (let channel = 0; channel < 3; channel++)
      pixels[offset + channel] = Math.round(
        pixels[offset + channel] * alpha + color[channel] * (1 - alpha)
      )
    pixels[offset + 3] = 255
  }
  return pixels
}
