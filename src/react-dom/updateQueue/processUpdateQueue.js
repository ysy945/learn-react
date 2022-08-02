/**
 *
 * @param {*} workInProgress 需要构建的fiber
 * @param {*} props 最新的props
 * @param {*} instance null
 * @param {*} renderLanes 当前的渲染车道
 */

import {
  NoLanes,
  isSubsetOfLanes,
  NoLane,
  mergeLanes,
} from "../../react-reconciler/ReactFiberLane";
import {
  Callback,
  CaptureUpdate,
  DidCapture,
  ForceUpdate,
  ReplaceState,
  ShouldCapture,
  UpdateState,
} from "../react-dom-types";

import markSkippedUpdateLanes from "./markSkippedUpdateLanes";

window.hasForceUpdate = false;
window.workInProgressRootSkippedLanes = NoLanes;

export default function processUpdateQueue(
  workInProgress,
  props,
  instance,
  renderLanes
) {
  const queue = workInProgress.updateQueue;
  window.hasForceUpdate = false;

  //!报错用的 可有可无
  //currentlyProcessingQueue = queue.shared;

  let firstBaseUpdate = queue.firstBaseUpdate; //!跳过第一个优先级的指针 这个构成一个单链表
  let lastBaseUpdate = queue.lastBaseUpdate; //! 跳过之后 最后的指针

  let pendingQueue = queue.shared.pending; //!获取queue队列的尾指针 这是循环队列

  if (pendingQueue !== null) {
    queue.shared.pending = null;
    //!pendingQueue是头指针
    let lastPendingUpdate = pendingQueue; //!获取本次更新的尾指针
    let firstPendingUpdate = lastPendingUpdate.next; //!获取本次更新的头指针

    lastPendingUpdate.next = null; //!解除循环 准备插入新的队列

    //!1.将上次跳过的优先级的update与最新的update合并

    //! 如果上次全部执行完了 没有剩余
    if (lastBaseUpdate === null) {
      //!上次没有 所以让新插入的头指针赋值给firstBaseUpdate
      firstBaseUpdate = firstPendingUpdate;
    }
    //! firstPendingUpdate = 1->2->3 lastBaseUpdate=4->5
    //! 执行后就是 4->5->1->2->3
    else {
      lastBaseUpdate.next = firstPendingUpdate;
    }

    //!让lastBastUpdate指向最后的 4>5>1>2>3的3
    lastBaseUpdate = lastPendingUpdate;

    const current = workInProgress.alternate;

    //!为了current和workInProgress同步 对current执行一样的操作 链接lastBaseUpdate与最新的queue
    if (current !== null) {
      const currentQueue = current.updateQueue;
      const currentLastBaseUpdate = currentQueue.lastBaseUpdate;

      if (currentLastBaseUpdate !== lastBaseUpdate) {
        if (currentLastBaseUpdate === null) {
          currentQueue.firstBaseUpdate = firstPendingUpdate;
        } else {
          currentLastBaseUpdate.next = firstPendingUpdate;
        }

        currentQueue.lastBaseUpdate = lastPendingUpdate;
      }
    }
    /*
     *其中字母代表状态 数字代表优先级
     *例如 A1->B1->C2->D1->E1
     * 第一次执行完后的状态为ABD 因为最优先级为1 遇到2优先级停止 D1又执行 然后停止
     * 而firstBaseUpdate指向C2 也就是第一次跳过的那个优先级 然后不再移动
     * lastBaseUpdate指向E1 所有firstBaseUpdate与lastBaseUpdate构成一个链便于下次与queue合成在执行
     * 所以还需要保存上次执行完的状态也就是AB这就是baseState 为什么不保存ABD呢 因为最终优先级调用完的
     * 执行顺序应该是ABCDE而不是A B D C E为了保证顺序一致性 所以只能保存到AB便于下次继续在这个基础上
     * 进行计算
     * */

    //!如果合并之后 前指针不为null
    if (firstBaseUpdate !== null) {
      //!上一次执行完的状态
      let newState = queue.baseState;

      let newLanes = NoLanes;
      let newBaseState = null;
      let newFirstBaseUpdate = null;
      let newLastBaseUpdate = null;
      let update = firstBaseUpdate;

      //!根据优先级获取对应的queue执行然后得到baseState
      do {
        const updateLane = update.lane; //!获取当前事件的优先级
        const updateEventTime = update.eventTime;
        //! updateLane不包含于renderLanes需要跳过本次优先级更新
        if (!isSubsetOfLanes(renderLanes, updateLane)) {
          //!克隆一个 然后放入链表中(不需要执行优先级不够)
          const clone = {
            eventTime: updateEventTime,
            lane: updateLane,
            tag: update.tag,
            payload: update.payload,
            callback: update.callback,
            next: null,
          };

          //!如果当前base链表中没有让首位指针指向同一个 为null表示是跳过的第一个需要记录下baseState
          //!在这之后的每一个任务都需要被记录下来
          if (newLastBaseUpdate === null) {
            newFirstBaseUpdate = newLastBaseUpdate = clone;
            newBaseState = newState;
          }
          //!如果base链表中有 则添加到链表的next中 并且指针向后移动一位
          else {
            newLastBaseUpdate = newLastBaseUpdate.next = clone;
          }

          //!添加跳过的优先级
          newLanes = mergeLanes(newLanes, updateLane);
        }
        //!需要执行
        else {
          //!newLastBaseUpdate只要不为null都需要被记录 又因为需要保证后面一定会执行 0是所有数的子集 这就可以保证后面一定会调用到
          if (newLastBaseUpdate !== null) {
            const clone = {
              eventTime: updateEventTime,
              lane: NoLane,
              tag: update.tag,
              payload: update.payload,
              callback: update.callback,
              next: null,
            };
            newLastBaseUpdate = newLastBaseUpdate.next = clone;
          }
          newState = getStateFromUpdate(
            workInProgress,
            queue,
            update,
            newState,
            props,
            instance //通过updateHostRoot进入为null 通过类组件为类组件实例
          );
          const callback = update.callback;

          if (callback !== null) {
            //!标识这个更新传递了回调函数在commit阶段调用
            workInProgress.flags |= Callback;
            //!并放入当前queue的副作用中
            const effects = queue.effects;

            if (effects === null) {
              queue.effects = [update];
            }
            //!如果存在直接推入即可
            else {
              effects.push(update);
            }
          }
        }
        update = update.next; //!本次update执行完 切换到下一个
        //!已经到最后一个了
        if (update === null) {
          //!可能当前在调度的过程中又有新的update被放进来了 需要继续处理
          pendingQueue = queue.shared.pending;
          //!如果为null表示 真的执行完了 可以退出循环了
          if (pendingQueue === null) {
            break;
          }
          //!否则需要在执行
          else {
            const lastPendingUpdate = pendingQueue; //!获取最后一个指针
            const firstPendingUpdate = lastPendingUpdate.next; //!获取第一个指针
            lastPendingUpdate.next = null; //!变为单链表
            update = firstPendingUpdate; //!让update变为第一个 方便循环
            queue.lastBaseUpdate = lastPendingUpdate;
            queue.shared.pending = null;
          }
        }
      } while (true);

      //!如果所有队列都执行完了state也就计算完成了
      if (newLastBaseUpdate === null) {
        // eslint-disable-next-line no-unused-vars
        newBaseState = newState;
      }

      //!将循环得到的剩余的队列赋值
      queue.baseState = newState;
      queue.firstBaseUpdate = newFirstBaseUpdate;
      queue.lastBaseUpdate = newLastBaseUpdate;

      markSkippedUpdateLanes(newLanes);
      workInProgress.lanes = newLanes;
      workInProgress.memoizedState = newState;
    }
  }
}

