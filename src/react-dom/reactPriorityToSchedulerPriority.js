import {
  ImmediatePriority$1,
  UserBlockingPriority$2,
  NormalPriority$1,
  LowPriority$1,
  IdlePriority$1,
} from "./react-dom-types";

import {
  Scheduler_IdlePriority,
  Scheduler_ImmediatePriority,
  Scheduler_LowPriority,
  Scheduler_NormalPriority,
  Scheduler_UserBlockingPriority,
} from "../react-scheduler/index";

//!由react优先级 转化为scheduler优先级
function reactPriorityToSchedulerPriority(reactPriorityLevel) {
  switch (reactPriorityLevel) {
    //!99->1
    case ImmediatePriority$1:
      return Scheduler_ImmediatePriority;
    //!98->2
    case UserBlockingPriority$2:
      return Scheduler_UserBlockingPriority;
    //!97->3
    case NormalPriority$1:
      return Scheduler_NormalPriority;
    //!96->4
    case LowPriority$1:
      return Scheduler_LowPriority;
    //!95->5
    case IdlePriority$1:
      return Scheduler_IdlePriority;

    default: {
      throw Error("Unknown priority level.");
    }
  }
}

export default reactPriorityToSchedulerPriority;
