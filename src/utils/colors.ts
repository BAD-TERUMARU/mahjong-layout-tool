export const CUSTOM_COLORS_KEY = 'mahjong-layout-tool:custom-colors-v1'

export const TEXT_COLOR_PALETTE = [
  '#172c27', '#c0392b', '#d98000', '#2d6a4f', '#1d5ea8', '#6246a8', '#7c3f56',
]

export const readCustomColors = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) ?? '[]') as unknown
    return Array.isArray(saved)
      ? saved.filter((value): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)).slice(0, 24)
      : []
  } catch {
    return []
  }
}

export const saveCustomColors = (colors: string[]) => {
  try {
    localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors.slice(-24)))
  } catch {
    // 保存に失敗しても、その時点のパレットは画面上で使えるようにする。
  }
}
