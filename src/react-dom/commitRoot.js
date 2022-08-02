import {
  mergeLanes,
  NoLanes,
  pickArbitraryLaneIndex,
} from "../react-reconciler/ReactFiberLane";
import {
  Scheduler_requestPaint,
  unstable_runWithPriority,
} from "../react-scheduler";
import { resolveDefaultProps } from "./beginWork";
import {
  setValueForProperty,
  setValueForStyles,
  shouldAutoFocusHostComponent,
  updateFiberProps,
} from "./completeWork";
import { resetCurrentFiber, setCurrentFiber } from "./currentFiber";
import ensureRootIsScheduled, {
  scheduleCallback,
} from "./ensureRootIsScheduled";
import { now } from "./fiberUtils";
import getCurrentPriorityLevel from "./getCurrentPriorityLevel";
import flushPassiveEffects, {
  detachFiberAfterEffects,
} from "./hooks/flushPassiveEffects";
import {
  getExecutionContext,
  setExecutionContext,
} from "./legacyRenderSubtreeIntoContainer";
import {
  Callback,
  CHILDREN,
  ClassComponent,
  COMMENT_NODE,
  CommitContext,
  ContentReset,
  Deletion,
  DOCUMENT_NODE,
  ELEMENT_NODE,
  FunctionComponent,
  hasEffect,
  HostComponent,
  HostRoot,
  HostText,
  ImmediatePriority$1,
  Layout,
  LegacyUnbatchedContext,
  NoContext,
  NoFlags,
  NoFlags$1,
  NoPriority$1,
  NormalPriority$1,
  NoTimestamp,
  Passive,
  Passive$1,
  PassiveUnmountPendingDev,
  PerformedWork,
  Placement,
  PlacementAndUpdate,
  Ref,
  RenderContext,
  Snapshot,
  STYLE,
  TEXT_NODE,
  Update,
} from "./react-dom-types";
import reactPriorityToSchedulerPriority from "./reactPriorityToSchedulerPriority";

function runWithPriority$1(reactPriorityLevel, fn) {
  //!获取scheduler优先级
  const priorityLevel = reactPriorityToSchedulerPriority(reactPriorityLevel);
  //!以scheduler优先级进行调度 fn = commitRootImpl
  return unstable_runWithPriority(priorityLevel, fn);
}

export default function commitRoot(root) {
  const renderPriorityLevel = getCurrentPriorityLevel(); //!获取react事件优先级
  runWithPriority$1(
    ImmediatePriority$1,
    commitRootImpl.bind(null, root, renderPriorityLevel)
  );
  return null;
}

/*
*commit阶段主要是针对root上收集的effectList进行处理。在真正的工作开始之前，有一个准备阶段，
*主要是变量的赋值，以及将root的effect加入到effectList中。随后开始针对effectList分三个阶段进行工作：

*before mutation：主要是执行getSnapshotBeforeUpdate 还有对于Function组件 调用effect
    
*mutation：主要是针对之前打上的Placement Deletion Update做不同的更新 例如Placement做插入操作
*Deletion做删除操作 对于卸载来说又需要深度优先遍历所有节点 类组件和函数组件需要调用生命周期函数 host节点
*需要调用detachRef消除ref Update又需要通过hostFiber.updateQueue缓存complete阶段得到的propertiesDiff属性
*进行属性的更新 所以这个阶段进行了真正的DOM操作和更新DOM的属性

*layout：在DOM操作完成后，读取组件的状态，针对类组件，调用生命周期componentDidMount和componentDidUpdate，
*        调用setState的回调；针对函数组件填充useEffect 的 effect执行数组，并调度useEffect

*before mutation和layout针对函数组件的useEffect调度是互斥的，只能发起一次调度
*workInProgress 树切换到current树的时机是在mutation结束后，layout开始前。
*这样做的原因是在mutation阶段调用类组件的componentWillUnmount的时候，
*还可以获取到卸载前的组件信息；在layout阶段调用componentDidMount/Update时，获取的组件信息更新后的。
*/

window.nextEffect = null; //!下一个effect

