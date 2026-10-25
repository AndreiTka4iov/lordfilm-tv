// Parse JSON data only. Never evaluate the scripts embedded in the source page.
export function documents(html: string): unknown[] {
  let payload = ''
  for (const match of html.matchAll(
    /self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g,
  )) {
    try {
      const row: unknown = JSON.parse(match[1] ?? '')
      if (Array.isArray(row) && row[0] === 1 && typeof row[1] === 'string')
        payload += row[1]
    } catch {
      // Other Flight chunks need not contain JSON data.
    }
  }
  const result: unknown[] = []
  const bytes = Buffer.from(payload)
  let offset = 0
  while (offset < bytes.length) {
    const colon = bytes.indexOf(':', offset)
    if (colon < 0) break
    const start = colon + 1
    if (bytes[start] === 84) {
      // Flight text records carry a byte length and may contain embedded newlines.
      const comma = bytes.indexOf(',', start)
      const hex = bytes.subarray(start + 1, comma).toString()
      if (comma < 0 || !/^[0-9a-f]+$/i.test(hex)) break
      offset = comma + 1 + Number.parseInt(hex, 16)
      continue
    }
    const end = bytes.indexOf('\n', start)
    if (end < 0) break
    try {
      result.push(JSON.parse(bytes.subarray(start, end).toString()))
    } catch {
      // Module references are not JSON records.
    }
    offset = end + 1
  }
  return result
}
