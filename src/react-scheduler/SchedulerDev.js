import { pop, push, peek, createHeap } from "./SchedulerMinHeap";

//优先级等级0 1 2 3 4 5
import {
  ImmediatePriority, //1
  UserBlockingPriority, //2
  NormalPriority, //3
  LowPriority, //4
  IdlePriority, //5
} from "./SchedulerPriorities";

let frameInterval = 5;
export function setFrameInterval(ms) {
  frameInterval = ms;
}

// 防止一些polyfill覆盖 保证只能是原生的setTimeout
const localSetTimeout = typeof setTimeout === "function" ? setTimeout : null;

const localClearTimeout =
  typeof clearTimeout === "function" ? clearTimeout : null;

const localSetImmediate =
  typeof setImmediate === "function" ? setImmediate : null;

//判断当前用户是否处于正在输入阶段
const isInputPending =
  typeof navigator !== "undefined" &&
  navigator.scheduling !== undefined &&
  navigator.scheduling.isInputPending !== undefined
    ? navigator.scheduling.isInputPending.bind(navigator.scheduling)
    : null;
const maxInterval = 300; //当用户输入的时候最大占用线程的时间不能超过300ms

let taskIdCounter = 1; //标识任务id
let taskTimeoutID = null; //标识当前timeout任务执行的id便于取消任务

let isHostCallbackScheduled = false; //用于标识是否进行taskQueue的调度
let isHostTimeoutScheduled = false; //用于标识是否正在进行requestHostTimeout
let currentTask = null; //当前任务
let scheduledHostCallback = null;
let isMessageLoopRunning = false;
let currentPriorityLevel = NormalPriority; //当前的优先级
let isPerformingWork = false; //这是在执行工作时设置的,以防止再次进入。
let startTime = -1; //当前任务的实际开始时间

//根据环境的因素决定使用那个宏任务
let schedulePerformWorkUntilDeadline;
if (typeof localSetImmediate === "function") {
  schedulePerformWorkUntilDeadline = function () {
    localSetImmediate(performWorkUntilDeadline);
  };
} else if (typeof MessageChannel !== "undefined") {
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  schedulePerformWorkUntilDeadline = function () {
    port.postMessage(null);
  };
} else {
  schedulePerformWorkUntilDeadline = function () {
    setTimeout(performWorkUntilDeadline, 0);
  };
}

const maxSigned31BitInt = 1073741823; //0b1111 1111 1111 1111 1111 1111 1111 1111
const IMMEDIATE_PRIORITY_TIMEOUT = -1; //立即执行
const USER_BLOCKING_PRIORITY_TIMEOUT = 250;
const NORMAL_PRIORITY_TIMEOUT = 5000;
const LOW_PRIORITY_TIMEOUT = 10000;
const IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

//真实的任务队列
const taskQueue = createHeap();
//有延迟时间的队列 当超过了时间放入真实任务队列
const timerQueue = createHeap();

//根据当前浏览器拥有的支持的方法累确定获取当前时间的方法
const getCurrentTime = createGetCurrentTime();
function createGetCurrentTime() {
  const hasPerformanceNow =
    typeof performance === "object" && typeof performance.now === "function";
  if (hasPerformanceNow) {
    const localPerformance = performance;
    return () => localPerformance.now();
  } else {
    const localDate = Date;
    const initialTime = localDate.now();
    return () => localDate.now() - initialTime;
  }
}

//根据给定的任务赋值给对应的时间
function fromPriorityLevelToTimeout(priorityLevel) {
  switch (priorityLevel) {
    case ImmediatePriority:
      return IMMEDIATE_PRIORITY_TIMEOUT;
    case UserBlockingPriority:
      return USER_BLOCKING_PRIORITY_TIMEOUT;
    case NormalPriority:
      return NORMAL_PRIORITY_TIMEOUT;
    case LowPriority:
      return LOW_PRIORITY_TIMEOUT;
    case IdlePriority:
      return IDLE_PRIORITY_TIMEOUT;
    default:
      return NORMAL_PRIORITY_TIMEOUT;
  }
}

//创建任务
function createTask(
  callback,
  priorityLevel,
  startTime,
  expirationTime,
  sortIndex = -1
) {
  return {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex,
  };
}

