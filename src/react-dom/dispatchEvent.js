import {
  TEXT_NODE,
  internalInstanceKey,
  HostComponent,
  EventContext,
} from "./react-dom-types";
import {
  SyntheticEvent,
  SyntheticKeyboardEvent,
  SyntheticMouseEvent,
} from "./event";
import { IS_CAPTURE_PHASE } from "./react-dom-types";
import { getFiberCurrentPropsFromNode } from "./fiberUtils";
import {
  getExecutionContext,
  setExecutionContext,
} from "./legacyRenderSubtreeIntoContainer";
console.log(SyntheticEvent);
let isBatchingEventUpdates = false;
const topLevelEventsToReactNames = new Map();
topLevelEventsToReactNames.set("click", "onClick");
topLevelEventsToReactNames.set("keyup", "onKeyUp");
topLevelEventsToReactNames.set("keydown", "onKeyDown");
topLevelEventsToReactNames.set("mousedown", "onMouseDown");
topLevelEventsToReactNames.set("mouseup", "onMouseUp");
//!派发事件
export default function dispatchEvent(
  domEventName,
  eventSystemFlags,
  targetContainer,
  nativeEvent
) {
  const nativeEventTarget = getEventTarget(nativeEvent);
  const targetInst = getClosestInstanceFromNode(nativeEventTarget);

  return dispatchEventForPluginEventSystem(
    domEventName,
    eventSystemFlags,
    nativeEvent,
    targetInst,
    targetContainer
  );
}

//!获取事件源
function getEventTarget(nativeEvent) {
  const target = nativeEvent.target;
  return target.nodeType === TEXT_NODE ? target.parentNode : target;
}

//!获取事件源对应的fiber
function getClosestInstanceFromNode(targetNode) {
  const targetInst = targetNode[internalInstanceKey];
  if (targetInst) {
    //!不允许返回root节点 和 suspense节点
    return targetInst;
  }
  return null;
}

function dispatchEventForPluginEventSystem(
  domEventName,
  eventSystemFlags,
  nativeEvent,
  targetInst,
  targetContainer
) {
  const ancestorInst = targetInst;
  batchedEventUpdates(function () {
    return dispatchEventsForPlugins(
      domEventName,
      eventSystemFlags,
      nativeEvent,
      ancestorInst
    );
  });
}

function batchedEventUpdates(fn, a, b) {
  if (isBatchingEventUpdates) {
    // If we are currently inside another batch, we need to wait until it
    // fully completes before restoring state.
    return fn(a, b);
  }

  isBatchingEventUpdates = true;
  const prevExecutionContext = getExecutionContext();
  try {
    // return batchedEventUpdatesImpl(fn, a, b);
    setExecutionContext(prevExecutionContext | EventContext);
    fn();
  } finally {
    setExecutionContext(prevExecutionContext);
    isBatchingEventUpdates = false;
  }
}

function dispatchEventsForPlugins(
  domEventName, //!触发的事件名称
  eventSystemFlags, //!标识是否是冒泡解阶段
  nativeEvent, //!事件源event
  targetInst, //!事件源的fiber
  targetContainer //!忽略
) {
  //获取事件源
  const nativeEventTarget = getEventTarget(nativeEvent);
  const dispatchQueue = [];
  extractEvents$4(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags
  );
  processDispatchQueue(dispatchQueue, eventSystemFlags);
}

function extractEvents$4(
  dispatchQueue, //!收集的派发队列
  domEventName, //!事件名称
  targetInst, //!事件源对应的fiber
  nativeEvent, //!事件对应的原生event
  nativeEventTarget, //!对应的事件源
  eventSystemFlags, //!表示是否冒泡
  targetContainer
) {
  //!获取reactName click=>onClick
  var reactName = topLevelEventsToReactNames.get(domEventName);
  if (reactName === undefined) {
    return;
  }
  let SyntheticEventCtor = SyntheticEvent;
  let reactEventType = domEventName;
  switch (domEventName) {
    case "keyup":
    case "keydown":
      SyntheticEventCtor = SyntheticKeyboardEvent;
      break;
    case "click":
      if (nativeEvent.button === 2) {
        return;
      }
      break;
    case "mousedown":
    case "mousemove":
      SyntheticEventCtor = SyntheticMouseEvent;
      break;
    default:
      break;
  }
  //!获取当前是否是冒泡阶段
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;

  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    reactName,
    nativeEvent.type,
    inCapturePhase,
    false
  );

  if (listeners.length > 0) {
    // Intentionally create event lazily.
    const event = new SyntheticEventCtor(
      reactName,
      reactEventType,
      null,
      nativeEvent,
      nativeEventTarget
    );

    dispatchQueue.push({
      event: event,
      listeners: listeners,
    });
  }
}

