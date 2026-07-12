// Custom build: analytics disabled — mixpanel is never loaded and no usage
// data leaves the browser. recordEvent is kept as a no-op so callers work.
function recordEvent(name, props = {}) {}
