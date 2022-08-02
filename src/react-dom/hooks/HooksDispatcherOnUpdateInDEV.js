import {
  isSubsetOfLanes,
  mergeLanes,
  NoLane,
} from "../../react-reconciler/ReactFiberLane";
import ReactCurrentDispatcher from "../../react/ReactCurrentDispatcher";
import { hasEffect, Passive, Passive$1, Update } from "../react-dom-types";
import markSkippedUpdateLanes from "../updateQueue/markSkippedUpdateLanes";
import { basicStateReducer, pushEffect } from "./HooksDispatcherOnMountInDEV";

const HooksDispatcherOnUpdateInDEV = {
  useCallback: function (callback, deps) {
    window.currentHookNameInDev = "useCallback";
    updateHookTypesDev();
    return updateCallback(callback, deps);
  },
  useEffect: function (create, deps) {
    window.currentHookNameInDev = "useEffect";
    updateHookTypesDev();
    return updateEffect(create, deps);
  },
  useReducer: function (reducer, initialArg, init) {
    window.currentHookNameInDev = "useReducer";
    updateHookTypesDev();
    const prevDispatcher = ReactCurrentDispatcher.current;
    ReactCurrentDispatcher.current = {};

    try {
      return updateReducer(reducer, initialArg, init);
    } finally {
      ReactCurrentDispatcher.current = prevDispatcher;
    }
  },
  useRef: function (initialValue) {
    window.currentHookNameInDev = "useRef";
    updateHookTypesDev();
    return updateRef();
  },
  useState: function (initialState) {
    window.currentHookNameInDev = "useState";
    updateHookTypesDev();
    const prevDispatcher = ReactCurrentDispatcher.current;
    ReactCurrentDispatcher.current = {};

    try {
      return updateState(initialState);
    } finally {
      ReactCurrentDispatcher.current = prevDispatcher;
    }
  },
};

function updateHookTypesDev() {
  // eslint-disable-next-line no-unused-vars
  const hookName = window.currentHookNameInDev;

  if (window.hookTypesDev !== null) {
    window.hookTypesUpdateIndexDev++;
  }
}

function updateRef(initialValue) {
  const hook = updateWorkInProgressHook(); //!获取当前的hook
  return hook.memoizedState; //!返回{current:xxx}
}

function updateCallback(callback, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;

  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps = prevState[1];

      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return prevState[0];
      }
    }
  }

  hook.memoizedState = [callback, nextDeps];
  return callback;
}

//!判断两次的依赖是否相等
function areHookInputsEqual(nextDeps, prevDeps) {
  if (prevDeps === null) {
    console.error(
      "%s received a final argument during this render, but not during " +
        "the previous render. Even though the final argument is optional, " +
        "its type cannot change between renders.",
      window.currentHookNameInDev
    );

    return false;
  }
  if (nextDeps.length !== prevDeps.length) {
    console.error(
      "The final argument passed to %s changed size between renders. The " +
        "order and size of this array must remain constant.\n\n" +
        "Previous: %s\n" +
        "Incoming: %s",
      window.currentHookNameInDev,
      "[" + prevDeps.join(", ") + "]",
      "[" + nextDeps.join(", ") + "]"
    );
  }

  //!判断两个值是否相等 浅比较
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }

    return false;
  }

  return true;
}

