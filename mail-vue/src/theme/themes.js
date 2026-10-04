// Product palettes → semantic roles. Components never branch on a theme name.
export const THEME_STORAGE_KEY = 'cloud-mail-appearance-v1'
export const themes = [
  { id: 'clay', name: 'Clay Letter', dark: false, description: 'warm paper · clay', colors: {
    nav: '#EEE7DF', work: '#F8F6F2', paper: '#FFFDFA', ink: '#332E29', muted: '#6E655D',
    accent: '#92543E', accentHover: '#794330', onAccent: '#FFFFFF', selected: '#DED0C1', selectedInk: '#51392D',
    line: '#D8CEC3', controlBorder: '#998B7C', identity: '#E7DDD2', hover: '#F0EAE2',
    success: '#4D6954', successSurface: '#EDF2EA', error: '#9E4039', errorSurface: '#FAEEEA',
    warning: '#805B20', warningSurface: '#F7EEDB', information: '#456579', scrim: '#29231DB3'
  }},
  { id: 'sage', name: 'Sage Garden', dark: false, description: 'natural paper · sage', colors: {
    nav: '#E9EADF', work: '#F7F7F0', paper: '#FFFDF7', ink: '#30332B', muted: '#626958',
    accent: '#536A45', accentHover: '#405536', onAccent: '#FFFFFF', selected: '#D5DEC9', selectedInk: '#35442D',
    line: '#D2D7C7', controlBorder: '#89927D', identity: '#E0E4D7', hover: '#ECEFE4',
    success: '#4D6954', successSurface: '#EDF2EA', error: '#99453A', errorSurface: '#FAEEE9',
    warning: '#7D602C', warningSurface: '#F7EEDB', information: '#496A75', scrim: '#252A20B3'
  }},
  { id: 'cocoa', name: 'Cocoa Night', dark: true, description: 'warm charcoal · copper', colors: {
    nav: '#29221E', work: '#201B18', paper: '#302824', ink: '#F1E7DD', muted: '#C0B1A5',
    accent: '#D59B80', accentHover: '#E5B49C', onAccent: '#251F1C', selected: '#4D3930', selectedInk: '#F5D3BF',
    line: '#56473D', controlBorder: '#A18A78', identity: '#483C33', hover: '#3A302A',
    success: '#B2C69E', successSurface: '#303B2B', error: '#E9A597', errorSurface: '#492E29',
    warning: '#DDBB7F', warningSurface: '#423626', information: '#B2C6CA', scrim: '#120E0BCC'
  }}
]
const cssRoles = { nav: 'surface-nav', work: 'surface-work', paper: 'surface-paper', ink: 'ink', muted: 'muted',
  accent: 'accent', accentHover: 'accent-hover', onAccent: 'on-accent', selected: 'surface-selected', selectedInk: 'selected-ink',
  line: 'line', controlBorder: 'control-border', identity: 'identity-bg', hover: 'surface-hover', success: 'success',
  successSurface: 'success-bg', error: 'error', errorSurface: 'error-bg', warning: 'warning', warningSurface: 'warning-bg',
  information: 'information', scrim: 'scrim' }
export function normalizeTheme(id) { return themes.some(theme => theme.id === id) ? id : 'clay' }
export function readTheme() {
  try { return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY)) } catch { return 'clay' }
}
export function applyTheme(id, persist = false) {
  const theme = themes.find(theme => theme.id === normalizeTheme(id))
  const root = document.documentElement
  // Hand off first-paint values to semantic roles. A concrete inline legacy
  // variable would otherwise freeze dialogs to the initial theme after switching.
  root.style.removeProperty('--el-bg-color')
  root.style.background = 'var(--letter-surface-work)'
  root.dataset.theme = theme.id
  root.classList.toggle('dark', theme.dark) // Compatibility for existing editors / charts.
  root.style.colorScheme = theme.dark ? 'dark' : 'light'
  Object.entries(theme.colors).forEach(([role, value]) => root.style.setProperty(`--letter-${cssRoles[role]}`, value))
  document.getElementById('theme-color-meta')?.setAttribute('content', theme.colors.work)
  if (persist) { try { localStorage.setItem(THEME_STORAGE_KEY, theme.id) } catch { /* session choice still works */ } }
  return theme.id
}
