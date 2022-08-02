import reconcileChildFibers from "./reconcileChildFibers";
export default function mountChildFibers(
  returnFiber,
  currentFirstChild,
  newChild,
  lanes,
  shouldTrackSideEffects
) {
  return reconcileChildFibers(
    returnFiber,
    currentFirstChild,
    newChild,
    lanes,
    shouldTrackSideEffects
  );
}
