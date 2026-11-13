/**
 * The class gauge in the bottom-centre status panel. The HUD calls
 * drawClassGauge(canvas, self, defs, t) every frame; `self.cr` carries the
 * class resource from the server ({ k, v, max, ... }). The canvas is 120×20
 * pixels (drawn at integer scale by CSS); draw pixel-crisp, no smoothing.
 */
export function drawClassGauge(cv, self, defs, t) {
  const g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
}
/** One line for the tooltip over the gauge. */
export function gaugeTip(self) { return ""; }
