import { mergeLanes, NoLanes } from "../react-reconciler/ReactFiberLane";
import completeWork from "./completeWork";
import { resetCurrentFiber, setCurrentFiber } from "./currentFiber";
import {
  Incomplete,
  NoFlags,
  RootIncomplete,
  RootCompleted,
  PerformedWork,
} from "./react-dom-types";

export default function completeUnitOfWork(unitOfWork) {
  // Attempt to complete the current unit of work, then move to the next
  // sibling. If there are no more siblings, return to the parent fiber.
  //!尝试结束当前单元的任务,然后转移到兄弟节点,如果没有兄弟节点返回到父节点
  let completedWork = unitOfWork;
  do {
    const current = completedWork.alternate; //!获取current
    const returnFiber = completedWork.return; //!获取父fiber
    //!如果当前fiber还没处于complete阶段 就进入这个阶段
    if ((completedWork.flags & Incomplete) === NoFlags) {
      setCurrentFiber(completedWork);
      let next = void 0;
      //!主要执行DOM的创建或则更新props
      next = completeWork(current, completedWork, window.subtreeRenderLanes);
      resetCurrentFiber();

      if (next !== null) {
        window.workInProgress = next;
        return;
      }
      //!收集所有子节点的lanes
      resetChildLanes(completedWork);

      //!将当前的effect链连接到父fiber上
      if (
        returnFiber !== null && //!returnFiber存在
        (returnFiber.flags & Incomplete) === NoFlags //!表示没有出错
      ) {
        //!如果父fiber没有effect链让第一个副作用指针指向completeWork的第一个副作用指针
        if (returnFiber.firstEffect === null) {
          returnFiber.firstEffect = completedWork.firstEffect;
        }

        //!如果存在让最后一个指针的下一个指向work的第一个
        if (completedWork.lastEffect !== null) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = completedWork.firstEffect;
          }

          returnFiber.lastEffect = completedWork.lastEffect;
        }

        const flags = completedWork.flags;

        //!大于1表示有其他操作 并入副作用
        if (flags > PerformedWork) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = completedWork;
          } else {
            returnFiber.firstEffect = completedWork;
          }

          returnFiber.lastEffect = completedWork;
        }
      }
    }
    const siblingFiber = completedWork.sibling;

    //!如果当前有兄弟节点 先让兄弟节点beginWork在进入completeWork
    if (siblingFiber !== null) {
      window.workInProgress = siblingFiber;
      return;
    }

    completedWork = returnFiber;

    window.workInProgress = completedWork;
  } while (completedWork !== null);

  //!修改状态
  if (window.workInProgressRootExitStatus === RootIncomplete) {
    window.workInProgressRootExitStatus = RootCompleted;
  }
}

//!重新设置childLanes 重新合并所有子节点的childLanes 和 lanes
function resetChildLanes(completedWork) {
  let newChildLanes = NoLanes;

  let child = completedWork.child;

  while (child !== null) {
    newChildLanes = mergeLanes(
      newChildLanes,
      mergeLanes(child.lanes, child.childLanes)
    );
    child = child.sibling;
  }

  completedWork.childLanes = newChildLanes;
}
