import { NoLanes, NoTimestamp } from "../react-reconciler/ReactFiberLane";
import createFiber, { HostRoot } from "./createFiber";

function createFiberRoot(containerInfo) {
  //创建fiberRootNode
  const root = new FiberRootNode(containerInfo);
  //创建根fiber root-div
  const uninitializedFiber = createFiber(HostRoot, null, null, 0);
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;
  initializeUpdateQueue(uninitializedFiber);
  console.log(root);
  return root;
}

function initializeUpdateQueue(fiber) {
  const queue = {
    baseState: fiber.memoizedState,
    firstBaseUpdate: null,
    lastBaseUpdate: null,
    shared: {
      pending: null,
    },
    effects: null,
  };
  fiber.updateQueue = queue;
}

class FiberRootNode {
  constructor(containerInfo) {
    this.containerInfo = containerInfo;
    this.pendingChildren = null;
    this.current = null;
    this.pingCache = null;
    this.finishedWork = null;
    this.timeoutHandle = -1;
    this.context = null; //useContext需要使用 上一次的context
    this.pendingContext = null; //最新的context
    this.callbackNode = null;
    this.callbackPriority = 0;
    this.eventTimes = createLaneMap(NoLanes);
    this.expirationTimes = createLaneMap(NoTimestamp);
    this.pendingLanes = NoLanes;
    this.suspendedLanes = NoLanes;
    this.pingedLanes = NoLanes;
    this.expiredLanes = NoLanes;
    this.mutableReadLanes = NoLanes;
    this.finishedLanes = NoLanes;
    this.entangledLanes = NoLanes;
    this.entanglements = createLaneMap(NoLanes);

    this.memoizedInteractions = new Set();
    this.pendingInteractionMap = new Map();
  }
}

function createLaneMap(initial) {
  const laneMap = [];
  for (let i = 0; i < 31; i++) {
    laneMap.push(initial);
  }
  return laneMap;
}

export default createFiberRoot;
