import processUpdateQueue from "./updateQueue/processUpdateQueue";
import cloneUpdateQueue from "./updateQueue/cloneUpdateQueue";
import bailoutOnAlreadyFinishedWork from "./bailoutOnAlreadyFinishedWork";
import reconcileChildren from "../react-reconciler/reconcileChildren";
import {
  ContentReset,
  ForceUpdate,
  Passive,
  PerformedWork,
  Placement,
  Ref,
  ReplaceState,
  Snapshot,
  Update,
} from "./react-dom-types";
import { setIsRendering } from "./currentFiber";
import { NoLanes, removeLanes } from "../react-reconciler/ReactFiberLane";
import { requestEventTime, requestUpdateLane } from "./fiberUtils";
import createUpdate from "./updateQueue/createUpdate";
import enqueueUpdate from "./updateQueue/enqueueUpdate";
import scheduleUpdateOnFiber from "./scheduleUpdateOnFiber";
import initializeUpdateQueue from "./updateQueue/initializeUpdateQueue";
import { resolveDefaultProps } from "./beginWork";
import ReactCurrentDispatcher from "../react/ReactCurrentDispatcher";
import HooksDispatcherOnMountInDEV from "./hooks/HooksDispatcherOnMountInDEV";
import HooksDispatcherOnUpdateInDEV from "./hooks/HooksDispatcherOnUpdateInDEV";

