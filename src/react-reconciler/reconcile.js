import createFiber from "../react-dom/createFiber";
import createWorkInProgress from "../react-dom/createWorkInProgress";
import {
  ClassComponent,
  ContextConsumer,
  ContextProvider,
  Deletion,
  FunctionComponent,
  HostComponent,
  HostText,
  IndeterminateComponent,
  Placement,
  REACT_CONTEXT_TYPE,
  REACT_ELEMENT_TYPE,
  REACT_PROVIDER_TYPE,
} from "../react-dom/react-dom-types";

/**
 *
 * @param {*} returnFiber workInProgress
 * @param {*} currentFirstChild 当前的子current
 * @param {*} newChildren 最新的element
 * @param {*} lanes 渲染优先级
 */

/*
 * 主要通过currentFirstChild 和 newChildren 进行diff比较 多节点比较这是两种完全不一样的数据结构
 * 一个是fiber结构 略
 * newChildren <div key="div"></div>
 *             <p   key="p"></p>
 *             <a   key="a"></a>
 * 他们的结构是 {$$typeof:Symbol(react.element),key:div,tag:"div"}
 *             {$$typeof:Symbol(react.element),key:p,tag:"p"}
 *             {$$typeof:Symbol(react.element),key:a,tag:"a"}
 * 一共有四大类型
 *
 *
 * 1.删除
 * old: A-B-C
 * new: A-B
 * 遍历newChildren完发现old还有剩余 需要删除
 *
 * 2.新增
 * old: A-B-C
 * new: A-B-C-D
 * 遍历new发现D对应的位置没有 就需要增加
 *
 * 3.更新
 * old: A-B-C
 * new: A-B-C 属性发生变化
 * 第一遍从头开始遍历newChildren 一个一个与currentChild链比较判断key和tag是否发生变化
 * (1).如果没有变化则克隆一个新的fiber传入最新的props即可
 * (2).如果有变化则不满足复用条件 中断对currentChild的遍历 进入其他形式(移动 新增 删除)的遍历
 *
 * 4.移动
 * old: A-B-C-D-E-F ABEDC
 * new: A-B-D-E-C   BADCE    A E会被标记为Placement 最后返回的是BADCE这个链 则遍历到副作用A的时候
 *                           找到下一个元素D 插入到D之前 映射到真实DOM上就是找到A插入到D之前就变成了
 *                           BEADC 然后E元素找不到兄弟元素插入到最后也就是BADCE 就得到了需要的序列
 * 遍历new数组
 * 先对比AB发现一样 那么会设置一个lastPlacedIndex此时指向B 此时继续遍历拿到D 发现D与对应old
 * 中的C不同 那么继续去old链表中寻找与D相同的元素 找到发现索引为3 而3>1则不需要移动 将lastPlacedIndex
 * 改为3 继续遍历new 找到E在old中的元素索引为4 4>3 也不需要移动将lastPlacedIndex改为4
 * 继续遍历old找到C的元素索引为2 2<4 需要将C移动到E的后面遍历完成后 发现old还有一个没有遍历删除即可
 *
 * 多节点的情况就只能是这几种情况的组合
 *
 * */