function accumulateSinglePhaseListeners(
  targetFiber, //!事件源fiber
  reactName, //!onClick
  nativeEventType, //!原生时间类型click
  inCapturePhase, //!是否冒泡
  accumulateTargetOnly //!是否只收集目标元素
) {
  const captureName = reactName !== null ? reactName + "Capture" : null;
  const reactEventName = inCapturePhase ? captureName : reactName;
  const listeners = [];
  let instance = targetFiber;
  let lastHostComponent = null;

  while (instance !== null) {
    var _instance2 = instance,
      stateNode = _instance2.stateNode,
      tag = _instance2.tag;

    if (tag === HostComponent && stateNode !== null) {
      lastHostComponent = stateNode;

      if (reactEventName !== null) {
        //!获取监听事件
        var listener = getListener(instance, reactEventName);

        if (listener != null) {
          //!推入监听
          listeners.push(
            createDispatchListener(instance, listener, lastHostComponent)
          );
        }
      }
    }

    if (accumulateTargetOnly) {
      break;
    }
    instance = instance.return;
  }

  return listeners;
}

function createDispatchListener(instance, listener, currentTarget) {
  return {
    instance: instance,
    listener: listener,
    currentTarget: currentTarget,
  };
}

function getListener(inst, registrationName) {
  //!获取真实DOM
  var stateNode = inst.stateNode;

  if (stateNode === null) {
    return null;
  }

  var props = getFiberCurrentPropsFromNode(stateNode);

  if (props === null) {
    return null;
  }

  var listener = props[registrationName];

  //!如果props中没有这个属性则报错
  if (!(!listener || typeof listener === "function")) {
    throw Error(
      "Expected `" +
        registrationName +
        "` listener to be a function, instead got a value of `" +
        typeof listener +
        "` type."
    );
  }

  return listener;
}
//!执行收集到的事件
function processDispatchQueue(dispatchQueue, eventSystemFlags) {
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;

  for (let i = 0; i < dispatchQueue.length; i++) {
    const _dispatchQueue$i = dispatchQueue[i],
      event = _dispatchQueue$i.event,
      listeners = _dispatchQueue$i.listeners;
    processDispatchQueueItemsInOrder(event, listeners, inCapturePhase);
  }
}

function processDispatchQueueItemsInOrder(
  event,
  dispatchListeners,
  inCapturePhase
) {
  var previousInstance;

  //!如果是捕获阶段逆序执行
  if (inCapturePhase) {
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      const dispatchListener = dispatchListeners[i],
        instance = dispatchListener.instance,
        currentTarget = dispatchListener.currentTarget,
        listener = dispatchListener.listener;

      //!合成事件event是同一个 如果之前有调用过e.stopPropagation()
      //!那么属性就会发生改变并且真的调用原生的stopPropagation就能够阻止冒泡传递了
      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }

      //!执行真正的onclick对应的函数
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  }
  //!如果是冒泡阶段顺序执行
  else {
    for (let i = 0; i < dispatchListeners.length; i++) {
      const dispatchListener = dispatchListeners[i],
        instance = dispatchListener.instance,
        currentTarget = dispatchListener.currentTarget,
        listener = dispatchListener.listener;

      if (instance !== previousInstance && event.isPropagationStopped()) {
        return;
      }

      //SyntheticBaseEvent ()=>{} a标签
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  }
}

//!event合成事件 listen监听函数 currentTarget事件源
function executeDispatch(event, listener, currentTarget) {
  event.currentTarget = currentTarget;
  listener.call(null, event);
  event.currentTarget = null;
}
