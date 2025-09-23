export type ColorScale = {
  50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string;
}

export type Theme = {
  primary?: ColorScale
  neutrals?: Partial<ColorScale>
  panelBg?: string
  panelBorder?: string
  text?: string
  textMuted?: string
}

/**
 * Apply theme by setting CSS variables on documentElement.
 * Call once at app start or whenever switching theme dynamically.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme.primary) {
    setScale(root, 'color-primary', theme.primary)
    // derive semantic tokens from primary 600/700/800
    root.style.setProperty('--primary', theme.primary[600])
    root.style.setProperty('--primary-hover', theme.primary[700])
    root.style.setProperty('--primary-active', theme.primary[800])
    root.style.setProperty('--on-primary', '#ffffff')
  }
  if (theme.neutrals) setScale(root, 'color-neutral', theme.neutrals as ColorScale)
  if (theme.panelBg) root.style.setProperty('--panel-bg', theme.panelBg)
  if (theme.panelBorder) root.style.setProperty('--panel-border', theme.panelBorder)
  if (theme.text) root.style.setProperty('--text', theme.text)
  if (theme.textMuted) root.style.setProperty('--text-muted', theme.textMuted)
}

function setScale(root: HTMLElement, prefix: string, scale: ColorScale) {
  const keys: ReadonlyArray<keyof ColorScale> = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
  keys.forEach((k) => {
    const v = scale[k]
    if (v) root.style.setProperty(`--${prefix}-${k}`, v)
  })
}