export function reconcileChildrenArray(
  returnFiber,
  currentFirstChild,
  newChildren,
  lanes,
  shouldTrackSideEffects
) {
  let resultingFirstChild = null; //!经过diff算法过后构建的新链表的头指针
  let previousNewFiber = null; //!经过diff算法过后构建的新链表的尾指针
  let oldFiber = currentFirstChild; //!之前的元素
  let lastPlacedIndex = 0; //!标识固定位置的索引
  let newIdx = 0; //!遍历的newChildren索引
  let nextOldFiber = null; //!下一个oldFiber指针

  //!结束条件oldFiber或则newChildren有一个遍历完了就借宿
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    //!如果oldFiber已经越界了缓存下当前的oldFiber供阶段使用并且让当前oldFiber为null
    if (oldFiber.index > newIdx) {
      nextOldFiber = oldFiber;
      oldFiber = null;
    }
    //!没有越界则让下一个oldFiber为sibling
    else {
      nextOldFiber = oldFiber.sibling;
    }

    //!对比oldFiber与当前newChildren 相当于新的: A-B 旧的: A-B 新的A与旧的A对比返回最新的fiber 如果不同则返回null
    const newFiber = updateSlot(
      returnFiber,
      oldFiber,
      newChildren[newIdx],
      lanes
    );

    //!如果newFiber为null表示当前新旧节点不同 退出第一层的比较
    if (newFiber === null) {
      if (oldFiber === null) {
        oldFiber = nextOldFiber;
      }

      break;
    }

    //!判断是否需要追踪副作用
    if (shouldTrackSideEffects) {
      if (oldFiber && newFiber.alternate === null) {
        //!oldFiber是current节点 newFiber是WIP节点,如果newFiber的alternate是null
        //!那么就需要删除之前的current节点
        deleteChild(returnFiber, oldFiber);
      }
    }

    lastPlacedIndex = placeChild(
      newFiber,
      lastPlacedIndex,
      newIdx,
      shouldTrackSideEffects
    );

    //!将新fiber构建成一个单链表
    if (previousNewFiber === null) {
      //!指向新链表的第一个元素
      resultingFirstChild = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }

    //!指针指向单链表的最后一个元素
    previousNewFiber = newFiber;
    //!与newIdx同步
    oldFiber = nextOldFiber;
  }

  //!如果已经遍历到newChildren的尾部 删除之前链表剩下的返回新构建的链表
  //!例如: 旧的: A-B-C 新的: A-B需要删除C
  if (newIdx === newChildren.length) {
    deleteRemainingChildren(returnFiber, oldFiber);
    return resultingFirstChild;
  }

  //!如果oldFiber已经遍历完了但是newChildren还没有遍历完需要增加
  if (oldFiber === null) {
    for (; newIdx < newChildren.length; newIdx++) {
      //!根据element创建新的fiber
      const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
      if (newFiber === null) {
        continue;
      }
      //!这里主要是让newFiber标记为插入 lPI不改变
      lastPlacedIndex = placeChild(
        newFiber,
        lastPlacedIndex,
        newIdx,
        shouldTrackSideEffects
      );
      //!构建单链表
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
    return resultingFirstChild;
  }
  //!将还没有遍历完的currentFiber变成map 以key或则index为键
  //!例如: 旧的: A-B-C 新的: A-C-B => {"1":B,"2":C}
  const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

  //!处理移动的逻辑
  for (; newIdx < newChildren.length; newIdx++) {
    //!通过map表和key获取匹配的fiber并返回更新后的fiber
    const newFiber = updateFromMap(
      existingChildren,
      returnFiber,
      newIdx,
      newChildren[newIdx],
      lanes
    );
    //!不为null表示获取到了
    if (newFiber !== null) {
      //!如果当前是更新模式且复用了就在表中删除对应的元素
      if (shouldTrackSideEffects) {
        if (newFiber.alternate !== null) {
          existingChildren.delete(
            newFiber.key === null ? newIdx : newFiber.key
          );
        }
      }
      //!这里主要是在进行LPI与newFiberIndex比较 插入或则不动 最后返回LPI最新位置
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      //!继续构建链表
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
  }

  if (shouldTrackSideEffects) {
    //!如果还有剩余则表示需要删除
    existingChildren.forEach(function (child) {
      return deleteChild(returnFiber, child);
    });
  }
  //!只是改变了fiber的结构 但是真实DOM是没有变化的所以需要打上标记
  return resultingFirstChild; //!这里返回的是已经排列好了的fiberTree
}

function updateFromMap(existingChildren, returnFiber, newIdx, newChild, lanes) {
  if (typeof newChild === "string" || typeof newChild === "number") {
    const matchedFiber = existingChildren.get(newIdx) || null;
    return updateTextNode(returnFiber, matchedFiber, "" + newChild, lanes);
  }

  if (typeof newChild === "object" && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        const matchedFiber =
          existingChildren.get(newChild.key === null ? newIdx : newChild.key) ||
          null;
        return updateElement(returnFiber, matchedFiber, newChild, lanes);
      default:
    }
  }

  return null;
}

function mapRemainingChildren(returnFiber, currentFirstChild) {
  const existingChildren = new Map();
  let existingChild = currentFirstChild;

  while (existingChild !== null) {
    if (existingChild.key !== null) {
      existingChildren.set(existingChild.key, existingChild);
    } else {
      existingChildren.set(existingChild.index, existingChild);
    }
    existingChild = existingChild.sibling;
  }

  return existingChildren;
}

function createChild(returnFiber, newChild, lanes) {
  //!如果是文本就创建文本节点
  if (typeof newChild === "string" || typeof newChild === "number") {
    const created = createFiberFromText("" + newChild, returnFiber.mode, lanes);
    created.return = returnFiber;
    return created;
  }

  //!如果是元素就创建元素
  if (typeof newChild === "object" && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE: {
        const created = createFiberFromElement(
          newChild,
          returnFiber.mode,
          lanes
        );

        created.ref = coerceRef(returnFiber, null, newChild);
        created.return = returnFiber;
        return created;
      }
      default:
    }
  }

  return null;
}

