import { NoLanes } from "../../react-reconciler/ReactFiberLane";
import { resetCurrentFiber, setCurrentFiber } from "../currentFiber";
import { runWithPriority$1 } from "../dispatchDiscreteEvent";
import {
  getExecutionContext,
  setExecutionContext,
} from "../legacyRenderSubtreeIntoContainer";
import {
  CommitContext,
  Deletion,
  NoContext,
  NoPriority$1,
  NormalPriority$1,
  PassiveUnmountPendingDev,
  RenderContext,
} from "../react-dom-types";

export default function flushPassiveEffects() {
  //!最高位NormalPriority$1优先级
  if (window.pendingPassiveEffectsRenderPriority !== NoPriority$1) {
    var priorityLevel =
      window.pendingPassiveEffectsRenderPriority > NormalPriority$1
        ? NormalPriority$1
        : window.pendingPassiveEffectsRenderPriority;
    window.pendingPassiveEffectsRenderPriority = NoPriority$1;

    return runWithPriority$1(priorityLevel, flushPassiveEffectsImpl);
  }

  return false;
}

function flushPassiveEffectsImpl() {
  if (window.rootWithPendingPassiveEffects === null) {
    return false;
  }

  const root = window.rootWithPendingPassiveEffects;
  const lanes = window.pendingPassiveEffectsLanes;
  window.rootWithPendingPassiveEffects = null;
  window.pendingPassiveEffectsLanes = NoLanes;

  if (
    !((getExecutionContext() & (RenderContext | CommitContext)) === NoContext)
  ) {
    throw Error("Cannot flush passive effects while already rendering.");
  }

  window.isFlushingPassiveEffects = true;

  const prevExecutionContext = getExecutionContext();
  setExecutionContext(prevExecutionContext, CommitContext);

  const unmountEffects = window.pendingPassiveHookEffectsUnmount;
  window.pendingPassiveHookEffectsUnmount = [];

  //!先调用destroy在调用 函数本身
  //!获取unmount中的effect和fiber 删除PassiveUnmountPendingDev标识 执行destroy函数
  for (let i = 0; i < unmountEffects.length; i += 2) {
    const effect = unmountEffects[i];
    const fiber = unmountEffects[i + 1];
    const destroy = effect.destroy;
    effect.destroy = undefined;

    fiber.flags &= ~PassiveUnmountPendingDev;
    const alternate = fiber.alternate;

    if (alternate !== null) {
      alternate.flags &= ~PassiveUnmountPendingDev;
    }

    if (typeof destroy === "function") {
      setCurrentFiber(fiber);
      destroy();
      resetCurrentFiber();
    }
  }

  const mountEffects = window.pendingPassiveHookEffectsMount;
  window.pendingPassiveHookEffectsMount = [];

  for (let i = 0; i < mountEffects.length; i += 2) {
    const effect = mountEffects[i];
    const fiber = mountEffects[i + 1];
    setCurrentFiber(fiber);
    invokePassiveEffectCreate(effect);
    resetCurrentFiber();
  }

  let effect = root.current.firstEffect;

  while (effect !== null) {
    const nextNextEffect = effect.nextEffect;

    effect.nextEffect = null;

    if (effect.flags & Deletion) {
      detachFiberAfterEffects(effect);
    }

    effect = nextNextEffect;
  }
  window.isFlushingPassiveEffects = false;
  setExecutionContext(prevExecutionContext);

  return true;
}

function invokePassiveEffectCreate(effect) {
  const create = effect.create;
  effect.destroy = create();
}
export function detachFiberAfterEffects(fiber) {
  fiber.sibling = null;
  fiber.stateNode = null;
}