export function updateClassComponent(
  current,
  workInProgress,
  Component,
  nextProps,
  renderLanes
) {
  //!获取DOM
  const instance = workInProgress.stateNode;
  let shouldUpdate; //!是否更新

  //!组件实例还未创建
  if (instance === null) {
    if (current !== null) {
      current.alternate = null;
      workInProgress.alternate = null;

      workInProgress.flags |= Placement;
    }
    //!构造class组件实例
    constructClassInstance(workInProgress, Component, nextProps);
    //!挂载class组件实例
    mountClassInstance(workInProgress, Component, nextProps, renderLanes);
    //!挂载一定需要更新
    shouldUpdate = true;
  }
  //!class组件实例已经存在 ClassComponent是初次渲染那么复用class组件实例,更新props/state并返回shouldUpdate
  else if (current === null) {
    //TODO可能与卸载了组件有关
    shouldUpdate = resumeMountClassInstance(
      workInProgress,
      Component,
      nextProps,
      renderLanes
    );
  }
  //!class组件实例已经创建并且不是初次渲染,执行componentWillUpdate 返回shouldUpdate
  else {
    shouldUpdate = updateClassInstance(
      current,
      workInProgress,
      Component,
      nextProps,
      renderLanes
    );
  }

  //!判断是否执行render生命周期函数
  var nextUnitOfWork = finishClassComponent(
    current,
    workInProgress,
    Component,
    shouldUpdate,
    false, //!hasContext
    renderLanes
  );

  return nextUnitOfWork;
}
export function updateHostRoot(current, workInProgress, renderLanes) {
  //   const updateQueue = workInProgress.updateQueue;
  const nextProps = workInProgress.pendingProps; //!最新的props
  const prevState = workInProgress.memoizedState; //!之前的状态
  //!因为是根节点 所以state一定有element属性也就是jsx的对象形式
  const prevChildren = prevState !== null ? prevState.element : null;
  //!让current 和 workInProgress 的updateQueue不一样 浅克隆
  cloneUpdateQueue(current, workInProgress);
  processUpdateQueue(workInProgress, nextProps, null, renderLanes); //!更新状态
  const nextState = workInProgress.memoizedState; //!获取最新的状态
  var nextChildren = nextState.element; //!获取最新的child
  //!如果两个对象没变 直接复用节点即可
  if (nextChildren === prevChildren) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }
  //!改变了 执行diff操作
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}
export function updateHostComponent(current, workInProgress, renderLanes) {
  const type = workInProgress.type;
  const nextProps = workInProgress.pendingProps;
  const prevProps = current !== null ? current.memoizedProps : null;
  const isDirectTextChild = shouldSetTextContent(type, nextProps); //!判断child是否是文本节点
  let nextChildren = nextProps.children;
  //!如果是文本节点让nextChildren = null
  if (isDirectTextChild) {
    nextChildren = null;
  }
  //!如果之前的props有值 给WIP打上直接更换内容的标识(flag)
  else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
    workInProgress.flags |= ContentReset;
  }
  //!标记ref
  markRef(current, workInProgress);
  //!进行diff算法
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);

  return workInProgress.child;
}
export function updateHostText(current, workInProgress) {
  return null;
}
export function updateFunctionComponent(
  current,
  workInProgress,
  Component,
  nextProps,
  renderLanes
) {
  let nextChildren;
  setIsRendering(true);
  nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    {}, //!context
    renderLanes
  );

  setIsRendering(false);

  if (current !== null && !window.didReceiveUpdate) {
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  workInProgress.flags |= PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

/**
 *
 * @param {*} workInProgress
 * @param {*} ctor
 * @param {*} props 最新的props 类组件的props融合了defaultProps
 */
function constructClassInstance(workInProgress, ctor, props) {
  //!这里的instance就是fiber.stateNode
  const instance = new ctor(props);
  //!挂载类组件的更新器 构建指针让实例与fiber相互指向对方
  //!将实例的state挂载到memoizedState上
  workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined
      ? instance.state
      : null;
  adoptClassInstance(workInProgress, instance);
  return instance;
}
function get(key) {
  return key._reactInternals;
}
function set(key, value) {
  key._reactInternals = value;
}
//!类组件的更新器
const classComponentUpdater = {
  isMounted: function () {},
  enqueueSetState: function (inst, payload, callback) {
    const fiber = get(inst);
    const eventTime = requestEventTime();
    const lane = requestUpdateLane(fiber);
    const update = createUpdate(eventTime, lane);
    update.payload = payload;

    if (callback !== undefined && callback !== null) {
      update.callback = callback;
    }
    enqueueUpdate(fiber, update);
    scheduleUpdateOnFiber(fiber, lane, eventTime);
  },
  enqueueReplaceState: function (inst, payload, callback) {
    const fiber = get(inst);
    const eventTime = requestEventTime();
    const lane = requestUpdateLane(fiber);
    const update = createUpdate(eventTime, lane);
    update.tag = ReplaceState;
    update.payload = payload;

    if (callback !== undefined && callback !== null) {
      update.callback = callback;
    }

    enqueueUpdate(fiber, update);
    scheduleUpdateOnFiber(fiber, lane, eventTime);
  },
  enqueueForceUpdate: function (inst, callback) {
    const fiber = get(inst);
    const eventTime = requestEventTime();
    const lane = requestUpdateLane(fiber);
    const update = createUpdate(eventTime, lane);
    update.tag = ForceUpdate;

    if (callback !== undefined && callback !== null) {
      update.callback = callback;
    }

    enqueueUpdate(fiber, update);
    scheduleUpdateOnFiber(fiber, lane, eventTime);
  },
};

function adoptClassInstance(workInProgress, instance) {
  //!挂载类的更新器
  instance.updater = classComponentUpdater;
  workInProgress.stateNode = instance; //!让stateNode指向实例 与hostComponent不同stateNode指向DOM
  set(instance, workInProgress); //!instance._reactInternals = workInProgress
  instance._reactInternalInstance = {};
}

//!都只是获取了最新的状态 没有发起更新DOM的调度
//!应该是因为需要本次挂载流程完成后 才能进行更新
function mountClassInstance(workInProgress, ctor, newProps, renderLanes) {
  const instance = workInProgress.stateNode;
  instance.props = newProps;
  initializeUpdateQueue(workInProgress); //!对于类组件来说需要一个更新队列更新状态
  processUpdateQueue(workInProgress, newProps, instance, renderLanes); //!执行获得最新的状态
  instance.state = workInProgress.memoizedState;
  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;

  if (typeof getDerivedStateFromProps === "function") {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps
    );
    instance.state = workInProgress.memoizedState;
  }

  //!满足以下条件调用callComponentWillMount
  if (
    typeof ctor.getDerivedStateFromProps !== "function" &&
    typeof instance.getSnapshotBeforeUpdate !== "function" &&
    (typeof instance.UNSAFE_componentWillMount === "function" ||
      typeof instance.componentWillMount === "function")
  ) {
    //!调用生命周期函数之后可能会有状态变化需要立刻执行状态更新队列更新DOM
    callComponentWillMount(workInProgress, instance);
    processUpdateQueue(workInProgress, newProps, instance, renderLanes); //!得到最新状态
    instance.state = workInProgress.memoizedState; //!挂载到实例上
  }

  //!如果有componentDidMount函数打上标记在commit阶段调用
  if (typeof instance.componentDidMount === "function") {
    workInProgress.flags |= Update;
  }
}

