import { SyncLane } from "../react-reconciler/ReactFiberLane";
import { internalPropsKey, NoTimestamp } from "./react-dom-types";
import createWorkInProgress from "./createWorkInProgress";

let currentEventTime = NoTimestamp;

export function getFiberCurrentPropsFromNode(node) {
  return node[internalPropsKey] || null;
}
export function requestEventTime() {
  //!在下一次进入React之前所以的updates时间不变
  if (currentEventTime !== NoTimestamp) {
    return currentEventTime;
  }
  //!第一次进入赋一个初始值
  currentEventTime = now();
  return currentEventTime;
}

export function requestUpdateLane(fiber) {
  return SyncLane;
}

export function now() {
  if (typeof performance === "object") {
    return performance.now();
  } else {
    return Date.now();
  }
}

//!只克隆了父节点下的第一层子节点 没有深度克隆
export function cloneChildFibers(current, workInProgress) {
  if (!(current === null || workInProgress.child === current.child)) {
    throw Error("Resuming work not yet implemented.");
  }
  //!如果child没有了 就不需要克隆了
  if (workInProgress.child === null) {
    return;
  }

  let currentChild = workInProgress.child;
  //!重新创建的workInProgress
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  workInProgress.child = newChild;
  newChild.return = workInProgress;

  //!循环构建父节点的子节点的兄弟节点
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps
    );
    newChild.return = workInProgress;
  }

  //!让最后一个兄弟节点的下一个兄弟节点指向null
  newChild.sibling = null;
}