//!只有key和tag相同的时候才会复用fiber  否则返回null
function updateSlot(returnFiber, oldFiber, newChild, lanes) {
  const key = oldFiber !== null ? oldFiber.key : null;

  //!处理文本类型
  if (typeof newChild === "string" || typeof newChild === "number") {
    //!文本的key是null 但是如果之前的不是null则不相等 返回null
    if (key !== null) {
      return null;
    }
    //!key相等就返回复用后的内容
    return updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
  }

  if (typeof newChild === "object" && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        if (newChild.key === key) {
          return updateElement(returnFiber, oldFiber, newChild, lanes);
        } else {
          return null;
        }
      default:
    }
  }
  //!都不匹配返回null
  return null;
}

function updateTextNode(returnFiber, current, textContent, lanes) {
  //!如果current(当前渲染的)tag不是文本类型那么需要创建新的文本fiber
  if (current === null || current.tag !== HostText) {
    const created = createFiberFromText(textContent, returnFiber.mode, lanes);
    created.return = returnFiber;
    return created;
  }
  //!如果之前是文本节点复用即可
  else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const existing = useFiber(current, textContent);
    existing.return = returnFiber;
    return existing;
  }
}

function updateElement(returnFiber, current, element, lanes) {
  if (current !== null) {
    //!相同则复用
    if (current.elementType === element.type) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const existing = useFiber(current, element.props);
      existing.ref = coerceRef(returnFiber, current, element);
      existing.return = returnFiber;
      return existing;
    }
  }

  //!不同则创建
  const created = createFiberFromElement(element, returnFiber.mode, lanes);
  created.ref = coerceRef(returnFiber, current, element);
  created.return = returnFiber;
  return created;
}

/**
 *
 * @param {*} newFiber 新计算出的workInProgress
 * @param {*} lastPlacedIndex 最新的固定节点
 * @param {*} newIndex 当前遍历的index
 * @param {*} shouldTrackSideEffects update or mount
 * @returns
 */

function placeChild(
  newFiber,
  lastPlacedIndex,
  newIndex,
  shouldTrackSideEffects
) {
  newFiber.index = newIndex;

  if (!shouldTrackSideEffects) {
    return lastPlacedIndex;
  }

  const current = newFiber.alternate;

  //!表示这个节点是复用了 newChildren[index]和current是同一个节点
  if (current !== null) {
    const oldIndex = current.index;
    /*
     * 旧的: A-B-C-D
     * 新的: A-B-D-C
     * 对比到C的时候 LPI = 3 oldIndex = 2 2<3需要将C移动到D后面
     * */
    if (oldIndex < lastPlacedIndex) {
      newFiber.flags = Placement;
      return lastPlacedIndex;
    }
    //!如果是大于等于 表示不需要移动 返回oldIndex即可
    else {
      return oldIndex;
    }
  }
  //!表示current链中没有符合newChildren的需要增加
  else {
    newFiber.flags = Placement;
    return lastPlacedIndex;
  }
}

/**
 *
 * @param {*} returnFiber
 * @param {*} currentFirstChild
 * @param {*} textContent //string 最新的内容
 * @param {*} lanes
 * @returns
 */
export function reconcileSingleTextNode(
  returnFiber,
  currentFirstChild,
  textContent,
  lanes,
  shouldTrackSideEffects
) {
  //!不用对比 直接全部删掉即可
  if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
    deleteRemainingChildren(
      returnFiber,
      currentFirstChild.sibling,
      shouldTrackSideEffects
    );
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const existing = useFiber(currentFirstChild, textContent);
    existing.return = returnFiber;
    return existing;
  }

  //!如果原本没有就创建一个
  deleteRemainingChildren(
    returnFiber,
    currentFirstChild,
    shouldTrackSideEffects
  );
  var created = createFiberFromText(textContent, returnFiber.mode, lanes);
  created.return = returnFiber;
  return created;
}

//!对于单个节点来说 只有复用和删除两种操作
/*
 * 旧的:A-B-C
 * 新的:B
 *
 * 旧的:A
 * 新的:B
 *
 * 旧的:-
 * 新的:B
 * 单节点更新 是指新的element是单个节点也就是object类型
 * 这个时候 有三种情况旧的有几个 一个 或则没有 一个或则几个的情况可以遍历这个oldFiber
 * 找到与新的element对应的元素 然后更新 并且删除其他元素即可
 * 对于之前没有 现在有了的 直接创建就可以了
 * * */
