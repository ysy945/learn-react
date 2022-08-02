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
  unstable_getCurrentPriorityLevel,
} from "../react-scheduler/index";

//!SchedulerPriority转react优先级
export default function getCurrentPriorityLevel() {
  switch (unstable_getCurrentPriorityLevel()) {
    case Scheduler_ImmediatePriority:
      return ImmediatePriority$1;

    case Scheduler_UserBlockingPriority:
      return UserBlockingPriority$2;

    case Scheduler_NormalPriority:
      return NormalPriority$1;

    case Scheduler_LowPriority:
      return LowPriority$1;

    case Scheduler_IdlePriority:
      return IdlePriority$1;

    default: {
      throw Error("Unknown priority level.");
    }
  }
}
