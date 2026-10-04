import {onBeforeUnmount} from 'vue'

// Lifecycle-bound, enter-only page motion. KeepAlive owns caching and list restoration.
// No timers postpone routing; an interrupted animation settles Vue immediately.
export function useLetterMotion(route, {duration, focusTarget} = {}) {
  const animations = new Map()
  let lastListFocus = null
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  function cancel(el) { animations.get(el)?.cancel(); animations.delete(el) }
  function cancelAll() { for (const el of animations.keys()) cancel(el) }
  const handleReduced = () => { if (reduced.matches) cancelAll() }
  reduced.addEventListener('change', handleReduced)
  onBeforeUnmount(() => { cancelAll(); reduced.removeEventListener('change', handleReduced) })
  function enter(el, done) {
    cancelAll()
    const startingFocus = document.activeElement
    const focusView = () => {
      if (!el.isConnected || (document.activeElement !== startingFocus && document.activeElement !== document.body)) return
      const target = focusTarget ? focusTarget(el) : el.matches('.letter-reader') ? el.querySelector('.reader-back')
        : lastListFocus?.isConnected && el.contains(lastListFocus) ? lastListFocus : null
      target?.focus({preventScroll: true})
    }
    if (reduced.matches || !el.animate) { focusView(); done(); return }
    const reader = route.meta.name === 'content'
    const returning = route.meta.name === 'email'
    const animation = el.animate(reader
      ? [{transform: 'translateX(12px)', clipPath: 'inset(0 0 0 1.5%)'}, {transform: 'none', clipPath: 'inset(0)'}]
      : [{transform: `translateX(${returning ? -12 : 10}px)`}, {transform: 'none'}],
      {duration: (typeof duration === 'function' ? duration(el) : duration) ?? (returning ? 240 : 280), easing: 'cubic-bezier(.2,.7,.2,1)'})
    animations.set(el, animation)
    const settle = () => { if (animations.get(el) === animation) animations.delete(el); done() }
    animation.finished.then(() => { focusView(); settle() }, settle)
  }
  function leave(el, done) {
    if (el.matches('.letter-mail-list') && el.contains(document.activeElement)) lastListFocus = document.activeElement
    cancel(el); done()
  }
  return {enter, leave, cancel}
}
