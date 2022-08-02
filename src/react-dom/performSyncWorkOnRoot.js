import { getNextLanes, NoLanes } from "../react-reconciler/ReactFiberLane";
import createWorkInProgress from "./createWorkInProgress";
import {
  getExecutionContext,
  setExecutionContext,
} from "./legacyRenderSubtreeIntoContainer";
import {
  RenderContext,
  RootCompleted,
  RootIncomplete,
} from "./react-dom-types";
import { resetCurrentFiber, setCurrentFiber } from "./currentFiber";
import beginWork from "./beginWork";
import completeUnitOfWork from "./completeUnitOfWork";
import commitRoot from "./commitRoot";
import { now } from "./fiberUtils";
import ensureRootIsScheduled from "./ensureRootIsScheduled";
import flushPassiveEffects from "./hooks/flushPassiveEffects";

export default function performSyncWorkOnRoot(root) {
  flushPassiveEffects();
  let lanes;
  let exitStatus;
  //!计算出fiberRootNode当前最高的优先级车道
  lanes = getNextLanes(root, NoLanes);
  //!开始render阶段 beginWork complete
  exitStatus = renderRootSync(root, lanes);
  if (exitStatus === RootCompleted) {
    //TODO commit阶段
    debugger;
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork; //!记录构建完成的workInProgress
    root.finishedLanes = lanes; //!记录完成的优先级
    commitRoot(root); //!进入commit阶段
    ensureRootIsScheduled(root, now()); //!确保所有调度都完成了否则继续调度
  }
  return null;
}

function renderRootSync(root, lanes) {
  const prevExecutionContext = getExecutionContext();
  setExecutionContext(prevExecutionContext | RenderContext);

  prepareFreshStack(root, lanes);

  do {
    try {
      workLoopSync();
      break;
    } catch (thrownValue) {
      throw Error(thrownValue);
    }
  } while (true);
  setExecutionContext(prevExecutionContext);

  window.workInProgressRoot = null;
  window.workInProgressRootRenderLanes = NoLanes;
  return window.workInProgressRootExitStatus; //!返回当前状态正常退出应该是RootCompleted
}

window.workInProgress = null;
window.workInProgressRoot = null;
window.workInProgressRootRenderLanes = NoLanes;
window.workInProgressRootExitStatus = RootIncomplete;
window.workInProgressRootSkippedLanes = NoLanes;
window.workInProgressRootUpdatedLanes = NoLanes;
window.workInProgressRootPingedLanes = NoLanes;
window.subtreeRenderLanes = NoLanes;
window.workInProgressRootIncludedLanes = NoLanes;

//!初始化workInProgress
function prepareFreshStack(root, lanes) {
  root.finishedWork = null;
  root.finishedLanes = NoLanes;
  window.workInProgressRoot = root;
  window.workInProgress = createWorkInProgress(root.current, null);
  //!本次的渲染车道
  window.workInProgressRootRenderLanes =
    window.subtreeRenderLanes =
    window.workInProgressRootIncludedLanes =
      lanes;
  window.workInProgressRootExitStatus = RootIncomplete;
  window.workInProgressRootSkippedLanes = NoLanes;
  window.workInProgressRootUpdatedLanes = NoLanes;
  window.workInProgressRootPingedLanes = NoLanes;
}

function workLoopSync() {
  while (window.workInProgress !== null) {
    performUnitOfWork(window.workInProgress);
  }
}

//!unitOfWork === current.alternate === window.workInProgress
function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate;
  setCurrentFiber(unitOfWork);
  let next = beginWork(current, unitOfWork, window.subtreeRenderLanes);

  //!初始化
  resetCurrentFiber();

  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  //!一直执行到next===null才停止
  if (next === null) {
    completeUnitOfWork(unitOfWork);
  } else {
    window.workInProgress = next;
  }
}
