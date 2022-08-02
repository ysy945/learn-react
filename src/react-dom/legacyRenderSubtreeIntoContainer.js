import createFiberRoot from "./createFiberRoot";
import listenToAllSupportedEvents from "./listenToAllSupportedEvents";
import {
  internalContainerInstanceKey,
  BatchedContext,
  LegacyUnbatchedContext,
  NoContext,
} from "./react-dom-types";
import { requestEventTime, requestUpdateLane } from "./fiberUtils";
import getContextForSubtree from "./context/getContextForSubtree";
import createUpdate from "./updateQueue/createUpdate";
import enqueueUpdate from "./updateQueue/enqueueUpdate";
import scheduleUpdateOnFiber from "./scheduleUpdateOnFiber";

let executionContext = NoContext; //0

export function setExecutionContext(context) {
  executionContext = context;
}

export function getExecutionContext() {
  return executionContext;
}

function legacyRenderSubtreeIntoContainer(
  parentComponent,
  children,
  container,
  callback
) {
  let root = container._reactRootContainer;
  let fiberRoot;

  //!第一次挂载 初始化一下
  if (!root) {
    root = container._reactRootContainer = createLegacyRoot(container);

    fiberRoot = root._internalRoot;

    unBatchedUpdates(function () {
      updateContainer(children, fiberRoot, parentComponent, callback);
    });
  }
}

function unBatchedUpdates(fn) {
  let prevExecutionContext = executionContext;
  //!去除BatchedContext
  executionContext &= ~BatchedContext;
  //!添加LegacyUnbatchedContext 同步的unBatch
  executionContext |= LegacyUnbatchedContext;

  try {
    return fn();
  } finally {
    //!执行完后更改上下文
    executionContext = prevExecutionContext;
  }
}

function createLegacyRoot(container) {
  return new ReactDOMBlockingRoot(container);
}

class ReactDOMBlockingRoot {
  constructor(container) {
    this._internalRoot = createRootImpl(container);
  }
}

function createRootImpl(container) {
  //! 创建fiberRoot
  const root = createFiberRoot(container);
  //!将fiber节点与container建立关系
  markContainerAsRoot(root.current, container);

  //!做事件监听
  listenToAllSupportedEvents(container);

  return root;
}

function markContainerAsRoot(hostRoot, node) {
  node[internalContainerInstanceKey] = hostRoot;
}

/**
 *
 * @param {*} element 子虚拟DOM
 * @param {*} container 更新的fiber
 * @param {*} parentComponent //父组件
 * @param {*} callback //更新完成的回调函数
 */
function updateContainer(element, container, parentComponent, callback) {
  const current = container.current;
  //!获取请求时间
  const eventTime = requestEventTime();
  //!获取当前更新的优先级
  const lane = requestUpdateLane(current);
  //!获取父组件的context
  const context = getContextForSubtree(parentComponent);
  if (container.context === null) {
    container.context = context;
  } else {
    container.pendingContext = context;
  }
  const update = createUpdate(eventTime, lane);

  //!本次更新需要的依赖 对象 函数等
  update.payload = {
    element: element,
  };

  //!处理callback
  callback = callback === undefined ? null : callback;

  if (callback !== null) {
    if (typeof callback !== "function") {
      throw new Error(
        "render(...): Expected the last optional `callback` argument to be a " +
          "function. Instead received: %s.",
        callback
      );
    }

    update.callback = callback;
  }

  //!将本次的更新放入队列当中
  enqueueUpdate(current, update);
  //!调度update更新
  scheduleUpdateOnFiber(current, lane, eventTime);
  //!返回当前优先级
  return lane;
}

export default legacyRenderSubtreeIntoContainer;