//创建任务
export function unstable_scheduleCallback(priorityLevel, callback, options) {
  let currentTime = getCurrentTime();
  let startTime; //任务开始执行的时间
  let timeout = fromPriorityLevelToTimeout(priorityLevel); //任务延时时间

  //先确定是否有delay
  if (typeof options === "object" && options !== null) {
    const { delay } = options;
    if (delay && delay > 0) {
      startTime = currentTime + delay;
    } else startTime = currentTime;
  } else {
    startTime = currentTime;
  }

  let expirationTime = startTime + timeout;

  const newTask = createTask(
    callback, //要执行的callback
    priorityLevel, //优先级
    startTime, //任务开始时间
    expirationTime //任务到期时间(这个值越小在queue中就越靠前)
  );

  //表示这是一个包含有delay参数的则需要放入timerQueue//!(这是一个延迟任务)
  if (startTime > currentTime) {
    newTask.sortIndex = startTime;
    push(timerQueue, newTask);
    //如果当前任务队列没有任务且当前任务处于缓存任务优先级最高的任务
    if (peek(taskQueue) === null && peek(timerQueue) === newTask) {
      //如果已经开启执行了则取消
      if (isHostTimeoutScheduled) {
        cancelHostTimeout();
      } else {
        isHostTimeoutScheduled = true; //标识当前要开始调度了
      }

      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  }
  //!这是一个正常任务
  else {
    newTask.sortIndex = expirationTime; //将过期时间作为排序依据 越小越优先
    push(taskQueue, newTask);
    if (!isHostCallbackScheduled) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    }
  }
  return newTask;
}

function requestHostTimeout(callback, ms) {
  taskTimeoutID = localSetTimeout(() => {
    callback(getCurrentTime());
  }, ms);
}

/**
 *
 * @param {*} currentTime 任务移动到taskQueue时的时间
 */
function handleTimeout(currentTime) {
  //本次requestHostTimeout调度结束
  isHostCallbackScheduled = false;

  //监测当前timerQueue中是否有任务到时间了 如果有就放入taskQueue中
  advanceTimers(currentTime);

  //如果当前没有执行taskQueue的调度就开启一个requestHostCallback去调度
  if (!isHostCallbackScheduled) {
    //如果任务队列不为空则去调度
    if (peek(taskQueue) !== null) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    }
    //如果taskQueue为空则去调用requestHostTimeout 为空则停止所有任务都已经处理完成了
    else {
      const firstTimer = peek(timerQueue);
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
      }
    }
  }
}

//检查是否有过期任务有的话移动到taskQueue中
function advanceTimers(currentTime) {
  let timer = peek(timerQueue); //获取当前任务
  while (timer !== null) {
    //任务被取消了重队伍中移除掉
    if (timer.callback === null) {
      pop(timerQueue);
    }
    //判断是否满足移动到taskQueue的条件
    else if (timer.startTime <= currentTime) {
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime; //排序根据过期时间来定
      push(taskQueue, timer);
    }
    //如果不满足上面两个条件表示剩下的任务都是等待状态就不需要在向下循环 退出循环即可
    else {
      return;
    }
    timer = peek(timerQueue);
  }
}

//callback = flushWork
function requestHostCallback(callback) {
  scheduledHostCallback = callback; //缓存flushWork
  //如果没有进行loop循环开启真正的调度
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true; //标识即将开启调度
    schedulePerformWorkUntilDeadline();
  }
}

function cancelHostTimeout() {
  localClearTimeout(taskTimeoutID);
  taskTimeoutID = null;
}

//调度task.callback任务
function performWorkUntilDeadline() {
  //在requestHostCallback出缓存的flushWork
  if (scheduledHostCallback !== null) {
    const currentTime = getCurrentTime();
    startTime = currentTime;
    const hasTimeRemaining = true; //标识还有时间去执行
    let hasMoreWork = true; //还有任务需要执行

    //执行flushWork 如果还有任务则继续调度
    try {
      hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
    } finally {
      if (hasMoreWork) {
        schedulePerformWorkUntilDeadline();
      } else {
        isMessageLoopRunning = false;
        scheduledHostCallback = null;
      }
    }
  } else {
    isMessageLoopRunning = false;
  }
}

