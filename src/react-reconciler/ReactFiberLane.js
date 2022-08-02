export const TotalLanes = 31;

export const NoLanes = 0b0000000000000000000000000000000;
export const NoLane = 0b0000000000000000000000000000000;

export const SyncLane = 0b0000000000000000000000000000001;

export const SyncBatchedLane = 0b0000000000000000000000000000010;
export const InputContinuousLane = 0b0000000000000000000000000000100;

export const DefaultHydrationLane = 0b0000000000000000000000000001000;
export const DefaultLane = 0b0000000000000000000000000010000;
export const DefaultLanes = 0b0000000000000000000000000011000;

export const TransitionHydrationLane = 0b0000000000000000000000000100000;
export const TransitionLanes = 0b0000000001111111111111111000000;
export const TransitionLane1 = 0b0000000000000000000000001000000;
export const TransitionLane2 = 0b0000000000000000000000010000000;
export const TransitionLane3 = 0b0000000000000000000000100000000;
export const TransitionLane4 = 0b0000000000000000000001000000000;
export const TransitionLane5 = 0b0000000000000000000010000000000;
export const TransitionLane6 = 0b0000000000000000000100000000000;
export const TransitionLane7 = 0b0000000000000000001000000000000;
export const TransitionLane8 = 0b0000000000000000010000000000000;
export const TransitionLane9 = 0b0000000000000000100000000000000;
export const TransitionLane10 = 0b0000000000000001000000000000000;
export const TransitionLane11 = 0b0000000000000010000000000000000;
export const TransitionLane12 = 0b0000000000000100000000000000000;
export const TransitionLane13 = 0b0000000000001000000000000000000;
export const TransitionLane14 = 0b0000000000010000000000000000000;
export const TransitionLane15 = 0b0000000000100000000000000000000;
export const TransitionLane16 = 0b0000000001000000000000000000000;

export const RetryLanes = 0b0000111110000000000000000000000;
export const RetryLane1 = 0b0000000010000000000000000000000;
export const RetryLane2 = 0b0000000100000000000000000000000;
export const RetryLane3 = 0b0000001000000000000000000000000;
export const RetryLane4 = 0b0000010000000000000000000000000;
export const RetryLane5 = 0b0000100000000000000000000000000;

export const SomeRetryLane = RetryLane1;

export const SelectiveHydrationLane = 0b0001000000000000000000000000000;

export const NonIdleLanes = 0b0001111111111111111111111111111;

export const IdleHydrationLane = 0b0010000000000000000000000000000;
export const IdleLane = 0b0100000000000000000000000000000;
const IdleLanes = 0b0110000000000000000000000000000;

export const OffscreenLane = 0b1000000000000000000000000000000;

export const NoTimestamp = -1;
//通过车道获取车道名称

export const SyncLanePriority = 15;
export const SyncBatchedLanePriority = 14;
export const InputDiscreteLanePriority = 12;
export const InputContinuousLanePriority = 10;
export const DefaultLanePriority = 8;
export const TransitionPriority = 6;
export const RetryLanePriority = 5;
export const SelectiveHydrationLanePriority = 4;
export const IdleLanePriority = 2;
export const OffscreenLanePriority = 1;

export const NoLanePriority = 0;

export function getLabelForLane(lane) {
  //如果传入的lane与SyncLane取交集 如果不为0说明两者相等则返回sync(下同)
  if (SyncLane & lane) {
    return "Sync";
  }
  if (lane & SyncBatchedLane) {
    return "SyncBatchedLane";
  }
  if (lane & InputContinuousLane) {
    return "InputContinuous";
  }
  if (lane & DefaultHydrationLane) {
    return "DefaultHydration";
  }
  if (lane & DefaultLane) {
    return "Default";
  }
  if (lane & TransitionHydrationLane) {
    return "TransitionHydration";
  }
  if (lane & TransitionLanes) {
    return "Transition";
  }
  if (lane & RetryLanes) {
    return "Retry";
  }
  if (lane & SelectiveHydrationLane) {
    return "SelectiveHydration";
  }
  if (lane & IdleHydrationLane) {
    return "IdleHydration";
  }
  if (lane & IdleLane) {
    return "Idle";
  }
  if (lane & OffscreenLane) {
    return "Offscreen";
  }
}
//!该函数的目的是找到对应优先级范围内优先级最高的那一批lanes
export function getHighestPriorityLanes(lanes) {
  if ((SyncLane & lanes) !== NoLanes) {
    // 如果lanes中有同步优先级的任务
    return_highestLanePriority = SyncLanePriority;
    return SyncLane;
  }
  if ((SyncBatchedLane & lanes) !== NoLanes) {
    // 如果lanes中有批量同步的优先级
    return_highestLanePriority = SyncBatchedLanePriority;
    return SyncBatchedLane;
  }
  const inputContinuousLanes = InputContinuousLane & lanes;
  if (inputContinuousLanes !== NoLanes) {
    return_highestLanePriority = InputContinuousLanePriority;
    return inputContinuousLanes;
  }
  const defaultLanes = DefaultLanes & lanes;
  if (defaultLanes !== NoLanes) {
    return_highestLanePriority = DefaultLanePriority;
    return defaultLanes;
  }
  const transitionLanes = TransitionLanes & lanes;
  if (transitionLanes !== NoLanes) {
    return_highestLanePriority = TransitionPriority;
    return transitionLanes;
  }
  const retryLanes = RetryLanes & lanes;
  if (retryLanes !== NoLanes) {
    return_highestLanePriority = RetryLanePriority;
    return retryLanes;
  }
  const idleLanes = IdleLanes & lanes;
  if (idleLanes !== NoLanes) {
    return_highestLanePriority = IdleLanePriority;
    return idleLanes;
  }
  if ((OffscreenLane & lanes) !== NoLanes) {
    return_highestLanePriority = OffscreenLanePriority;
    return OffscreenLane;
  }
  return_highestLanePriority = DefaultLanePriority;
  return lanes;
}

