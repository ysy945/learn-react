// eslint-disable-next-line no-unused-vars
let current = null;
let isRendering = false;

export function resetCurrentFiber() {
  current = null;
  isRendering = false;
}
export function setCurrentFiber(fiber) {
  current = fiber;
  isRendering = false;
}
export function setIsRendering(rendering) {
  isRendering = rendering;
}
export function getIsRendering() {
  return isRendering;
}
