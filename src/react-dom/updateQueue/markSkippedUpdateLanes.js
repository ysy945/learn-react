import { mergeLanes } from "../../react-reconciler/ReactFiberLane";

export default function markSkippedUpdateLanes(lanes) {
  window.workInProgressRootSkippedLanes = mergeLanes(
    lanes,
    window.workInProgressRootSkippedLanes
  );
}
