import { NoLanes } from "../../react-reconciler/ReactFiberLane";
import ReactCurrentDispatcher from "../../react/ReactCurrentDispatcher";
import { requestEventTime, requestUpdateLane } from "../fiberUtils";
import { hasEffect, Passive, Passive$1, Update } from "../react-dom-types";
import scheduleUpdateOnFiber from "../scheduleUpdateOnFiber";

window.currentHookNameInDev = null;
window.hookTypesDev = null;
window.currentlyRenderingFiber$1 = null;

window.currentHook = null;
window.workInProgressHook = null;
const HooksDispatcherOnMountInDEV = {
  useCallback: function (callback, deps) {
    window.currentHookNameInDev = "useCallback";
    mountHookTypesDev();
    checkDepsAreArrayDev(deps); //!检测依赖项是否是数组
    return mountCallback(callback, deps);
  },
  useEffect: function (create, deps) {
    window.currentHookNameInDev = "useEffect";
    mountHookTypesDev();
    checkDepsAreArrayDev(deps); //!检测依赖项是否是数组
    return mountEffect(create, deps);
  },
  useReducer: function (reducer, initialArg, init) {
    window.currentHookNameInDev = "useReducer";
    mountHookTypesDev();
    var prevDispatcher = ReactCurrentDispatcher.current;
    ReactCurrentDispatcher.current = {};

    try {
      return mountReducer(reducer, initialArg, init);
    } finally {
      ReactCurrentDispatcher.current = prevDispatcher;
    }
  },
  useRef: function (initialValue) {
    window.currentHookNameInDev = "useRef";
    mountHookTypesDev();
    return mountRef(initialValue);
  },
  useState: function (initialState) {
    window.currentHookNameInDev = "useState";
    mountHookTypesDev();
    const prevDispatcher = ReactCurrentDispatcher.current;
    ReactCurrentDispatcher.current = {};

    try {
      return mountState(initialState);
    } finally {
      ReactCurrentDispatcher.current = prevDispatcher;
    }
  },
};

//!将hooks的名称放入hookTypesDev ["useState","useCallback"]
function mountHookTypesDev() {
  //!获取当前hooks的名称
  const hookName = window.currentHookNameInDev;

  if (window.hookTypesDev === null) {
    window.hookTypesDev = [hookName];
  } else {
    window.hookTypesDev.push(hookName);
  }
}

function checkDepsAreArrayDev(deps) {
  if (deps !== undefined && deps !== null && !Array.isArray(deps)) {
    console.error(
      "%s received a final argument that is not an array (instead, received `%s`). When " +
        "specified, the final argument must be an array.",
      window.currentHookNameInDev,
      typeof deps
    );
  }
}

//!在workInProgressHook上创建一个新得hook
function mountWorkInProgressHook() {
  //!创建一个hook
  const hook = {
    memoizedState: null, //!上次得state
    baseState: null, //!第一次得state
    baseQueue: null,
    queue: null,
    next: null, //!下一个hook得指针
  };

  //!将创建得新hook挂载到对应得函数组件得fiber中
  if (window.workInProgressHook === null) {
    window.currentlyRenderingFiber$1.memoizedState = window.workInProgressHook =
      hook;
  }
  //!添加hook到workInProgressHook中
  else {
    window.workInProgressHook = window.workInProgressHook.next = hook;
  }

  return window.workInProgressHook;
}

export function basicStateReducer(state, action) {
  return typeof action === "function" ? action(state) : action;
}

/**
 *
 * @param {*} fiber 当前的函数组件的fiber 上次构建完成的
 * @param {*} queue 当前hook的queue
 * @param {*} action 调用setNumber中传递的参数
 * @returns
 */
function dispatchAction(fiber, queue, action) {
  if (typeof arguments[3] === "function") {
    console.error(
      "State updates from the useState() and useReducer() Hooks don't support the " +
        "second callback argument. To execute a side effect after " +
        "rendering, declare it in the component body with useEffect()."
    );
  }

  const eventTime = requestEventTime();
  const lane = requestUpdateLane(fiber);
  const update = {
    lane: lane, //!本次更新的优先级
    action: action, //!用户传入的函数或则最新的值
    eagerReducer: null, //!保存上次的使用的reducer
    eagerState: null, //!保存通过eagerReducer计算出的状态
    next: null, //!下一个update
  };

  const pending = queue.pending;

  //!将创建的update添加到queue.pending中
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }

  queue.pending = update;
  const alternate = fiber.alternate;

  if (
    fiber === window.currentlyRenderingFiber$1 ||
    (alternate !== null && alternate === window.currentlyRenderingFiber$1)
  ) {
    window.didScheduleRenderPhaseUpdateDuringThisPass =
      window.didScheduleRenderPhaseUpdate = true;
  } else {
    if (
      fiber.lanes === NoLanes &&
      (alternate === null || alternate.lanes === NoLanes)
    ) {
      const lastRenderedReducer = queue.lastRenderedReducer; //!(state,action)=>action(state)

      if (lastRenderedReducer !== null) {
        let prevDispatcher;

        prevDispatcher = ReactCurrentDispatcher.current;
        ReactCurrentDispatcher.current = {};

        try {
          const currentState = queue.lastRenderedState;
          const eagerState = lastRenderedReducer(currentState, action); //!获取用户返回的最新状态

          update.eagerReducer = lastRenderedReducer;
          update.eagerState = eagerState;

          //!判断两次是否是同一个对象
          if (Object.is(eagerState, currentState)) {
            return;
          }
        } catch (error) {
        } finally {
          ReactCurrentDispatcher.current = prevDispatcher;
        }
      }
    }

    //!发起调度
    scheduleUpdateOnFiber(fiber, lane, eventTime);
  }
}