function commitRootImpl(root, renderPriorityLevel) {
  //!保证本次调度的useEffect都是本次更新产生
  do {
    flushPassiveEffects();
  } while (window.rootWithPendingPassiveEffects !== null);

  //!如果当前没有renderContext 也没有CommitContext表示不应该来到这里
  if (
    !((getExecutionContext() & (RenderContext | CommitContext)) === NoContext)
  ) {
    throw Error("Should not already be working.");
  }

  const finishedWork = root.finishedWork; //!获取刚刚完成render阶段的workInProgress根节点
  const lanes = root.finishedLanes; //!获取完成render阶段的lanes

  //!如果为null表示没有完成不执行commit阶段
  if (finishedWork === null) {
    return null;
  }

  //!初始化
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  //!如果current和workInProgress相同 不能进入commit阶段
  if (!(finishedWork !== root.current)) {
    throw Error(
      "Cannot commit the same tree as before. This error is likely caused by a bug in React. Please file an issue."
    );
  }

  root.callbackNode = null;
  let remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes);
  markRootFinished(root, remainingLanes);

  let firstEffect;

  //!如果当前的finishedWork被标记了 需要做操作也要加入effect链
  if (finishedWork.flags > PerformedWork) {
    //!最后一个指针部位null直接在尾部添加
    if (finishedWork.lastEffect !== null) {
      finishedWork.lastEffect.nextEffect = finishedWork;
      firstEffect = finishedWork.firstEffect;
    }
    //!否则让第一个指向当前任务
    else {
      firstEffect = finishedWork;
    }
  }
  //!如果当前让你无不需要做 则让第一个副作用指针指向work.firstEffect
  else {
    firstEffect = finishedWork.firstEffect;
  }

  //!如果有副作用 开始执行commit核心操作
  if (firstEffect !== null) {
    const prevExecutionContext = getExecutionContext();
    setExecutionContext(prevExecutionContext | CommitContext); //!标记当前为commit阶段

    window.nextEffect = firstEffect;

    //!before mutation阶段---
    //!主要是执行getSnapshotBeforeUpdate 还有对于Function组件 调用effect

    do {
      commitBeforeMutationEffects(root, renderPriorityLevel);
    } while (window.nextEffect !== null);

    //!第二次遍历
    window.nextEffect = firstEffect;

    //!mutation：
    //!主要是针对之前打上的Placement Deletion Update做不同的更新 例如Placement做插入操作
    //!Deletion做删除操作 对于卸载来说又需要深度优先遍历所有节点 类组件和函数组件需要调用生命周期函数(componentWillUnmount)
    //!host节点需要调用detachRef消除ref Update又需要通过hostFiber.updateQueue缓存complete阶段得到的propertiesDiff属性
    //!进行属性的更新
    do {
      commitMutationEffects(root, renderPriorityLevel);
    } while (window.nextEffect !== null);

    //!第二阶段完成后让当前的workInProgress变为current
    root.current = finishedWork;

    //!重置 便于第三次遍历
    window.nextEffect = firstEffect;

    //!进入第三阶段
    //!layout：在DOM操作完成后，读取组件的状态，针对类组件，调用生命周期componentDidMount和componentDidUpdate，
    //!调用setState的回调；针对函数组件填充useEffect 的 effect执行数组，并调度useEffect 将ref赋值真实DOM
    do {
      commitLayoutEffects(root, lanes);
    } while (window.nextEffect !== null);

    window.nextEffect = null;

    Scheduler_requestPaint();
    setExecutionContext(prevExecutionContext);
  }
  //!如果没有副作用 将finishedWork变为current即可
  else {
    root.current = finishedWork;
  }

  //!判断当前是否调度了flushPassiveEffects函数
  if (window.rootDoesHavePassiveEffects) {
    window.rootDoesHavePassiveEffects = false;
    window.rootWithPendingPassiveEffects = root;
    window.pendingPassiveEffectsLanes = lanes;
    window.pendingPassiveEffectsRenderPriority = renderPriorityLevel;
  } else {
    window.nextEffect = firstEffect;

    while (window.nextEffect !== null) {
      const nextNextEffect = window.nextEffect.nextEffect;
      window.nextEffect.nextEffect = null;

      //!当没有副作用之后清空副作用链
      if (window.nextEffect.flags & Deletion) {
        detachFiberAfterEffects(window.nextEffect);
      }

      window.nextEffect = nextNextEffect;
    }
  }

  remainingLanes = root.pendingLanes;

  ensureRootIsScheduled(root, now());

  //!如果是LegacyUnbatchedContext模式 直接结束 就是通过render方法进来的
  if ((getExecutionContext & LegacyUnbatchedContext) !== NoContext) {
    return null;
  }
  //!Concurrent模式
  //   flushSyncCallbackQueue();

  return null;
}

//!删除除了remainingLanes所有lanes
function markRootFinished(root, remainingLanes) {
  const noLongerPendingLanes = root.pendingLanes & ~remainingLanes;
  root.pendingLanes = remainingLanes; // Let's try everything again

  root.suspendedLanes = 0;
  root.pingedLanes = 0;
  root.expiredLanes &= remainingLanes;
  root.mutableReadLanes &= remainingLanes;
  root.entangledLanes &= remainingLanes;
  let entanglements = root.entanglements;
  let eventTimes = root.eventTimes;
  let expirationTimes = root.expirationTimes; // Clear the lanes that no longer have pending work

  let lanes = noLongerPendingLanes;

  //!将所有置为0
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;
    entanglements[index] = NoLanes;
    eventTimes[index] = NoTimestamp;
    expirationTimes[index] = NoTimestamp;
    lanes &= ~lane;
  }
}