export function reconcileSingleElement(
  returnFiber, //workInProgress fiber
  currentFirstChild, //currentChildFiber
  element, //最新的props
  lanes,
  shouldTrackSideEffects
) {
  const key = element.key;
  let child = currentFirstChild;

  //!这个while循环就是处理旧的为一个或多个的情况
  while (child !== null) {
    if (child.key === key) {
      if (child.elementType === element.type) {
        //!如果找到匹配的了 删除后面所有的节点
        deleteRemainingChildren(
          returnFiber,
          child.sibling,
          shouldTrackSideEffects
        );
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const existing = useFiber(child, element.props); //!复用fiber
        existing.ref = coerceRef(returnFiber, child, element); //!获取ref
        existing.return = returnFiber; //!更改父fiber为workInProgress
        return existing; //!返回新构建出的fiber
      }
      deleteRemainingChildren(returnFiber, child, shouldTrackSideEffects);
      break;
    }
    //!如果不匹配删除当前元素
    else {
      deleteChild(returnFiber, child, shouldTrackSideEffects);
    }
    child = child.sibling;
  }

  //!如果走到这个位置了表示没有匹配到 删除之前的 并创建最新的即可
  const created = createFiberFromElement(element, returnFiber.mode, lanes);

  created.ref = coerceRef(returnFiber, currentFirstChild, element);
  created.return = returnFiber;
  return created;
}

//!标记为插入
export function placeSingleChild(newFiber, shouldTrackSideEffects) {
  if (shouldTrackSideEffects && newFiber.alternate === null) {
    newFiber.flags = Placement;
  }
  return newFiber;
}

//!删除(主要是打标记与添加effects链)当前的以及后面所有兄弟节点
export function deleteRemainingChildren(
  returnFiber,
  currentFirstChild,
  shouldTrackSideEffects
) {
  if (!shouldTrackSideEffects) {
    return null;
  }

  let childToDelete = currentFirstChild;

  while (childToDelete !== null) {
    deleteChild(returnFiber, childToDelete);
    childToDelete = childToDelete.sibling;
  }

  return null;
}

/**
 *
 * @param {*} returnFiber workInProgress fiber
 * @param {*} childToDelete
 */
function deleteChild(returnFiber, childToDelete, shouldTrackSideEffects) {
  if (!shouldTrackSideEffects) {
    return;
  }

  const last = returnFiber.lastEffect;

  if (last !== null) {
    //!给副作用链添加新的副作用 并将lastEffect的指针移动到最后一位
    last.nextEffect = childToDelete;
    returnFiber.lastEffect = childToDelete;
  } else {
    returnFiber.firstEffect = returnFiber.lastEffect = childToDelete;
  }

  //!格式化最后指针的下一个为null
  childToDelete.nextEffect = null;
  //!给当前flags打上标记 在commit阶段删除这个节点
  childToDelete.flags = Deletion;
}

//!检测ref是否合法 并转化为string(忽略这个逻辑 假设全部都是createRef或则useRef)
//!那么所有的ref都将会是{current:undefined}
function coerceRef(returnFiber, current, element) {
  return element.ref; //!{current:undefined}
}

//!通过element创建fiber元素
function createFiberFromElement(element, mode, lanes) {
  const { type, key, props: pendingProps } = element;
  const fiber = createFiberFromTypeAndProps(
    type,
    key,
    pendingProps,
    null,
    mode,
    lanes
  );

  return fiber;
}

/**
 * @param {*} type string function class
 * @param {*} key 唯一key
 * @param {*} pendingProps 最新的props
 * @param {*} owner null
 * @param {*} mode noMode
 * @param {*} lanes 渲染优先级
 */
function createFiberFromTypeAndProps(
  type,
  key,
  pendingProps,
  owner,
  mode,
  lanes
) {
  let fiberTag = IndeterminateComponent;
  let resolvedType = type;

  //!主要是为了修改tag这几个条件语句
  if (typeof type === "function") {
    //!判断是否是类组件
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent;
    } else {
      fiberTag = FunctionComponent;
    }
  }
  //!如果是字符串的html
  else if (typeof type === "string") {
    fiberTag = HostComponent;
  }
  //!如果是对象考虑是context和provider
  else if (typeof type === "object") {
    switch (type.$$typeof) {
      case REACT_PROVIDER_TYPE:
        fiberTag = ContextProvider;
        break;
      case REACT_CONTEXT_TYPE:
        fiberTag = ContextConsumer;
        break;
      default:
    }
  }

  const fiber = createFiber(fiberTag, pendingProps, key, mode);
  fiber.elementType = type;
  fiber.type = resolvedType;
  fiber.lanes = lanes;

  return fiber;
}

//!如果原型上有isReactComponent属性则是类组件
//!在extends React.Component的时候会有isReactComponent = true
function shouldConstruct(Component) {
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}

function useFiber(fiber, pendingProps) {
  var clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

function createFiberFromText(content, mode, lanes) {
  const fiber = createFiber(HostText, content, null, mode);
  fiber.lanes = lanes;
  return fiber;
}
