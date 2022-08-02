import {
  DiscreteEvent,
  UserBlockingEvent,
  ContinuousEvent,
} from "./react-dom-types";
import dispatchEvent from "./dispatchEvent";
import dispatchDiscreteEvent from "./dispatchDiscreteEvent";

const eventPriorities = new Map();
["click", "keyup", "keydown", "mousedown", "mouseup"].forEach(
  (domEventName) => {
    eventPriorities.set(domEventName, 0);
  }
);

//!不同事件对应不同的优先级,通过set来获取当前事件的优先级,根据不同的优先级来进行不同的dispatch
function createEventListenerWrapperWithPriority(
  targetContainer,
  domEventName,
  eventSystemFlags
) {
  const eventPriority = getEventPriorityForPluginSystem(domEventName);
  let listenerWrapper;

  if (eventPriority === DiscreteEvent) {
    //TODO 完善dispatchDiscreteEvent
    listenerWrapper = dispatchDiscreteEvent;
  }
  //!目前只写了事件的优先级为0
  else if (eventPriority === UserBlockingEvent) {
    listenerWrapper = null;
  }
  //TODO 完善dispatchEvent
  else if (eventPriority === ContinuousEvent) {
    listenerWrapper = dispatchEvent;
  }

  return listenerWrapper.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer
  );
}

function getEventPriorityForPluginSystem(domEventName) {
  const priority = eventPriorities.get(domEventName);
  return priority === undefined ? 0 : 0;
}

export default createEventListenerWrapperWithPriority;