function commitBeforeMutationEffects() {
  while (window.nextEffect !== null) {
    const current = window.nextEffect.alternate;

    const flags = window.nextEffect.flags;

    if ((flags & Snapshot) !== NoFlags) {
      setCurrentFiber(window.nextEffect);
      commitBeforeMutationLifeCycles(current, window.nextEffect);
      resetCurrentFiber();
    }
    //!这里是真正调度effect的开始因为rootDoesHavePassiveEffects的限制 只会发起一次调度
    if ((flags & Passive) !== NoFlags) {
      //!passive与函数组件的hooks有关
      if (!window.rootDoesHavePassiveEffects) {
        window.rootDoesHavePassiveEffects = true;
        scheduleCallback(NormalPriority$1, function () {
          //!这个函数是调用hooks
          flushPassiveEffects();
          return null;
        });
      }
    }

    window.nextEffect = window.nextEffect.nextEffect;
  }
}

//!创建已经提醒的集合
let didWarnAboutUndefinedSnapshotBeforeUpdate = new Set();
function commitBeforeMutationLifeCycles(current, finishedWork) {
  switch (finishedWork.tag) {
    case FunctionComponent: {
      return;
    }
    case ClassComponent: {
      if (finishedWork.flags & Snapshot) {
        if (current !== null) {
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          const instance = finishedWork.stateNode; //!获取实例

          if (finishedWork.type === finishedWork.elementType) {
            if (instance.props !== finishedWork.memoizedProps) {
              console.error(
                "Expected %s props to match memoized props before " +
                  "getSnapshotBeforeUpdate. " +
                  "This might either be because of a bug in React, or because " +
                  "a component reassigns its own `this.props`. " +
                  "Please file an issue.",
                getComponentName(finishedWork.type) || "instance"
              );
            }

            if (instance.state !== finishedWork.memoizedState) {
              console.error(
                "Expected %s state to match memoized state before " +
                  "getSnapshotBeforeUpdate. " +
                  "This might either be because of a bug in React, or because " +
                  "a component reassigns its own `this.state`. " +
                  "Please file an issue.",
                getComponentName(finishedWork.type) || "instance"
              );
            }
          }

          const snapshot = instance.getSnapshotBeforeUpdate(
            finishedWork.elementType === finishedWork.type
              ? prevProps
              : resolveDefaultProps(finishedWork.type, prevProps),
            prevState
          );

          const didWarnSet = didWarnAboutUndefinedSnapshotBeforeUpdate;

          if (snapshot === undefined && !didWarnSet.has(finishedWork.type)) {
            didWarnSet.add(finishedWork.type);

            console.error(
              "%s.getSnapshotBeforeUpdate(): A snapshot value (or null) " +
                "must be returned. You have returned undefined.",
              getComponentName(finishedWork.type)
            );
          }

          //!给实例 new App() 绑定上snapshot函数
          instance.__reactInternalSnapshotBeforeUpdate = snapshot;
        }
      }

      return;
    }

    case HostRoot: {
      if (finishedWork.flags & Snapshot) {
        const root = finishedWork.stateNode;
        clearContainer(root.containerInfo);
      }
      return;
    }

    case HostComponent:
    case HostText:
      return;
    default:
  }

  throw Error(
    "This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue."
  );
}

function getComponentName(type) {
  if (type == null) {
    return null;
  }
  if (typeof type.tag === "number") {
    console.error(
      "Received an unexpected object in getComponentName(). " +
        "This is likely a bug in React. Please file an issue."
    );
  }
  if (typeof type === "function") {
    return type.displayName || type.name || null;
  }

  if (typeof type === "string") {
    return type;
  }
  return null;
}

//!通过副作用打上的标记 执行不用的更新 插入 删除等逻辑
function commitMutationEffects(root, renderPriorityLevel) {
  while (window.nextEffect !== null) {
    setCurrentFiber(window.nextEffect);
    const flags = window.nextEffect.flags;

    //!这个表示内容需要重设 例如由文字节点变为普通节点就需要删除
    if (flags & ContentReset) {
      commitResetTextContent(window.nextEffect);
    }

    //!这个表示有ref属性更新
    if (flags & Ref) {
      const current = window.nextEffect.alternate;

      //!清除之前的ref
      if (current !== null) {
        commitDetachRef(current);
      }
    }
    const primaryFlags = flags & (Placement | Update | Deletion);

    switch (primaryFlags) {
      //!diff算法中会被标记插入 组件的创建 dom的移动
      case Placement:
        commitPlacement(window.nextEffect);

        window.nextEffect.flags &= ~Placement; //!删除当前effect的Placement标识
        break;

      case PlacementAndUpdate: {
        commitPlacement(window.nextEffect);

        window.nextEffect.flags &= ~Placement;

        const current = window.nextEffect.alternate;
        commitWork(current, window.nextEffect);
        break;
      }
      //!text的改变 propertyDiff产生的更新 自动聚焦更新 调用componentDidMount componentDidUpdate
      case Update: {
        const current = window.nextEffect.alternate;
        commitWork(current, window.nextEffect); //!这里没有删除Update标志后续还有操作
        break;
      }
      //!在diff算法中又减少的元素会被标记为Deletion
      case Deletion: {
        commitDeletion(root, window.nextEffect);
        break;
      }
      default:
    }

    resetCurrentFiber();
    //!继续遍历下一个
    window.nextEffect = window.nextEffect.nextEffect;
  }
}