//!就是通过之前创建的hooks 创建一个新的hooks链 赋值到workInProgress上
function updateWorkInProgressHook() {
  let nextCurrentHook;

  //!如果为null表示第一次进入这个函数 第一次在这个函数组件中执行hooks
  if (window.currentHook === null) {
    //!这里的currentlyRenderingFiber$1是当前正在构建的workInProgress - 函数组件
    const current = window.currentlyRenderingFiber$1.alternate; //!拿到当前页面正在渲染的fiber

    if (current !== null) {
      //!因为会复用的原因 currentlyRenderingFiber$1 和 current几乎是相同的 但是在执行renderWithHooks的时候
      //!会将current.memoizedState等属性变为null 因为即将构建的不应该复用之前fiber的结果 需要重新构建
      //!所以只能重current中获取到之前的hooks
      nextCurrentHook = current.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  }
  //!表示已经在这个函数组件中执行过hooks 只需要将指针指向下一个就行了
  else {
    nextCurrentHook = window.currentHook.next;
  }

  let nextWorkInProgressHook;

  //!第一次进入肯定是null
  if (window.workInProgressHook === null) {
    //!当执行这个组件的第一个hook的时候 这里肯定是null 继续向下走
    nextWorkInProgressHook = window.currentlyRenderingFiber$1.memoizedState;
  }
  //!第二次进入window.workInProgressHook肯定不是null了 但是它的next还是null
  else {
    nextWorkInProgressHook = window.workInProgressHook.next;
  }

  if (nextWorkInProgressHook !== null) {
    //!已经有一项工作在进行中。重复使用。 不知道那种情况下触发 正常情况不会走这里
    window.workInProgressHook = nextWorkInProgressHook;
    nextWorkInProgressHook = window.workInProgressHook.next;
    window.currentHook = nextCurrentHook;
  } else {
    if (!(nextCurrentHook !== null)) {
      throw Error("Rendered more hooks than during the previous render.");
    }

    //!currentHook的值已经确定了 赋值上去
    window.currentHook = nextCurrentHook;
    //!为当前的workInProgress创建新的hook(复用) 不知道为什么不直接使用之前的
    const newHook = {
      memoizedState: window.currentHook.memoizedState,
      baseState: window.currentHook.baseState,
      baseQueue: window.currentHook.baseQueue,
      queue: window.currentHook.queue,
      next: null,
    };

    //!将新创建的hook添加到workInProgress上
    if (window.workInProgressHook === null) {
      window.currentlyRenderingFiber$1.memoizedState =
        window.workInProgressHook = newHook;
    } else {
      window.workInProgressHook = window.workInProgressHook.next = newHook;
    }
  }

  return window.workInProgressHook;
}

//!执行符合本次渲染优先级的update任务 跳过不符合的重新整合baseQueue
function updateReducer(reducer, initialArg, init) {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;
  /*queue = 
      {
        pending: null,
        dispatch: null,
        lastRenderedReducer: reducer,
        lastRenderedState: initialState,
      }*/

  if (!(queue !== null)) {
    throw Error(
      "Should have a queue. This is likely a bug in React. Please file an issue."
    );
  }

  queue.lastRenderedReducer = reducer; //!将当前的reducer放到queue中
  const current = window.currentHook;
  const pendingQueue = queue.pending; //!最新的queue
  let baseQueue = current.baseQueue; //!还没有执行完的queue

  //!调用了setNumber就会在pending中添加一个update
  if (pendingQueue !== null) {
    //!将两个循环链表链接起来 变成一个大的循环链表
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }

    if (current.baseQueue !== baseQueue) {
      console.error(
        "Internal error: Expected work-in-progress queue to be a clone. " +
          "This is a bug in React."
      );
    }

    //!记录下这个大循环链表的尾指针
    current.baseQueue = baseQueue = pendingQueue; //!本次要执行的循环队列
    queue.pending = null; //!让添加的为null
  }

  if (baseQueue !== null) {
    const first = baseQueue.next; //!获取头指针
    let newState = current.baseState;
    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;
    let update = first;

    //!遍历循环链表
    do {
      const updateLane = update.lane; //!获取本次更新的优先级

      //!如果当前优先级不在本次渲染优先级内 则不执行本次渲染
      if (!isSubsetOfLanes(window.renderLanes, updateLane)) {
        const clone = {
          lane: updateLane,
          action: update.action,
          eagerReducer: update.eagerReducer,
          eagerState: update.eagerState,
          next: null,
        };

        //!如果为null 记录下本次的baseState 和以后要执行的newBaseQueueFirst
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        }
        //!如果不为null表示只需要往链表中添加就行了 不需要在记录newBaseState
        else {
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }

        //!将优先级的lanes记录到当前fiber中
        window.currentlyRenderingFiber$1.lanes = mergeLanes(
          window.currentlyRenderingFiber$1.lanes,
          updateLane
        );
        markSkippedUpdateLanes(updateLane); //!标记跳过的优先级 便于下次执行
      }
      //!需要执行本次优先级
      else {
        if (newBaseQueueLast !== null) {
          const clone = {
            lane: NoLane,
            action: update.action,
            eagerReducer: update.eagerReducer,
            eagerState: update.eagerState,
            next: null,
          };
          newBaseQueueLast = newBaseQueueLast.next = clone; //!如果不为null就放入
        }

        //!如果reducer没变 就用之前已经计算出来的值
        if (update.eagerReducer === reducer) {
          newState = update.eagerState;
        }
        //!如果改变了 就用改变的
        else {
          const action = update.action;
          newState = reducer(newState, action);
        }
      }

      update = update.next;
    } while (update !== null && update !== first); //!遍历完了就停止

    //!如果为null 表示执行完了 直接将最后算出的状态赋值给newBaseState
    if (newBaseQueueLast === null) {
      newBaseState = newState;
    }
    //!不为null 表示本次的优先级还不足以让所有的update执行完 还有剩余 让baseQueue变为循环链表 便于下次在执行
    else {
      newBaseQueueLast.next = newBaseQueueFirst;
    }

    //!如果之前的state与当前的state不相等 标记为需要更新
    if (!Object.is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate();
    }

    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;
    queue.lastRenderedState = newState;
  }

  const dispatch = queue.dispatch;
  return [hook.memoizedState, dispatch];
}

//!标记本次需要更新
function markWorkInProgressReceivedUpdate() {
  window.didReceiveUpdate = true;
}
function updateState(initialState) {
  return updateReducer(basicStateReducer);
}

function updateEffect(create, deps) {
  return updateEffectImpl(Update | Passive, Passive$1, create, deps);
}

function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = updateWorkInProgressHook(); //!获取当前的hook
  const nextDeps = deps === undefined ? null : deps;
  let destroy = undefined;

  if (window.currentHook !== null) {
    const prevEffect = window.currentHook.memoizedState; //!拿到之前的effect的尾指针
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      const prevDeps = prevEffect.deps;

      //!全部相同才会返回true
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        pushEffect(hookFlags, create, destroy, nextDeps);
        return;
      }
    }
  }

  //!如果deps不相等 或则deps没有传值 那么打上需要更新的表示 并且推入副作用 更新hook.memoizedState
  window.currentlyRenderingFiber$1.flags |= fiberFlags;
  hook.memoizedState = pushEffect(
    hasEffect | hookFlags,
    create,
    destroy,
    nextDeps
  ); //!effect尾指针 头指针是fiber.updateQueue
}

export default HooksDispatcherOnUpdateInDEV;