/**
 *
 * @param {*} reducer
 * @param {*} initialArg
 * @param {*} init 能收到上一次的状态
 * @returns
 */
//!useState与useReducer的区别在于 useState是useReducer的语法糖 对于useState来说实际上内部内置了
//!一个reducer 也就是basicStateReducer 而对于useReducer来说 需要自己去写一个reducer 如果这个reducer
//!就是basicStateReducer那么两个方法没有区别
function mountReducer(reducer, initialArg, init) {
  const hook = mountWorkInProgressHook();
  let initialState;

  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = initialArg;
  }

  hook.memoizedState = hook.baseState = initialState;
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: initialState,
  });
  const dispatch = (queue.dispatch = dispatchAction.bind(
    null,
    window.currentlyRenderingFiber$1,
    queue
  ));
  return [hook.memoizedState, dispatch];
}

function mountState(initialState) {
  //!初始化一个hook并添加到workInProgressHook中
  const hook = mountWorkInProgressHook();

  if (typeof initialState === "function") {
    initialState = initialState(); //!挂载的时候没有初始状态 不传入初始状态
  }

  //!给hook添加初始值
  hook.memoizedState = hook.baseState = initialState;
  const queue = (hook.queue = {
    pending: null, //!装入的update单链表
    dispatch: null, //!dispatchAction函数
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  });
  //!第一次执行是挂载 调用renderWithHooks的时候 会缓存当前的workInProgress到currentlyRenderingFiber$1
  //!所以这里传入的currentlyRenderingFiber$1永远是上次的fiber
  const dispatch = (queue.dispatch = dispatchAction.bind(
    null,
    window.currentlyRenderingFiber$1,
    queue
  ));
  return [hook.memoizedState, dispatch];
}

//!ref本质就是一个对象{current:initialValue}
function mountRef(initialValue) {
  const hook = mountWorkInProgressHook();
  const ref = {
    current: initialValue,
  };

  Object.seal(ref);

  hook.memoizedState = ref;
  return ref;
}

/**
 * React.useEffect(()=>{
 *    console.log(1)
 *    return function(){} 只会在下次调用这个回调之前执行 或则销毁的时候执行
 * },[deps]) deps如果不写 所有更新都执行 空数组只在挂载和卸载的时候执行 [a,b]a或则b发生变化了才执行
 *
 *
 * @param {*} create
 * @param {*} deps
 * @returns
 */
function mountEffect(create, deps) {
  return mountEffectImpl(Update | Passive, Passive$1, create, deps);
}

function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  window.currentlyRenderingFiber$1.flags |= fiberFlags; //!给当前的fiber添加上update和passive的标识
  hook.memoizedState = pushEffect(
    hasEffect | hookFlags,
    create,
    undefined,
    nextDeps
  );
}

//!往当前的fiber的updateQueue上添加副作用链(循环链表)
export function pushEffect(tag, create, destroy, deps) {
  const effect = {
    tag: tag, //!hasEffect | Passive$1
    create: create, //!用户传入的副作用函数
    destroy: destroy, //!undefined
    deps: deps, //!依赖数组 如果发生了变化才调用回调函数
    next: null,
  };
  let componentUpdateQueue = window.currentlyRenderingFiber$1.updateQueue; //!这是一个循环链表

  //!如果当前还没有创建effect链 则创建 并且将effect赋值到上面
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    window.currentlyRenderingFiber$1.updateQueue = componentUpdateQueue;
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    //!拿到内部的effect的最后的指针
    const lastEffect = componentUpdateQueue.lastEffect;

    if (lastEffect === null) {
      componentUpdateQueue.lastEffect = effect.next = effect;
    }
    //!将当前effect添加到循环队列中 并将最后的指针赋值给componentUpdateQueue.lastEffect
    else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      componentUpdateQueue.lastEffect = effect;
    }
  }

  return effect; //!返回这个effect尾指针
}

function createFunctionComponentUpdateQueue() {
  return {
    lastEffect: null,
  };
}

function mountCallback(callback, deps) {
  // const hook = {
  // memoizedState: null,[callback, nextDeps]
  // baseState: null,
  // baseQueue: null,
  // queue: null,
  // next: null,
  //   };
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

export default HooksDispatcherOnMountInDEV;