function applyDerivedStateFromProps(
  workInProgress,
  ctor,
  getDerivedStateFromProps,
  nextProps
) {
  const prevState = workInProgress.memoizedState;
  //!将最新的props传递给用户获取最新的state
  const partialState = getDerivedStateFromProps(nextProps, prevState);

  const memoizedState =
    partialState === null || partialState === undefined
      ? prevState
      : Object.assign({}, prevState, partialState);
  workInProgress.memoizedState = memoizedState;

  if (workInProgress.lanes === NoLanes) {
    const updateQueue = workInProgress.updateQueue;
    updateQueue.baseState = memoizedState;
  }
}

function callComponentWillMount(workInProgress, instance) {
  const oldState = instance.state;

  if (typeof instance.componentWillMount === "function") {
    instance.componentWillMount();
  }
  if (typeof instance.UNSAFE_componentWillMount === "function") {
    instance.UNSAFE_componentWillMount();
  }

  if (oldState !== instance.state) {
    classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
  }
}

function resetHasForceUpdateBeforeProcessing() {
  window.hasForceUpdate = false;
}
function checkHasForceUpdateAfterProcessing() {
  return window.hasForceUpdate;
}
//!已经有实例了 不需要创建实例了 直接更新props和state(第一次渲染走这个函数)
//!可能有的生命周期componentWillReceiveProps componentWillMount componentDidMount(只是打上标记)
function resumeMountClassInstance(workInProgress, ctor, newProps, renderLanes) {
  const instance = workInProgress.stateNode;
  const oldProps = workInProgress.memoizedProps;
  instance.props = oldProps;
  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
  //!判断是否执行了新的生命周期函数
  const hasNewLifeCycles =
    typeof getDerivedStateFromProps === "function" ||
    typeof instance.getSnapshotBeforeUpdate === "function";
  //!如果没有执行新的生命周期函数则使用旧的生命周期函数
  if (
    !hasNewLifeCycles &&
    (typeof instance.UNSAFE_componentWillReceiveProps === "function" ||
      typeof instance.componentWillReceiveProps === "function")
  ) {
    //!如果新旧props不同则调用componentWillReceiveProps
    if (oldProps !== newProps) {
      callComponentWillReceiveProps(workInProgress, instance, newProps);
    }
  }

  resetHasForceUpdateBeforeProcessing(); //!设置为不更新
  const oldState = workInProgress.memoizedState; //!获取老状态
  let newState = (instance.state = oldState);
  processUpdateQueue(workInProgress, newProps, instance, renderLanes);
  newState = workInProgress.memoizedState; //!获取新状态

  //!如果新旧props和state相同且执行processing时没有forceUpdate则不需要更新返回false
  if (
    oldProps === newProps &&
    oldState === newState &&
    !checkHasForceUpdateAfterProcessing()
  ) {
    if (typeof instance.componentDidMount === "function") {
      workInProgress.flags |= Update;
    }
    return false;
  }
  //! 调用了强制更新 或者新旧props/state不一样才会调用这个函数
  if (typeof getDerivedStateFromProps === "function") {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps
    );
    newState = workInProgress.memoizedState;
  }
  //!forceUpdate优先级高于shouldComponentUpdate
  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      //!调用shouldComponentUpdate判断用户是否更新
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState
    );

  if (shouldUpdate) {
    if (
      !hasNewLifeCycles &&
      (typeof instance.UNSAFE_componentWillMount === "function" ||
        typeof instance.componentWillMount === "function")
    ) {
      if (typeof instance.componentWillMount === "function") {
        instance.componentWillMount();
      }
      if (typeof instance.UNSAFE_componentWillMount === "function") {
        instance.UNSAFE_componentWillMount();
      }
    }

    if (typeof instance.componentDidMount === "function") {
      workInProgress.flags |= Update;
    }
  }
  //!如果不需要更新也需要调用componentDidMount
  else {
    if (typeof instance.componentDidMount === "function") {
      workInProgress.flags |= Update;
    }

    //!一定要在本轮挂载结束后才能让memoizedProps是最新的
    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
  }

  instance.props = newProps;
  instance.state = newState;
  //!当前是在执行render前的判断
  return shouldUpdate;
}

