import { REACT_ELEMENT_TYPE } from "../react-dom/react-dom-types";
import {
  reconcileChildrenArray,
  reconcileSingleElement,
  reconcileSingleTextNode,
  placeSingleChild,
  deleteRemainingChildren,
} from "./reconcile";

/**
 *
 * @param {*} returnFiber 当前workInProgress
 * @param {*} currentFirstChild current的child
 * @param {*} newChild 最新的element
 * @param {*} lanes 渲染优先级
 */
export default function reconcileChildFibers(
  returnFiber,
  currentFirstChild,
  newChild,
  lanes,
  shouldTrackSideEffects
) {
  const isObject = typeof newChild === "object" && newChild !== null;
  if (isObject) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        //!进行diff算法后标记当前为插入(更新情况才插入)
        return placeSingleChild(
          reconcileSingleElement(
            returnFiber,
            currentFirstChild,
            newChild,
            lanes,
            shouldTrackSideEffects
          ),
          shouldTrackSideEffects
        );
      default:
    }
  }
  if (typeof newChild === "string" || typeof newChild === "number") {
    return placeSingleChild(
      reconcileSingleTextNode(
        returnFiber,
        currentFirstChild,
        "" + newChild,
        lanes,
        shouldTrackSideEffects
      ),
      shouldTrackSideEffects
    );
  }
  if (Array.isArray(newChild)) {
    return reconcileChildrenArray(
      returnFiber,
      currentFirstChild,
      newChild,
      lanes,
      shouldTrackSideEffects
    );
  }
  //!如果都匹配不上就删除 例如child为文本就会走到这里 需要把旧的都删除了
  return deleteRemainingChildren(
    returnFiber,
    currentFirstChild,
    shouldTrackSideEffects
  );
}
