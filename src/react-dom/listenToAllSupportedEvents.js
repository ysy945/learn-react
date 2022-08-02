import {
  internalEventHandlersKey,
  IS_CAPTURE_PHASE,
  listeningMarker,
} from "./react-dom-types";
import createEventListenerWrapperWithPriority from "./createEventListenerWrapperWithPriority";

const allNativeEvents = new Set([
  "click",
  "keyup",
  "keydown",
  "mousedown",
  "mouseup",
]);

//!注册所有的监听事件到rootContainerElement上
function listenToAllSupportedEvents(rootContainerElement) {
  //如果已经绑定过监听了 那么直接退出就不需要在绑定了
  if (rootContainerElement[listeningMarker]) {
    return;
  }

  rootContainerElement[listeningMarker] = true;

  allNativeEvents.forEach((domEventName) => {
    listenToNativeEvent(domEventName, false, rootContainerElement, null);
    listenToNativeEvent(domEventName, true, rootContainerElement, null);
  });
}

function listenToNativeEvent(
  domEventName,
  isCapturePhase,
  rootContainerElement,
  targetElement
) {
  let eventSystemFlags = 0;
  const target = rootContainerElement;
  const listenerSet = getEventListenerSet(target);
  const listenerSetKey = getEventListenerKey(domEventName, isCapturePhase);

  //!如果listenerSet中已经有了 标识已经注册过了
  if (!listenerSet.has(listenerSetKey)) {
    //!如果当前是冒泡阶段 标识一下
    if (isCapturePhase) {
      eventSystemFlags |= IS_CAPTURE_PHASE;
    }
    addTrappedEventListener(
      target,
      domEventName,
      eventSystemFlags,
      isCapturePhase
    );
    //!注册后往set中添加对应的key
    listenerSet.add(listenerSetKey);
  }
}

//!如果node上有就直接获取 否则就创建一个set
function getEventListenerSet(node) {
  const elementListenerSet = node[internalEventHandlersKey];

  if (elementListenerSet === undefined) {
    node[internalEventHandlersKey] = new Set();
  }
  return node[internalEventHandlersKey];
}

//!获取key click__capture || click__bubble
function getEventListenerKey(domEventName, capture) {
  return domEventName + "__" + (capture ? "capture" : "bubble");
}

function addTrappedEventListener(
  targetContainer,
  domEventName,
  eventSystemFlags,
  isCapturePhase
) {
  //!以某个优先级创建事件监听
  const listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags
  );

  //!取消监听可以执行clear(unsubscribeListener)
  let unsubscribeListener;

  if (isCapturePhase) {
    unsubscribeListener = addEventCaptureListener(
      targetContainer,
      domEventName,
      listener
    );
  } else {
    unsubscribeListener = addEventBubbleListener(
      targetContainer,
      domEventName,
      listener
    );
  }
  return unsubscribeListener;
}

function addEventCaptureListener(target, eventType, listener) {
  target.addEventListener(eventType, listener, true);
  return listener;
}

function addEventBubbleListener(target, eventType, listener) {
  target.addEventListener(eventType, listener, false);
  return listener;
}

export default listenToAllSupportedEvents;