function checkShouldComponentUpdate(
  workInProgress,
  ctor,
  oldProps,
  newProps,
  oldState,
  newState
) {
  const instance = workInProgress.stateNode;
  if (typeof instance.shouldComponentUpdate === "function") {
    const shouldUpdate = instance.shouldComponentUpdate(newProps, newState);
    return shouldUpdate;
  }

  //!处理pureComponent的浅比较一下
  if (ctor.prototype && ctor.prototype.isPureReactComponent) {
    return (
      !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState)
    );
  }
  return true;
}

function shallowEqual(objA, objB) {
  if (Object.is(objA, objB)) {
    return true;
  }

  if (
    typeof objA !== "object" ||
    objA === null ||
    typeof objB !== "object" ||
    objB === null
  ) {
    return false;
  }

  var keysA = Object.keys(objA);
  var keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  } // Test for A's keys different from B.

  for (var i = 0; i < keysA.length; i++) {
    if (
      !Object.prototype.hasOwnProperty.call(objB, keysA[i]) ||
      !Object.is(objA[keysA[i]], objB[keysA[i]])
    ) {
      return false;
    }
  }

  return true;
}

function callComponentWillReceiveProps(workInProgress, instance, newProps) {
  const oldState = instance.state;

  if (typeof instance.componentWillReceiveProps === "function") {
    instance.componentWillReceiveProps(newProps);
  }

  if (typeof instance.UNSAFE_componentWillReceiveProps === "function") {
    instance.UNSAFE_componentWillReceiveProps(newProps);
  }

  if (instance.state !== oldState) {
    classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
  }
}

//!判断是否执行生命周期的条件 并且通过对比新旧state和props以及forceUpdate
//!shouldComponentUpdate来判断是否需要执行render 如果新旧state props都没有变化
//!说明子元素也不会有任何变化
function updateClassInstance(
  current,
  workInProgress,
  ctor,
  newProps,
  renderLanes
) {
  const instance = workInProgress.stateNode;
  cloneUpdateQueue(current, workInProgress);
  //!拿到上次的props
  const unresolvedOldProps = workInProgress.memoizedProps;
  //!融合defaultProps
  const oldProps =
    workInProgress.type === workInProgress.elementType
      ? unresolvedOldProps
      : resolveDefaultProps(workInProgress.type, unresolvedOldProps);
  instance.props = oldProps; //!将融合后的props赋值给实例 融合后的props给实例 未融合的做比较

  const unresolvedNewProps = workInProgress.pendingProps; //!获取最新的props

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps;

  //!判断是否执行新的生命周期函数
  const hasNewLifeCycles =
    typeof getDerivedStateFromProps === "function" ||
    typeof instance.getSnapshotBeforeUpdate === "function";

  //!如果没有设置新的生命周期钩子 用以前的
  if (
    !hasNewLifeCycles &&
    (typeof instance.UNSAFE_componentWillReceiveProps === "function" ||
      typeof instance.componentWillReceiveProps === "function")
  ) {
    //!判断新旧props是否相同 fiber.memoriedProps fiber.pendingProps
    if (unresolvedOldProps !== unresolvedNewProps) {
      callComponentWillReceiveProps(workInProgress, instance, newProps);
    }
  }

  //!将hasShouldUpdate设置为false
  resetHasForceUpdateBeforeProcessing();
  const oldState = workInProgress.memoizedState;
  let newState = (instance.state = oldState);
  processUpdateQueue(workInProgress, newProps, instance, renderLanes); //!执行队列
  newState = workInProgress.memoizedState; //!获取最新的状态

  //!如果新旧props没有发生改变且没有设置forceUpdate
  if (
    unresolvedOldProps === unresolvedNewProps &&
    oldState === newState &&
    !checkHasForceUpdateAfterProcessing()
  ) {
    if (typeof instance.componentDidUpdate === "function") {
      if (
        unresolvedOldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Update;
      }
    }

    //!在render之后调用
    if (typeof instance.getSnapshotBeforeUpdate === "function") {
      if (
        unresolvedOldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Snapshot;
      }
    }

    return false;
  }

  if (typeof getDerivedStateFromProps === "function") {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps
    );
    newState = workInProgress.memoizedState;
  }

  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState
    );

  if (shouldUpdate) {
    if (
      !hasNewLifeCycles &&
      (typeof instance.UNSAFE_componentWillUpdate === "function" ||
        typeof instance.componentWillUpdate === "function")
    ) {
      if (typeof instance.componentWillUpdate === "function") {
        instance.componentWillUpdate(newProps, newState);
      }

      if (typeof instance.UNSAFE_componentWillUpdate === "function") {
        instance.UNSAFE_componentWillUpdate(newProps, newState);
      }
    }

    if (typeof instance.componentDidUpdate === "function") {
      workInProgress.flags |= Update;
    }

    if (typeof instance.getSnapshotBeforeUpdate === "function") {
      workInProgress.flags |= Snapshot;
    }
  } else {
    if (typeof instance.componentDidUpdate === "function") {
      if (
        unresolvedOldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Update;
      }
    }

    if (typeof instance.getSnapshotBeforeUpdate === "function") {
      if (
        unresolvedOldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.flags |= Snapshot;
      }
    }

    workInProgress.memoizedProps = newProps;
    workInProgress.memoizedState = newState;
  }

  instance.props = newProps;
  instance.state = newState;
  return shouldUpdate;
}