/**
 *
 * @param {*} hasTimeRemaining 是否还有时间剩余
 * @param {*} initialTime 任务开始执行的实际时间
 * @returns
 */
function flushWork(hasTimeRemaining, initialTime) {
  //让出调度器执行权
  isHostCallbackScheduled = false;
  //如果当前的timeout在进行调度等待则取消
  if (isHostTimeoutScheduled) {
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }

  isPerformingWork = true;
  //回溯当前任务的优先级
  const previousPriorityLevel = currentPriorityLevel;
  try {
    return workLoop(hasTimeRemaining, initialTime);
  } catch (err) {
    if (err) console.error(err);
  } finally {
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
  }
}

function workLoop(hasTimeRemaining, initialTime) {
  let currentTime = initialTime; //记录当前任务实际开始的时间
  //检查是否有需要放入队列的任务
  advanceTimers(currentTime);

  currentTask = peek(taskQueue);

  //执行任务
  while (currentTask !== null) {
    if (
      currentTask.expirationTime > currentTime && //还不需要执行 没有超过过期时间
      (!hasTimeRemaining || //可以忽略 没有改变过这个值
        shouldYieldToHost()) //看是否需要停止
    ) {
      break; //如果第一个任务是以上情况则直接退出循环
    }

    //走到这里表示还有时间执行且有任务
    const callback = currentTask.callback;
    if (typeof callback === "function") {
      currentTask.callback = null; //表示这个函数已经执行过了
      currentPriorityLevel = currentTask.priorityLevel; //赋值给全局变量 便于知道当前执行任务的优先级
      //判断当前任务是否能够执行
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      //执行任务
      const continuationCallback = callback(didUserCallbackTimeout);
      currentTime = getCurrentTime();
      //如果返回的是一个函数表示任务还没有完成需要继续完成
      //那么就不需要重队列中删除 同时如果有更高优先级的任务 再放入队列当中 那么就不会执行这个切片中的任务了
      if (typeof continuationCallback === "function") {
        currentTask.callback = continuationCallback;
      }
      //如果不是function那么说明当前任务已经执行完了 就可以重队列中删除这个任务了
      else {
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
      //在执行完一个任务之后 看看timerQueue是否有到时间的任务
      advanceTimers(currentTime);
    } else {
      //如果第一次执行的时候就不是函数 则说明传入错误 或则取消了删除即可
      pop(taskQueue);
    }
    //获取下一个任务直到为null才退出
    currentTask = peek(taskQueue);
  }

  //可能是切片时间到了 中断了任务 那么需要返回true下次在进行调度
  if (currentTask !== null) {
    return true;
  }
  //说明所有任务都执行完了 那么需要看看timerQueue中是否有可以添加队列的任务
  else {
    const firstTimer = peek(timerQueue);
    if (firstTimer !== null) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }
    return false; //表明当前任务结束了
  }
}

//startTime全局变量 当前任务开始时间
function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime;
  //如果执行时间超过5ms让出执行权
  if (timeElapsed < frameInterval) {
    return false;
  }
  if (timeElapsed < maxInterval) {
    //如果没有超过 则让输入为主要渲染线程
    if (isInputPending !== null) {
      return isInputPending();
    }
  }
  //如果超过了300ms则需要中断了
  else return true;
}

export function unstable_getCurrentTask() {
  return currentTask;
}

export function unstable_getCurrentPriorityLevel() {
  return currentPriorityLevel;
}

//将callback置为null后 就不会执行了
export function unstable_cancelCallback(task) {
  task.callback = null;
}

//!告知当前的优先级
export function unstable_runWithPriority(priorityLevel, eventHandler) {
  switch (priorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
    case LowPriority:
    case IdlePriority:
      break;

    default:
      priorityLevel = NormalPriority;
  }

  const previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

export const Scheduler_requestPaint = function () {};

export const Scheduler_ImmediatePriority = ImmediatePriority; //1
export const Scheduler_UserBlockingPriority = UserBlockingPriority; //2
export const Scheduler_NormalPriority = NormalPriority; //3
export const Scheduler_LowPriority = LowPriority; //4
export const Scheduler_IdlePriority = IdlePriority; //5
