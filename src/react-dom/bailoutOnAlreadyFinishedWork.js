import { includesSomeLane } from "../react-reconciler/ReactFiberLane";
import { cloneChildFibers } from "./fiberUtils";
import markSkippedUpdateLanes from "./updateQueue/markSkippedUpdateLanes";
//!复用节点的函数
export default function bailoutOnAlreadyFinishedWork(
  current,
  workInProgress,
  renderLanes
) {
  if (current !== null) {
    workInProgress.dependencies = current.dependencies;
  }

  //!标记跳过的lanes
  markSkippedUpdateLanes(workInProgress.lanes);
  //!如果子fiber没有childLanes了 表示不需要渲染了 跳过即可
  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    return null;
  }
  //!当前fiber不需要在工作了 但是子树fiber需要 克隆这个childFiber并且继续
  else {
    //!深克隆第一层子节点
    cloneChildFibers(current, workInProgress);
    return workInProgress.child;
  }
}