//!获取最高优先级的Lane 0b010101 => 0b000001
export function getHighestPriorityLane(lanes) {
  return lanes & -lanes;
}

//找到存放时间最大的时间
export function getMostRecentEventTime(fiberRoot, lanes) {
  const eventTimes = fiberRoot.eventTimes; //获取fiberRoot中的事件市时间

  let mostRecentEventTime = NoTimestamp;
  //遍历lanes 获取最大的eventTime
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index; //左移动index位
    const eventTime = eventTimes[index];
    if (eventTime > mostRecentEventTime) {
      mostRecentEventTime = eventTime;
    }
    //去掉最高的1
    //  a = 000101010
    //  b = 000100000
    // ~b = 111011111
    // a & ~b = 000001010 这样就去掉了最高位的1
    lanes &= ~lane;
  }
}

//通过车道优先级计算过期时间(优先级越高附加时间越少)
export function computeExpirationTime(lane, currentTime) {
  switch (lane) {
    //第一类车道 过期时间加250ms
    case SyncLane:
    case SyncBatchedLane:
    case InputContinuousLane:
      return currentTime + 250;
    //第二类车道 过期时间加5000ms
    case DefaultHydrationLane:
    case DefaultLane:
    case TransitionHydrationLane:
    case TransitionLane1:
    case TransitionLane2:
    case TransitionLane3:
    case TransitionLane4:
    case TransitionLane5:
    case TransitionLane6:
    case TransitionLane7:
    case TransitionLane8:
    case TransitionLane9:
    case TransitionLane10:
    case TransitionLane11:
    case TransitionLane12:
    case TransitionLane13:
    case TransitionLane14:
    case TransitionLane15:
    case TransitionLane16:
      return currentTime + 5000;
    case RetryLane1:
    case RetryLane2:
    case RetryLane3:
    case RetryLane4:
    case RetryLane5:
      return NoTimestamp;
    // 这些优先级永远不过期
    case SelectiveHydrationLane:
    case IdleHydrationLane:
    case IdleLane:
    case OffscreenLane:
      return NoTimestamp;
    default:
      return NoTimestamp;
  }
}

//将车道标记饥饿车道
export function markStarvedLanesAsExpired(fiberRoot, currentTime) {
  const {
    pendingLanes, //等待车道
    suspendedLanes, //挂起车道
    pingedLanes,
    expirationTimes, //过期时间
  } = fiberRoot;

  let lanes = pendingLanes;
  //遍历等待车道
  while (lanes > 0) {
    //获取最高位的位置索引
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    const expirationTime = expirationTimes[index]; //获取最高车道的过期时间
    //如果当前时间为永远不过期优先级
    //!不知道有什么用
    if (expirationTime === NoTimestamp) {
      //如果当前车道不在挂起车道中
      //或则当前车道在pinged中
      if (
        (lane & suspendedLanes) === NoLanes ||
        (lane & pingedLanes) !== NoLanes
      ) {
        //重新根据currentTime计算过期时间
        expirationTimes[index] = computeExpirationTime(lane, currentTime);
      }
    }
    //已经过期了 那么将当前车道放入过期车道中
    else if (expirationTime <= currentTime) {
      fiberRoot.expirationTimes |= lane;
    }
    //去除掉本次车道
    lanes &= ~lane;
  }
}

//获取等待车道中的最高优先级类型车道
export function getHighestPriorityPendingLanes(fiberRoot) {
  return getHighestPriorityLanes(fiberRoot.pendingLanes);
}

//判断当前车道是否包含同步车道
export function includesSyncLane(lanes) {
  return (lanes & SyncLane) !== NoLanes;
}

export function includesExpiredLane(fiberRoot, lanes) {
  return (fiberRoot.expiredLanes & lanes) !== NoLanes;
}