//!调用render函数获取children进行diff
function finishClassComponent(
  current,
  workInProgress,
  Component,
  shouldUpdate,
  hasContext,
  renderLanes
) {
  //!判断是否打上Ref标记
  markRef(current, workInProgress);

  //!如果不需要更新复用子节点
  if (!shouldUpdate) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  const instance = workInProgress.stateNode; // Rerender

  setIsRendering(true);
  const nextChildren = instance.render();
  setIsRendering(false);
  workInProgress.flags |= PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  workInProgress.memoizedState = instance.state;
  return workInProgress.child;
}

// function forceUnmountCurrentAndReconcile(
// current,
// workInProgress,
// nextChildren,
// renderLanes
// ) {
// !删除所有子节点
// workInProgress.child = reconcileChildFibers(
// workInProgress,
// current.child,
// null,
// renderLanes
// );
// !重新渲染所有子节点
// workInProgress.child = reconcileChildFibers(
// workInProgress,
// null,
// nextChildren,
// renderLanes
// );
// }

function shouldSetTextContent(type, props) {
  return (
    typeof props.children === "string" || typeof props.children === "number"
  );
}

function markRef(current, workInProgress) {
  const ref = workInProgress.ref;
  //!之前没有ref或则之前的ref与现在的ref不相等就给WIP打上Ref标签
  if (
    (current === null && ref !== null) ||
    (current !== null && current.ref !== ref)
  ) {
    workInProgress.flags |= Ref;
  }
}

function bailoutHooks(current, workInProgress, lanes) {
  workInProgress.updateQueue = current.updateQueue;
  //!去掉Passive和Update的标识
  workInProgress.flags &= ~(Passive | Update);
  //!去除当前的优先级
  current.lanes = removeLanes(current.lanes, lanes);
}

function renderWithHooks(
  current,
  workInProgress,
  Component,
  props,
  secondArg,
  nextRenderLanes
) {
  window.renderLanes = nextRenderLanes;
  window.currentlyRenderingFiber$1 = workInProgress; //!将当前的工作fiber赋值给currentlyRenderingFiber便于内部调用
  //!初始化
  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.lanes = NoLanes;

  if (current !== null && current.memoizedState !== null) {
    ReactCurrentDispatcher.current = HooksDispatcherOnUpdateInDEV;
  }
  //!第一次挂载 将current赋值给HooksDispatcherOnMountInDEV
  else {
    ReactCurrentDispatcher.current = HooksDispatcherOnMountInDEV;
  }

  const children = Component(props, secondArg);

  ReactCurrentDispatcher.current = {};
  window.renderLanes = NoLanes;
  window.currentlyRenderingFiber$1 = null;
  window.currentHook = null;
  window.workInProgressHook = null;
  window.didScheduleRenderPhaseUpdate = false;
  return children;
}
