import dispatchEvent from "./dispatchEvent";
import {
  DiscreteEventContext,
  UserBlockingPriority$2,
} from "./react-dom-types";
import reactPriorityToSchedulerPriority from "./reactPriorityToSchedulerPriority";
import { unstable_runWithPriority } from "../react-scheduler/index";
import {
  getExecutionContext,
  setExecutionContext,
} from "./legacyRenderSubtreeIntoContainer";

let isInsideEventHandler = false;
let isBatchingEventUpdates = false;

export default function dispatchDiscreteEvent(
  domEventName, //!事件名称click
  eventSystemFlags, //! 是否冒泡
  container, //!div=root 代理事件的位置
  nativeEvent //! 原生的event事件
) {
  //!离散更新
  discreteUpdates(
    dispatchEvent,
    domEventName,
    eventSystemFlags,
    container,
    nativeEvent
  );
}

function discreteUpdates(fn, a, b, c, d) {
  var prevIsInsideEventHandler = isInsideEventHandler;
  isInsideEventHandler = true;

  try {
    return discreteUpdatesImpl(fn, a, b, c, d);
  } finally {
    isInsideEventHandler = prevIsInsideEventHandler;
  }
}

function discreteUpdatesImpl(fn, a, b, c, d) {
  const prevExecutionContext = getExecutionContext();
  setExecutionContext(prevExecutionContext | DiscreteEventContext);
  try {
    //用户阻塞优先级98 fn=>dispatchEvent函数 a=>click b=isCapture c=dom d=event
    return runWithPriority$1(UserBlockingPriority$2, fn.bind(null, a, b, c, d));
  } finally {
    setExecutionContext(prevExecutionContext);
    //TODO
  }
}

export function runWithPriority$1(reactPriorityLevel, fn) {
  var priorityLevel = reactPriorityToSchedulerPriority(reactPriorityLevel);
  //!以某个优先运行dispatchEvent
  return unstable_runWithPriority(priorityLevel, fn);
}