let nextTransitionLane = TransitionLane1;
// 获取一下个transition车道;
export function claimNextTransitionLane() {
  const lane = nextTransitionLane;
  // 向左移动一位
  nextTransitionLane <<= 1;
  // 如果移动一位之后在transition车道之外那么就移动到第一位
  if ((nextTransitionLane & TransitionLanes) === NoLanes) {
    nextTransitionLane = TransitionLane1;
  }
  return lane;
}

//返回最高位的位置索引
export function pickArbitraryLaneIndex(lanes) {
  //clz32 获取32bit的二进制数的最左边连续0个数 0b 00001  =>4
  return 31 - Math.clz32(lanes);
}

//获取lane的索引位置
export function laneToIndex(lane) {
  return pickArbitraryLaneIndex(lane);
}

export function mergeLanes(a, b) {
  return a | b;
}

let return_highestLanePriority = DefaultLanePriority; //8
//!该函数从root.pendingLanes中找出优先级最高的lane 计算renderLanes
export function getNextLanes(root, wipLanes) {
  const pendingLanes = root.pendingLanes;

  //!在没有剩余任务的时候，跳出更新
  if (pendingLanes === NoLanes) {
    return_highestLanePriority = pendingLanes;
    return NoLanes;
  }

  let nextLanes = NoLanes;
  let nextLanePriority = NoLanePriority;

  const { expiredLanes, suspendedLanes, pingedLanes } = root;

  //!检查是否过期
  if (expiredLanes !== NoLanes) {
    //!已经过期了，就需要把渲染优先级设置为同步，来让更新立即执行
    nextLanes = expiredLanes;
    nextLanePriority = SyncLanePriority;
  }
  //!没有过期的 那么就真的需要处理剩下的优先级了
  else {
    //把被挂起任务的优先级踢出去，只剩下那些真正待处理的任务的优先级集合。
    // 然后从这些优先级里找出最紧急的return出去。如果已经将挂起任务优先级踢出了之后还是
    // 为空，那么就说明需要处理这些被挂起的任务了。将它们重启。pingedLanes是那些被挂起
    // 任务的优先级

    //!去除掉车道的空闲车道
    const nonIdlePendingLanes = pendingLanes & NonIdleLanes;
    if (nonIdlePendingLanes !== NoLanes) {
      //!去除掉挂起车道剩下的就是需要处理的车道
      //!它等于所有未闲置的lanes中除去被挂起的那些lanes。
      const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;
      //!如果剩下的车道不为空选出最重要的
      if (nonIdleUnblockedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
        nextLanePriority = return_highestLanePriority;
      }
      //!如果没有 则重挂起的车道中选择最重要的
      else {
        const nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;
        if (nonIdlePingedLanes !== NoLanes) {
          nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
          nextLanePriority = return_highestLanePriority;
        }
      }
    }
    //!剩下的则是闲置任务
    else {
      //! 剩下的任务是闲置的任务。unblockedLanes是闲置任务的lanes
      const unblockedLanes = pendingLanes & ~suspendedLanes;
      if (unblockedLanes !== NoLanes) {
        //! 从这些未被阻塞的闲置任务中挑出最重要的
        nextLanes = getHighestPriorityLanes(unblockedLanes);
        nextLanePriority = return_highestLanePriority;
      } else {
        if (pingedLanes !== NoLanes) {
          //! 找到被挂起的那些任务中优先级最高的
          nextLanes = getHighestPriorityLanes(pingedLanes);
          nextLanePriority = return_highestLanePriority;
        }
      }
    }
  }

  //!通过寻找后 nextLanes任然为空则返回空即可
  if (nextLanes === NoLanes) {
    return NoLanes;
  }

  //!如果有更高优先级的lanes，即使它们被挂起，也会放到nextLanes里。
  nextLanes = pendingLanes & getEqualOrHigherPriorityLanes(nextLanes);

  if (
    wipLanes !== NoLanes &&
    wipLanes !== nextLanes &&
    (wipLanes & suspendedLanes) === NoLanes
  ) {
    getHighestPriorityLanes(wipLanes);
    const wipLanePriority = return_highestLanePriority;
    if (nextLanePriority <= wipLanePriority) {
      return wipLanes;
    } else {
      return_highestLanePriority = nextLanePriority;
    }
  }
  return nextLanes;
}

//! 0b 0010 0100 => 0b 0011 1111 获取所有更高的优先级
export function getEqualOrHigherPriorityLanes(lanes) {
  return (lanes << 1) - 1;
}

//!有交集
export function includesSomeLane(a, b) {
  return (a & b) !== NoLanes;
}

//!b是不是a的子集
export function isSubsetOfLanes(set, subset) {
  return (set & subset) === subset;
}

export function removeLanes(set, subset) {
  return set & ~subset;
}
