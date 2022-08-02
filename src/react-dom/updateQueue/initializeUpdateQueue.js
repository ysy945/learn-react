//!初始化任务队列
export default function initializeUpdateQueue(fiber) {
  const queue = {
    baseState: fiber.memoizedState, //获取上一次的state
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
    },
    effects: null, //副作用更新队列
  };
  fiber.updateQueue = queue; //赋值到fiber上
}
