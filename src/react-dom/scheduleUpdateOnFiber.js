import {
  HostRoot,
  LegacyUnbatchedContext,
  NoContext,
  RenderContext,
  CommitContext,
} from "./react-dom-types";
import { mergeLanes, laneToIndex } from "../react-reconciler/ReactFiberLane";
import { getExecutionContext } from "./legacyRenderSubtreeIntoContainer";
import { unstable_getCurrentPriorityLevel as getCurrentPriorityLevel } from "../react-scheduler/SchedulerDev";
import ensureRootIsScheduled from "./ensureRootIsScheduled";
import performSyncWorkOnRoot from "./performSyncWorkOnRoot";
import { SyncLane } from "../react-reconciler/ReactFiberLane";

/**
 *
 * @param {*} fiber 调度的fiber
 * @param {*} lane  优先级
 * @param {*} eventTime 当前事件的注册事件
 */
export default function scheduleUpdateOnFiber(fiber, lane, eventTime) {
  //TODO 用于检测用于是否循环调用setState或则 useState 等 暂时不实现checkForNestedUpdates();
  const root = markUpdateLaneFromFiberToRoot(fiber, lane);

  if (root === null) {
    return null;
  }

  markRootUpdated(root, lane, eventTime);

  const priorityLevel = getCurrentPriorityLevel();

  const executionContext = getExecutionContext();

  if (lane === SyncLane) {
    //!同步且没有任务
    if (
      (executionContext & LegacyUnbatchedContext) !== NoContext &&
      (executionContext & (RenderContext | CommitContext)) === NoContext
    ) {
      // 如果是本次更新是同步的，并且当前还未渲染，意味着主线程空闲，并没有React的
      // 更新任务在执行，那么调用performSyncWorkOnRoot开始执行同步任务
      performSyncWorkOnRoot(root);
    }
    //!同步但是由其他任务
    else {
      // 如果是本次更新是同步的，不过当前有React更新任务正在进行，
      // 而且因为无法打断，所以调用ensureRootIsScheduled
      // 目的是去复用已经在更新的任务，让这个已有的任务
      // 把这次更新顺便做了
      // ensureRootIsScheduled(root, eventTime);
      performSyncWorkOnRoot(root);
    }
  }
  //! 如果是更新是异步的，调用ensureRootIsScheduled去进入异步调度
  else {
    ensureRootIsScheduled(root, eventTime);
  }
}

//!更新所有的lanes以及所有的父fiber的childLanes 相对于所有的父fiber来说 当前lane发生改变 父的childLanes都需要改变
//!同时还需要改变alternate
function markUpdateLaneFromFiberToRoot(sourceFiber, lane) {
  //!将当前优先级 加入到当前更新的fiber中
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
  let alternate = sourceFiber.alternate;

  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane);
  }

  let node = sourceFiber;
  //!获取当前fiber的父fiber
  let parent = sourceFiber.return;

  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    alternate = parent.alternate;

    if (alternate !== null) {
      alternate.childLanes = mergeLanes(alternate.childLanes, lane);
    }

    node = parent;
    parent = parent.return;
  }

  //!如果当前fiber是根fiber返回fiberRootNode
  if (node.tag === HostRoot) {
    var root = node.stateNode;
    return root;
  } else {
    return null;
  }
}

function markRootUpdated(root, updateLane, eventTime) {
  //!将本次更新的lane放入root的pendingLanes
  root.pendingLanes |= updateLane;

  const higherPriorityLanes = updateLane - 1; // Turns 0b1000 into 0b0111
  // (before) suspendedLanes 0b10100
  //                         &
  // higherPriorityLanes     0b01111
  // ----------------------------------
  // (after)  suspendedLanes 0b00100
  // 目的是剔除掉suspendedLanes 和 pingedLanes中优先级低于本次更新优先级（updateLane）的lane
  // 实现上方注释中的 “取消同等或较低优先级的更新。”
  root.suspendedLanes &= higherPriorityLanes;
  root.pingedLanes &= higherPriorityLanes;

  /*
   * 假设 lanes：0b000100
   * 那么eventTimes是这种形式： [ -1, -1, -1, 44573.3452, -1, -1 ]
   * 用一个数组去存储eventTimes，-1表示空位，非-1的位置与lanes中的1的位置相同
   * */
  const eventTimes = root.eventTimes;
  const index = laneToIndex(updateLane);

  eventTimes[index] = eventTime;
}