function clearContainer(container) {
  if (container.nodeType === ELEMENT_NODE) {
    container.textContent = "";
  } else if (container.nodeType === DOCUMENT_NODE) {
    const body = container.body;
    if (body != null) {
      body.textContent = "";
    }
  }
}

function commitResetTextContent(current) {
  resetTextContent(current.stateNode);
}
function resetTextContent(domElement) {
  setTextContent(domElement, "");
}

//!多个节点是不会设置的
export function setTextContent(node, text) {
  if (text) {
    //!获得节点的第一个子节点
    const firstChild = node.firstChild;
    //!如果当前只有一个节点将第一个节点的值设置为text
    if (
      firstChild &&
      firstChild === node.lastChild &&
      firstChild.nodeType === TEXT_NODE
    ) {
      firstChild.nodeValue = text;
      return;
    }
  }

  //!如果没有节点直接设置
  node.textContent = text;
}

//!清除之前的ref
function commitDetachRef(current) {
  const currentRef = current.ref;

  if (currentRef !== null) {
    if (typeof currentRef === "function") {
      currentRef(null);
    } else {
      currentRef.current = null;
    }
  }
}

//!插入新元素
function commitPlacement(finishedWork) {
  //!有可能父节点是class类的实例 需要找到真正的DOM树上的父节点
  const parentFiber = getHostParentFiber(finishedWork); //!获取当前节点的父节点

  let parent;
  let isContainer;
  let parentStateNode = parentFiber.stateNode; //!获取父节点的DOM

  switch (parentFiber.tag) {
    case HostComponent:
      parent = parentStateNode;
      isContainer = false;
      break;

    case HostRoot:
      parent = parentStateNode.containerInfo;
      isContainer = true; //!根fiber
      break;
    default:
      throw Error(
        "Invalid host parent fiber. This error is likely caused by a bug in React. Please file an issue."
      );
  }

  if (parentFiber.flags & ContentReset) {
    resetTextContent(parent);
    //!删除这个标识
    parentFiber.flags &= ~ContentReset;
  }

  const before = getHostSibling(finishedWork);

  //!如果是container 也就是div=root
  if (isContainer) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent);
  }
  //!否则是普通的元素插入
  else {
    insertOrAppendPlacementNode(finishedWork, before, parent);
  }
}

//!获取host父fiber
function getHostParentFiber(fiber) {
  let parent = fiber.return;

  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }

  throw Error(
    "Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue."
  );
}

//!判断是否是Host类型的fiber 只要是HostComponent或则HostRoot则一定有对应的DOM节点
function isHostParent(fiber) {
  return fiber.tag === HostComponent || fiber.tag === HostRoot;
}

//!这个函数其实是找我要插入的节点（finishedWork）的下一个dom节点，因为我要插在这个节点前面。
//!所以这个函数做的事情就是：剔除掉所有的非原始dom节点，找到我想要的dom节点。
function getHostSibling(fiber) {
  let node = fiber;

  siblings: while (true) {
    //!如果没有兄弟节点，向上查找父节点，但是这个父节点不能是原生dom节点
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;

    //!如果当前不是host节点
    while (node.tag !== HostComponent && node.tag !== HostText) {
      //!兄弟节点也是将要插入的节点，跳过这个节点查找下一个兄弟节点
      if (node.flags & Placement) {
        continue siblings;
      }
      //!排除没有child的节点
      if (node.child === null) {
        continue siblings;
      }
      //!进入这个非host节点的子节点
      else {
        node.child.return = node;
        node = node.child;
      }
    }

    //!如果当前这个节点不是插入节点 则找到了
    if (!(node.flags & Placement)) {
      // Found it!
      return node.stateNode;
    }
  }
}

