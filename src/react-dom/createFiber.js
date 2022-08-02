import { NoLanes } from "../react-reconciler/ReactFiberLane";

export const HostRoot = 3;

export default function createFiber(tag, props, key) {
  return new FiberNode(tag, props, key);
}

class FiberNode {
  constructor(tag, pendingProps, key, mode = 0) {
    this.tag = tag; //!fiber对应的类型
    this.key = key; //!唯一的key值
    this.elementType = null; //!
    this.type = null; //! 类 函数 html元素等 如果这俩不同与热重载有关 需要重新resolveDefaultProps
    this.stateNode = null; //! 对应的真实DOM

    this.return = null; //!父节点
    this.child = null; //!子节点
    this.sibling = null; //!兄弟节点
    this.index = 0;
    this.ref = null; //!function不能有ref class和host可以有
    this.pendingProps = pendingProps; //!本次更新的props
    this.memoizedProps = null; //!上次的props
    this.updateQueue = null; //!本次更新状态的队列
    this.memoizedState = null; //!上次的存放的状态
    this.dependencies = null; //!依赖
    this.mode = mode; //!模式 noMode profilerMode concurrentMode

    //!effects相关
    this.flags = 0;
    this.nextEffect = null; //!下一个副作用
    this.firstEffect = null; //!整个副作用链的头指针
    this.lastEffect = null; //!整个副作用链的尾指针

    //!车道
    this.lanes = NoLanes;
    this.childLanes = NoLanes;

    //!双缓冲结构的宁外一个fiber结构
    this.alternate = null;
  }
}
