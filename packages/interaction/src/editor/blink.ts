// Caret blink controller used by the editor overlay

export function createCaretBlinker(push: () => void) {
  let caretVisible = true
  let timer: number = 0

  function start() {
    stop()
    caretVisible = true
    timer = window.setInterval(() => {
      caretVisible = !caretVisible
      try {
        push()
      } catch {
        /* noop */
      }
    }, 500)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = 0
    }
    caretVisible = true
  }

  function isVisible() {
    return caretVisible
  }

  return { start, stop, isVisible }
}
