import { unstable_scheduleCallback } from "../react-scheduler";
import reactPriorityToSchedulerPriority from "./reactPriorityToSchedulerPriority";

export default function ensureRootIsScheduled(root, currentTime) {}

export function scheduleCallback(reactPriorityLevel, callback, options) {
  const priorityLevel = reactPriorityToSchedulerPriority(reactPriorityLevel);
  return unstable_scheduleCallback(priorityLevel, callback, options);
}