/**
 *
 * @param {*} workInProgress 当前构建的fiber数
 * @param {*} queue 当前循环的队列
 * @param {*} update 循环队列中的当前元素
 * @param {*} prevState 之前的state
 * @param {*} nextProps 现在的props
 * @param {*} instance 通过updateHostRoot进入为null
 */
function getStateFromUpdate(
  workInProgress,
  queue,
  update,
  prevState,
  nextProps,
  instance
) {
  //!根据不同的tag进行不同的更新
  switch (update.tag) {
    case ReplaceState: //!replace直接替换state
      const payload = update.payload;
      if (typeof payload === "function") {
        const nextState = payload.call(instance, prevState, nextProps);
        return nextState;
      }
      return payload;
    case CaptureUpdate:
      workInProgress.flags =
        (workInProgress.flags & ~ShouldCapture) | DidCapture;
    // eslint-disable-next-line no-fallthrough
    case UpdateState: //!updateState是合并state
      const payload$1 = update.payload;
      let partialState;
      if (typeof payload$1 === "function") {
        partialState = payload$1.call(instance, prevState, nextProps);
      } else {
        partialState = payload$1;
      }

      if (partialState === null || partialState === undefined) {
        return prevState;
      }

      return Object.assign({}, prevState, partialState);
    case ForceUpdate:
      window.hasForceUpdate = true;
      return prevState;
    default:
  }
}
