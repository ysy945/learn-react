import { includesSomeLane, NoLanes } from "../react-reconciler/ReactFiberLane";
import {
  ClassComponent,
  FunctionComponent,
  HostComponent,
  HostText,
} from "./react-dom-types";
import {
  updateClassComponent,
  updateHostComponent,
  updateHostText,
  updateFunctionComponent,
  updateHostRoot,
} from "./updateComponents";

import { HostRoot } from "./createFiber";
import bailoutOnAlreadyFinishedWork from "./bailoutOnAlreadyFinishedWork";

/**
 *
 * @param {*} current 当前屏幕展示的fiber Tree 第一次为没有实际的结构
 * @param {*} workInProgress 需要构建的fiber Tree
 * @param {*} renderLanes 渲染的车道
 */

//!用于标识当前是props是否发生了更新
window.didReceiveUpdate = false;

//!做了两层拦截 来判断是否需要复用当前fiber节点 第一层在beginWork
//!第二层在不同的类型的处理函数(updateClassComponent updateFunctionComponent等)中体现
export default function beginWork(current, workInProgress, renderLanes) {
  const updateLanes = workInProgress.lanes;

  //!根据是否有current判断当前是创建还是更新
  if (current !== null) {
    //!获取新旧的props
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    //!如果props和type不同一定需要更新
    if (oldProps !== newProps || workInProgress.type !== current.type) {
      window.didReceiveUpdate = true;
    }
    //!如果renderLanes与updateLanes交集不为0说明需要复用静态节点
    else if (!includesSomeLane(renderLanes, updateLanes)) {
      window.didReceiveUpdate = false;
      //!当前节点可以复用了 通过这个函数判断child是否还可以复用
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
    //
    else {
      window.didReceiveUpdate = false;
    }
  }
  //!如果是创建说明props没有变化
  else {
    window.didReceiveUpdate = false;
  }

  //!重渲染的时候可能会复用之前的fiber 而之前的fiber可能被打上了lanes 需要清零
  //!例如调用了setNumber函数引起重新调度 那么当前这个使用setNumber的组件会被打上lanes优先级标签
  //!在进行调度之后 发现可以复用fiber节点那么这里的workInProgress.lanes同样会被复用 需要清零
  //!对于新构建的fiber是不可能有任务的
  workInProgress.lanes = NoLanes;

  switch (workInProgress.tag) {
    case FunctionComponent:
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;

      //!判断当前组件是否有defaultProps属性 如果有做合并
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderLanes
      );
    case ClassComponent:
      const Component$1 = workInProgress.type;
      const unresolvedProps$1 = workInProgress.pendingProps;

      const resolvedProps$1 =
        workInProgress.elementType === Component$1
          ? unresolvedProps$1
          : resolveDefaultProps(Component$1, unresolvedProps$1);

      return updateClassComponent(
        current,
        workInProgress,
        Component$1,
        resolvedProps$1,
        renderLanes
      );
    case HostRoot:
      return updateHostRoot(current, workInProgress, renderLanes);

    //!对于子节点是文本节点返回null
    //!<p>123</p>这种 这里可以处理这种情况 当做属性处理(在complete阶段处理 commit阶段更新)
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);

    //! <div><p></p>123<p></p></div>这里是处理这种情况
    //!把123真的当做一个节点来处理而不是一个属性
    case HostText:
      return updateHostText(current, workInProgress);

    default:
  }
}

//!合并属性为defaultProps的属性
export function resolveDefaultProps(Component, baseProps) {
  if (Component && Component.defaultProps) {
    const props = Object.assign({}, baseProps);

    const defaultProps = Component.defaultProps;

    for (const propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }

    return props;
  }

  return baseProps;
}
