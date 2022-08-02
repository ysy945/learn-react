import reconcileChildFibers from "./reconcileChildFibers";
import mountChildFibers from "./mountChildFibers";
/**
 *
 * @param {*} current 当前屏幕展示的fiberTree
 * @param {*} workInProgress 正在构建的fiberTree
 * @param {*} nextChildren 最新jsx元素
 * @param {*} renderLanes 占用的车道
 */
export default function reconcileChildren(
  current,
  workInProgress,
  nextChildren,
  renderLanes
) {
  if (current === null) {
    //!函数根据调用render函数生成的React elements构建workInprogress树。
    //!第一次render的时候current为null需要通过element构建WIPTree
    // 如果这是一个尚未渲染的新组件，我们不会通过应用最小的副作用来更新其子集。相反
    // 我们将在渲染子对象之前将它们全部添加到子对象。这意味着我们可以通过不跟踪副作用来优化这个调节过程。
    workInProgress.child = mountChildFibers(
      workInProgress,
      null,
      nextChildren,
      renderLanes,
      false
    );
  }
  //!更新 会调用reconcileChildFibers函数，对current树和workInProgress树进行diff算法对比，找出差异部分进行更新。
  else {
    //如果当前子项与正在进行的工作相同，则表示我们还没有开始对这些孩子进行任何研究。因此，我们使用
    //克隆算法，用于创建所有当前子项的副本。如果我们已经有任何进展的工作，在这一点上是无效的，所以就不需要了
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes,
      true
    );
  }
}