//!添加或插入元素
function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
  const tag = node.tag;
  const isHost = tag === HostComponent || tag === HostText;

  //!当前是host元素
  if (isHost) {
    const stateNode = isHost ? node.stateNode : node.stateNode.instance;

    //!如果有before插入到before之前
    if (before) {
      insertInContainerBefore(parent, stateNode, before);
    }
    //!如果没有直接添加
    else {
      appendChildToContainer(parent, stateNode);
    }
  }
  //!不是host元素
  else {
    //!例如App组件元素 拿到他的child
    const child = node.child;

    if (child !== null) {
      //!插入
      insertOrAppendPlacementNodeIntoContainer(child, before, parent);
      let sibling = child.sibling;

      //!如果有兄弟元素也全部插入 应该是为了插入Fragment节点 因为一般来说 组件的child只有一个
      while (sibling !== null) {
        insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

//!添加元素
function appendChildToContainer(container, child) {
  let parentNode;

  if (container.nodeType === COMMENT_NODE) {
    parentNode = container.parentNode;
    parentNode.insertBefore(child, container);
  } else {
    parentNode = container;
    parentNode.appendChild(child);
  }
}

//!插入元素
function insertInContainerBefore(container, child, beforeChild) {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode.insertBefore(child, beforeChild);
  } else {
    container.insertBefore(child, beforeChild);
  }
}

function insertOrAppendPlacementNode(node, before, parent) {
  var tag = node.tag;
  var isHost = tag === HostComponent || tag === HostText;

  if (isHost) {
    var stateNode = isHost ? node.stateNode : node.stateNode.instance;

    if (before) {
      insertBefore(parent, stateNode, before);
    } else {
      appendChild(parent, stateNode);
    }
  } else {
    var child = node.child;

    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent);
      var sibling = child.sibling;

      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

//!ABC中C插入到A之前 变为CAB 传入C元素和A元素 相当于移动C元素到A之前
function insertBefore(parentInstance, child, beforeChild) {
  parentInstance.insertBefore(child, beforeChild);
}

function appendChild(parentInstance, child) {
  parentInstance.appendChild(child);
}

function commitDeletion(finishedRoot, current, renderPriorityLevel) {
  //!这里是卸载DOM和卸载组件调用生命周期
  unmountHostComponents(finishedRoot, current);

  const alternate = current.alternate;
  //!同时还需要删除对应的fiber
  detachFiberMutation(current);

  if (alternate !== null) {
    detachFiberMutation(alternate);
  }
}

function unmountHostComponents(finishedRoot, current, renderPriorityLevel) {
  let node = current;
  let currentParentIsValid = false; // Note: these two variables *must* always be updated together.
  let currentParent;
  let currentParentIsContainer;

  while (true) {
    //!经过这个循环就找到了真正的父fiber 保存在currentParent 只执行一次 这个循环
    if (!currentParentIsValid) {
      //!父节点可能是一个 App组件节点 需要找到有真实DOM的父节点的fiber
      let parent = node.return;

      findParent: while (true) {
        if (!(parent !== null)) {
          throw Error(
            "Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue."
          );
        }

        let parentStateNode = parent.stateNode;

        switch (parent.tag) {
          case HostComponent:
            currentParent = parentStateNode;
            currentParentIsContainer = false;
            break findParent;

          case HostRoot:
            currentParent = parentStateNode.containerInfo;
            currentParentIsContainer = true;
            break findParent;
          default:
        }
        parent = parent.return;
      }

      currentParentIsValid = true;
    }

    //!对于卸载来说 卸载一个节点 他的子节点可能有组件需要调用卸载的声明周期函数
    if (node.tag === HostComponent || node.tag === HostText) {
      //!调用这个函数递归卸载组件 然后才能卸载DOM
      commitNestedUnmounts(finishedRoot, node);

      //!走到这里就可以安全的卸载DOM了
      if (currentParentIsContainer) {
        removeChildFromContainer(currentParent, node.stateNode);
      } else {
        removeChild(currentParent, node.stateNode);
      }
    }
    //!走到这里表示 这是一个组件的卸载 需要调用相应的声明周期函数
    else {
      //!组件的child可能也有组件 所以也需要全部遍历一次在卸载DOM
      commitUnmount(finishedRoot, node);

      if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
    }

    if (node === current) {
      return;
    }

    //!这里主要是为了处理卸载的是一个组件 卸载组件 先卸载本身然后找到child 如果child还是组件 再走一次这个逻辑
    //!然后在找child 假设此时child编程了host类型 那么走第一个if语句 这个时候当前这个child可以被直接卸载掉 但是
    //!这个节点可能有兄弟节点此时 就需要 在遍历兄弟节点在一个一个删除
    while (node.sibling === null) {
      if (node.return === null || node.return === current) {
        return;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}

//!卸载的时候可能会遇到组件节点需要执行声明周期函数在卸载
function commitNestedUnmounts(finishedRoot, root, renderPriorityLevel) {
  let node = root;

  //!深度优先遍历 主要是为了卸载组件 对于host节点 卸载ref即可
  while (true) {
    commitUnmount(finishedRoot, node);

    //!以下代码是深度优先遍历 遍历到root为止
    if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === root) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }

      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function commitUnmount(finishedRoot, current, renderPriorityLevel) {
  switch (current.tag) {
    //!如果是class组件 调用componentWillUnmount函数 组件走了卸载流程才可以真的卸载DOM
    case FunctionComponent:
    case ClassComponent:
      safelyDetachRef(current);
      const instance = current.stateNode;
      if (typeof instance.componentWillUnmount === "function") {
        safelyCallComponentWillUnmount(current, instance);
      }
      return;
    case HostComponent: {
      safelyDetachRef(current);
      return;
    }
    default:
  }
}

//!加了safely的就是包裹了一层invokeGuardedCallback 简单的说就是包裹了一层try catch
//!有错的话会抛出为了简要就取消这个包裹了 这个钩子有用户执行的代码 所以需要包一层
//!防止用户的代码出错影响了整个react的进程
function safelyDetachRef(current) {
  commitDetachRef(current);
}

//!安全地调用componentWillUnmount
function safelyCallComponentWillUnmount(current, instance) {
  callComponentWillUnmountWithTimer(current, instance);
}

function callComponentWillUnmountWithTimer(current, instance) {
  //!卸载之前赋值给实例
  instance.props = current.memoizedProps;
  instance.state = current.memoizedState;
  instance.componentWillUnmount();
}

function removeChildFromContainer(container, child) {
  if (container.nodeType === COMMENT_NODE) {
    container.parentNode.removeChild(child);
  } else {
    container.removeChild(child);
  }
}

//!重父DOM移除
function removeChild(parentInstance, child) {
  parentInstance.removeChild(child);
}

//!只是清楚了这个fiber的所有链接 但是其他fiber依然可以指向它
function detachFiberMutation(fiber) {
  fiber.alternate = null;
  fiber.child = null;
  fiber.dependencies = null;
  fiber.firstEffect = null;
  fiber.lastEffect = null;
  fiber.memoizedProps = null;
  fiber.memoizedState = null;
  fiber.pendingProps = null;
  fiber.return = null;
  fiber.updateQueue = null;
}

//!current是指effect链 更新操作Update
function commitWork(current, finishedWork) {
  switch (finishedWork.tag) {
    //!函数组件和类组件不更新
    case FunctionComponent:
    case ClassComponent: {
      return;
    }
    case HostComponent: {
      const instance = finishedWork.stateNode;
      if (instance != null) {
        const newProps = finishedWork.memoizedProps;
        const oldProps = current !== null ? current.memoizedProps : newProps;
        const type = finishedWork.type;
        const updatePayload = finishedWork.updateQueue;
        finishedWork.updateQueue = null;
        //!在complete阶段对比的结果会放到updateQueue中
        if (updatePayload !== null) {
          commitUpdate(instance, updatePayload, type, oldProps, newProps);
        }
      }
      return;
    }
    case HostText: {
      if (!(finishedWork.stateNode !== null)) {
        throw Error(
          "This should have a text node initialized. This error is likely caused by a bug in React. Please file an issue."
        );
      }

      const textInstance = finishedWork.stateNode;
      const newText = finishedWork.memoizedProps;
      const oldText = current !== null ? current.memoizedProps : newText;
      commitTextUpdate(textInstance, oldText, newText);
      return;
    }
    case HostRoot: {
      return;
    }
    default:
  }

  throw Error(
    "This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue."
  );
}

function commitUpdate(domElement, updatePayload, type, oldProps, newProps) {
  updateFiberProps(domElement, newProps);
  updateProperties(domElement, updatePayload, type, oldProps, newProps);
}

function updateProperties(
  domElement,
  updatePayload,
  tag,
  lastRawProps,
  nextRawProps
) {
  updateDOMProperties(domElement, updatePayload);
}

function updateDOMProperties(domElement, updatePayload) {
  //![key,value]
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i];
    const propValue = updatePayload[i + 1];

    if (propKey === STYLE) {
      setValueForStyles(domElement, propValue);
    } else if (propKey === CHILDREN) {
      setTextContent(domElement, propValue);
    } else {
      setValueForProperty(domElement, propKey, propValue);
    }
  }
}

function commitTextUpdate(textInstance, oldText, newText) {
  textInstance.nodeValue = newText;
}

function commitLayoutEffects(root, committedLanes) {
  while (window.nextEffect !== null) {
    setCurrentFiber(window.nextEffect);
    const flags = window.nextEffect.flags;

    //!如果有更新或则setState传入了callback函数 在这里调用
    if (flags & (Update | Callback)) {
      const current = window.nextEffect.alternate;
      commitLifeCycles(root, current, window.nextEffect);
    }

    if (flags & Ref) {
      commitAttachRef(window.nextEffect);
    }

    resetCurrentFiber();
    window.nextEffect = window.nextEffect.nextEffect;
  }
}

window.rootDoesHavePassiveEffects = false;
window.rootWithPendingPassiveEffects = null;
window.pendingPassiveEffectsRenderPriority = NoPriority$1;
window.pendingPassiveEffectsLanes = NoLanes;
window.pendingPassiveHookEffectsMount = [];
window.pendingPassiveHookEffectsUnmount = [];
window.rootsWithPendingDiscreteUpdates = null;

/**
 *
 * @param {*} finishedRoot
 * @param {*} current 就是current
 * @param {*} finishedWork nextEffect 副作用链
 * @param {*} committedLanes hostRoot节点
 * @returns
 */
function commitLifeCycles(finishedRoot, current, finishedWork, committedLanes) {
  switch (finishedWork.tag) {
    //!对于函数式组件调用useEffect
    case FunctionComponent: {
      //!用于执行useLayoutEffect 它是同步执行的 阻塞渲染
      // commitHookEffectListMount(Layout | hasEffect, finishedWork);
      //!填充effect执行数组 异步执行
      schedulePassiveEffects(finishedWork);
      return;
    }
    case ClassComponent: {
      const instance = finishedWork.stateNode;

      if (finishedWork.flags & Update) {
        //!这是第一次挂载render
        if (current === null) {
          if (finishedWork.type === finishedWork.elementType) {
            if (instance.props !== finishedWork.memoizedProps) {
              console.error(
                "Expected %s props to match memoized props before " +
                  "componentDidMount. " +
                  "This might either be because of a bug in React, or because " +
                  "a component reassigns its own `this.props`. " +
                  "Please file an issue.",
                getComponentName(finishedWork.type) || "instance"
              );
            }

            if (instance.state !== finishedWork.memoizedState) {
              console.error(
                "Expected %s state to match memoized state before " +
                  "componentDidMount. " +
                  "This might either be because of a bug in React, or because " +
                  "a component reassigns its own `this.state`. " +
                  "Please file an issue.",
                getComponentName(finishedWork.type) || "instance"
              );
            }
          }
          //!第一次挂载就调用didMount
          instance.componentDidMount();
        }
        //!已经有current了 这是更新
        else {
          const prevProps =
            finishedWork.elementType === finishedWork.type
              ? current.memoizedProps
              : resolveDefaultProps(finishedWork.type, current.memoizedProps);
          const prevState = current.memoizedState;

          if (finishedWork.type === finishedWork.elementType) {
            if (instance.props !== finishedWork.memoizedProps) {
              console.error(
                "Expected %s props to match memoized props before " +
                  "componentDidUpdate. " +
                  "This might either be because of a bug in React, or because " +
                  "a component reassigns its own `this.props`. " +
                  "Please file an issue.",
                getComponentName(finishedWork.type) || "instance"
              );
            }

            if (instance.state !== finishedWork.memoizedState) {
              console.error(
                "Expected %s state to match memoized state before " +
                  "componentDidUpdate. " +
                  "This might either be because of a bug in React, or because " +
                  "a component reassigns its own `this.state`. " +
                  "Please file an issue.",
                getComponentName(finishedWork.type) || "instance"
              );
            }
          }

          //!更新就调用componentDidUpdate 同时传入snapshot的返回值
          instance.componentDidUpdate(
            prevProps,
            prevState,
            instance.__reactInternalSnapshotBeforeUpdate //!snapshot执行的返回值
          );
        }
      }

      const updateQueue = finishedWork.updateQueue;

      if (updateQueue !== null) {
        if (finishedWork.type === finishedWork.elementType) {
          if (instance.props !== finishedWork.memoizedProps) {
            console.error(
              "Expected %s props to match memoized props before " +
                "processing the update queue. " +
                "This might either be because of a bug in React, or because " +
                "a component reassigns its own `this.props`. " +
                "Please file an issue.",
              getComponentName(finishedWork.type) || "instance"
            );
          }

          if (instance.state !== finishedWork.memoizedState) {
            console.error(
              "Expected %s state to match memoized state before " +
                "processing the update queue. " +
                "This might either be because of a bug in React, or because " +
                "a component reassigns its own `this.state`. " +
                "Please file an issue.",
              getComponentName(finishedWork.type) || "instance"
            );
          }
        }
        //!执行所有的callback函数
        commitUpdateQueue(finishedWork, updateQueue, instance);
      }

      return;
    }

    case HostRoot: {
      const updateQueue = finishedWork.updateQueue;

      if (updateQueue !== null) {
        let instance = null;

        if (finishedWork.child !== null) {
          switch (finishedWork.child.tag) {
            case HostComponent:
              instance = getPublicInstance(finishedWork.child.stateNode); //!这个是DOM
              break;

            case ClassComponent:
              instance = finishedWork.child.stateNode; //!这个是类实例
              break;
            default:
          }
        }

        commitUpdateQueue(finishedWork, updateQueue, instance);
      }

      return;
    }

    case HostComponent: {
      const instance = finishedWork.stateNode;

      if (current === null && finishedWork.flags & Update) {
        const type = finishedWork.type;
        const props = finishedWork.memoizedProps;
        //!判断是否需要聚焦 如果需要 执行domElement.focus()
        commitMount(instance, type, props);
      }

      return;
    }

    case HostText: {
      return;
    }
    default:
  }

  throw Error(
    "This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue."
  );
}

function commitHookEffectListMount(tag, finishedWork) {
  const updateQueue = finishedWork.updateQueue; //!获取当前fiber的更新队列
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;

  //!循环副作用链 执行所有的effect 并将destroy赋值
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;

    do {
      //!被表示了hasEffect
      if ((effect.tag & tag) === tag) {
        const create = effect.create; //!获取副作用函数
        effect.destroy = create(); //!获取毁灭函数

        const destroy = effect.destroy;

        if (destroy !== undefined && typeof destroy !== "function") {
          let addendum = void 0;

          //!不能返回null
          if (destroy === null) {
            addendum =
              " You returned null. If your effect does not require clean " +
              "up, return undefined (or nothing).";
          }
          //!如果返回promise
          else if (typeof destroy.then === "function") {
            addendum =
              "\n\nIt looks like you wrote useEffect(async () => ...) or returned a Promise. " +
              "Instead, write the async function inside your effect " +
              "and call it immediately:\n\n" +
              "useEffect(() => {\n" +
              "  async function fetchData() {\n" +
              "    // You can await here\n" +
              "    const response = await MyAPI.getData(someId);\n" +
              "    // ...\n" +
              "  }\n" +
              "  fetchData();\n" +
              "}, [someId]); // Or [] if effect doesn't need props or state\n\n" +
              "Learn more about data fetching with Hooks: https://reactjs.org/link/hooks-data-fetching";
          } else {
            addendum = " You returned: " + destroy;
          }

          console.error(
            "An effect function must not return anything besides a function, " +
              "which is used for clean-up.%s",
            addendum
          );
        }
      }

      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

function schedulePassiveEffects(finishedWork) {
  const updateQueue = finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;

  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;

    do {
      const _effect = effect,
        next = _effect.next,
        tag = _effect.tag;

      //!如果当前tag被标记了Passive$1和hasEffect (只要是使用了useEffect都会有这个标记)
      //!对于使用了useEffect的函数组件 遍历updateQueue链 放入PassiveHookEffect
      if ((tag & Passive$1) !== NoFlags$1 && (tag & hasEffect) !== NoFlags$1) {
        enqueuePendingPassiveHookEffectUnmount(finishedWork, effect);
        enqueuePendingPassiveHookEffectMount(finishedWork, effect);
      }

      effect = next;
    } while (effect !== firstEffect);
  }
}

function enqueuePendingPassiveHookEffectUnmount(fiber, effect) {
  window.pendingPassiveHookEffectsUnmount.push(effect, fiber);

  fiber.flags |= PassiveUnmountPendingDev; //!添加卸载标识
  const alternate = fiber.alternate;

  if (alternate !== null) {
    alternate.flags |= PassiveUnmountPendingDev;
  }

  //!由于rootDoesHavePassiveEffects的原因 这个调度只会发起一次 互斥的
  if (!window.rootDoesHavePassiveEffects) {
    window.rootDoesHavePassiveEffects = true;
    //!这里传入react事件优先级
    scheduleCallback(NormalPriority$1, function () {
      flushPassiveEffects();
      return null;
    });
  }
}

function enqueuePendingPassiveHookEffectMount(fiber, effect) {
  window.pendingPassiveHookEffectsMount.push(effect, fiber);

  if (!window.rootDoesHavePassiveEffects) {
    window.rootDoesHavePassiveEffects = true;
    scheduleCallback(NormalPriority$1, function () {
      flushPassiveEffects();
      return null;
    });
  }
}

function commitMount(domElement, type, newProps, internalInstanceHandle) {
  if (shouldAutoFocusHostComponent(type, newProps)) {
    domElement.focus();
  }
}

function getPublicInstance(instance) {
  return instance;
}

//!调用effects链 setState的callback函数
function commitUpdateQueue(finishedWork, finishedQueue, instance) {
  const effects = finishedQueue.effects;
  finishedQueue.effects = null;

  if (effects !== null) {
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      const callback = effect.callback;

      if (callback !== null) {
        effect.callback = null;
        callCallback(callback, instance);
      }
    }
  }
}

function callCallback(callback, context) {
  if (!(typeof callback === "function")) {
    throw Error(
      "Invalid argument passed as callback. Expected a function. Instead received: " +
        callback
    );
  }

  callback.call(context);
}

//!将DOM传入ref.current中
function commitAttachRef(finishedWork) {
  const ref = finishedWork.ref;

  if (ref !== null) {
    const instance = finishedWork.stateNode;
    let instanceToUse;

    switch (finishedWork.tag) {
      case HostComponent:
        instanceToUse = getPublicInstance(instance);
        break;
      default:
        instanceToUse = instance;
    }

    if (typeof ref === "function") {
      ref(instanceToUse);
    } else {
      if (!ref.hasOwnProperty("current")) {
        console.error(
          "Unexpected ref object provided for %s. " +
            "Use either a ref-setter function or React.createRef().",
          getComponentName(finishedWork.type)
        );
      }

      ref.current = instanceToUse;
    }
  }
}
