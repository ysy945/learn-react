import { setTextContent } from "./commitRoot";
import {
  ClassComponent,
  FunctionComponent,
  HostRoot,
  HostComponent,
  HostText,
  internalInstanceKey,
  internalPropsKey,
  Update,
  Ref,
  STYLE,
  CHILDREN,
} from "./react-dom-types";

//!主要是执行props的diff与更新或者创建(真实DOM的创建)
export default function completeWork(current, workInProgress, renderLanes) {
  //!获取最新的props
  const newProps = workInProgress.pendingProps;

  switch (workInProgress.tag) {
    case FunctionComponent:
    case ClassComponent:
      return null;
    case HostRoot: {
      updateHostContainer(workInProgress);
      return null;
    }

    //!对于普通的html标签
    case HostComponent: {
      const type = workInProgress.type;

      //!通过判断current是否存在 和stateNode是否存在 来确定当前是创建还是更新
      //!例如第一次渲染current一定不存在 所以是创建 而第n次走到这里就是更新
      if (current !== null && workInProgress.stateNode != null) {
        //!已经存在 更新
        updateHostComponent(current, workInProgress, type, newProps);

        if (current.ref !== workInProgress.ref) {
          markRef$1(workInProgress);
        }
      }
      //!这里表示创建
      else {
        //!创建实例构建真实DOM
        const instance = createInstance(
          type, //!p
          newProps,
          null, //rootContainerInstance
          null, //currentHostContext
          workInProgress
        );
        //!深度遍历 子节点->兄弟节点->父节点 让其所有节点全部添加到instance上
        appendAllChildren(instance, workInProgress, false, false);
        //!让workInProgress的节点指向真实DOM
        workInProgress.stateNode = instance;

        //!设置初始的props值
        if (
          finalizeInitialChildren(
            instance,
            type,
            newProps,
            null //rootContainerInstance
          )
        ) {
          //!如果需要自动聚焦等 需要标记更新
          markUpdate$1(workInProgress);
        }
      }
      //!如果有ref标记一下
      if (workInProgress.ref !== null) {
        markRef$1(workInProgress);
      }
      return null;
    }

    //!对于文本内容
    case HostText: {
      const newText = newProps;
      //!更新
      if (current && workInProgress.stateNode != null) {
        const oldText = current.memoizedProps;
        updateHostText$1(current, workInProgress, oldText, newText);
      }
      //!创建
      else {
        if (typeof newText !== "string") {
          if (!(workInProgress.stateNode !== null)) {
            throw Error(
              "We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue."
            );
          }
        }
        workInProgress.stateNode = createTextInstance(
          newText,
          null, //_rootContainerInstance,
          null, //_currentHostContext,
          workInProgress
        );
      }
      return null;
    }

    default:
  }
}

function createTextInstance(
  text,
  rootContainerInstance,
  hostContext,
  internalInstanceHandle
) {
  const textNode = document.createTextNode(text);
  precacheFiberNode(internalInstanceHandle, textNode);
  return textNode;
}

function updateHostText$1(current, workInProgress, oldText, newText) {
  //!新旧内容不一致标记为更新
  if (oldText !== newText) {
    markUpdate$1(workInProgress);
  }
}

//!什么都没有做
function updateHostContainer(workInProgress) {}

/**
 *
 * @param {*} type p
 * @param {*} props 当前最新的props
 * @param {*} rootContainerInstance 根结点实例div=root
 * @param {*} hostContext null
 * @param {*} internalInstanceHandle workInProgress
 * @returns
 */
function createInstance(
  type,
  props,
  rootContainerInstance,
  hostContext,
  internalInstanceHandle
) {
  //!创建真实DOM
  var domElement = createElement(type, props, rootContainerInstance);
  //!将fiber 挂载到DOM节点上
  precacheFiberNode(internalInstanceHandle, domElement);
  //!将props挂载到DOM上
  updateFiberProps(domElement, props);
  return domElement;
}

function precacheFiberNode(hostInst, node) {
  node[internalInstanceKey] = hostInst;
}

export function updateFiberProps(node, props) {
  node[internalPropsKey] = props;
}

function createElement(type, props, rootContainerElement) {
  return document.createElement(type);
}

//!将workInProgress上所有第一层child插入到instance上
function appendAllChildren(
  parent,
  workInProgress,
  needsVisibilityToggle,
  isHidden
) {
  //!我们只有创建的顶部fiber,但我们需要沿着其递归子节点查找所有终端节点。
  let node = workInProgress.child;

  //!深度优先遍历插入
  while (node !== null) {
    //!如果子节点的tag普通html节点或则为文本节点
    if (node.tag === HostComponent || node.tag === HostText) {
      //!将node.stateNode插入parent中
      appendInitialChild(parent, node.stateNode);
    }
    //!处理fragment
    else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    //!如果遍历到workInProgress就退出
    if (node === workInProgress) {
      return;
    }

    //!如果当前节点已经没有兄弟节点了退到父节点
    while (node.sibling === null) {
      //!如果已经退到null了就返回
      if (node.return === null || node.return === workInProgress) {
        return;
      }
      node = node.return;
    }

    //!锁定父节点
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

//!插入DOM
function appendInitialChild(parentInstance, child) {
  parentInstance.appendChild(child);
}

function finalizeInitialChildren(
  domElement,
  type,
  props,
  rootContainerInstance,
  hostContext
) {
  //!因为是第一次渲染需要设置初始的Props
  setInitialProperties(domElement, type, props, rootContainerInstance);
  return shouldAutoFocusHostComponent(type, props);
}

//!是否需要自动聚焦如果需要则打上标记
export function shouldAutoFocusHostComponent(type, props) {
  switch (type) {
    case "button":
    case "input":
    case "select":
    case "textarea":
      return !!props.autoFocus;
    default:
      break;
  }

  return false;
}

/**
 *
 * @param {*} domElement 当前workInProgress对应的真实DOM
 * @param {*} tag 真实DOM的类型
 * @param {*} rawProps 他的props
 * @param {*} rootContainerElement 根DOM div=root
 */
function setInitialProperties(domElement, tag, rawProps, rootContainerElement) {
  let props = rawProps;
  assertValidProps(tag, props);
  setInitialDOMProperties(tag, domElement, rootContainerElement, props, true);
  //!如果当前有onClick这个参数 设置为noop只有click会设置为noop
  if (typeof props.onClick === "function") {
    trapClickOnNonInteractiveElement(domElement);
  }
}

function setInitialDOMProperties(
  tag,
  domElement,
  rootContainerElement,
  nextProps,
  isCustomComponentTag
) {
  //!nextProps={style:{backgroundColor:'red'},target:true}
  for (const propKey in nextProps) {
    //!如果属性中不存在则跳过
    if (!nextProps.hasOwnProperty(propKey)) {
      continue;
    }
    //!获取当前props的值
    const nextProp = nextProps[propKey];

    //!如果当前propKey为'style'
    if (propKey === STYLE) {
      if (nextProp) {
        Object.freeze(nextProp);
      }
      setValueForStyles(domElement, nextProp);
    }
    //!如果key = children 只有<p>123</p>这种情况才会通过props处理
    else if (propKey === CHILDREN) {
      //!如果是字符串 设置内容
      if (typeof nextProp === "string") {
        const canSetTextContent = tag !== "textarea" || nextProp !== "";

        if (canSetTextContent) {
          setTextContent(domElement, nextProp);
        }
      }
      //!如果是数字转换一下在设置
      else if (typeof nextProp === "number") {
        setTextContent(domElement, "" + nextProp);
      }
    }
    //!剩下的直接设置
    else if (nextProp != null) {
      setValueForProperty(domElement, propKey, nextProp);
    }
  }
}

export function setValueForStyles(node, styles) {
  const style = node.style;
  for (const styleName in styles) {
    if (!styles.hasOwnProperty(styleName)) {
      continue;
    }
    style[styleName] = styles[styleName];
  }
}

export function setValueForProperty(node, name, value) {
  //!如果设置以on ON oN On开头的属性全部忽略
  if (shouldIgnoreAttribute(name)) {
    return;
  }

  //!如果是null 删除这个属性
  if (shouldRemoveAttribute(name, value)) {
    value = null;
  }
  const attributeName = name;

  if (value === null) {
    node.removeAttribute(attributeName);
  } else {
    //!设置属性
    node.setAttribute(attributeName, "" + value);
  }
  return;
}

//!如果设置的值是null或则"undefined"就移除属性
function shouldRemoveAttribute(name, value) {
  if (value === null || typeof value === "undefined") {
    return true;
  }
  return false;
}

//!如果是on开头绑定事件就忽略
function shouldIgnoreAttribute(name) {
  //!on开头
  if (
    name.length > 2 &&
    (name[0] === "o" || name[0] === "O") &&
    (name[1] === "n" || name[1] === "N")
  ) {
    return true;
  }

  return false;
}

function trapClickOnNonInteractiveElement(domElement) {
  domElement.onClick = noop;
}
function noop() {}

//!标记为更新
function markUpdate$1(workInProgress) {
  workInProgress.flags |= Update;
}

//!标记为含有ref
function markRef$1(workInProgress) {
  workInProgress.flags |= Ref;
}

//!监测DOM的props是否正确
function assertValidProps(tag, props) {
  if (!props) {
    return;
  }
  if (!(props.style == null || typeof props.style === "object")) {
    throw Error(
      "The `style` prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + 'em'}} when using JSX."
    );
  }
}

//!对比更新当前DOM的properties
function updateHostComponent(
  current,
  workInProgress,
  type,
  newProps,
  rootContainerInstance
) {
  const oldProps = current.memoizedProps;

  //!如果新旧props相同就不需要更新
  if (oldProps === newProps) {
    return;
  }

  const instance = workInProgress.stateNode;

  const updatePayload = prepareUpdate(instance, type, oldProps, newProps);
  workInProgress.updateQueue = updatePayload; //!用于commit阶段的更新

  //!如果有payload表示diff的结果有需要更新的地方 打上需要更新的标记 在commit阶段去更新他
  if (updatePayload) {
    markUpdate$1(workInProgress);
  }
}

function prepareUpdate(domElement, type, oldProps, newProps) {
  return diffProperties(domElement, type, oldProps, newProps);
}

//!用之前的props和新的props做对比 得出需要改变的props并修改
function diffProperties(domElement, tag, lastRawProps, nextRawProps) {
  let updatePayload = null;
  const lastProps = lastRawProps;
  const nextProps = nextRawProps;
  let styleUpdates = null;

  //!这里是如果lastProps中有 但是nextProps中没有就需要删除 键就是key 值就是null
  for (const propKey in lastProps) {
    if (
      nextProps.hasOwnProperty(propKey) ||
      !lastProps.hasOwnProperty(propKey) ||
      lastProps[propKey] == null
    ) {
      continue;
    }

    //!表示需要删除整个style属性
    if (propKey === STYLE) {
      const lastStyle = lastProps[propKey]; //!获取之前的style对象
      for (const styleName in lastStyle) {
        if (lastStyle.hasOwnProperty(styleName)) {
          if (!styleUpdates) {
            styleUpdates = {};
          }
          styleUpdates[styleName] = ""; //!那么遍历拿到所有styles的key并把要删除的变为空值
        }
      }
    }
    //!在这里执行删除逻辑 也就是赋值为null 最终返回的形式是[key,value]如果value为null表示删除
    else {
      (updatePayload = updatePayload || []).push(propKey, null);
    }
  }

  //!两次的值不同 就有可能有新增 或则是改变了
  for (const propKey in nextProps) {
    const nextProp = nextProps[propKey]; //!获取属性值value
    const lastProp = lastProps != null ? lastProps[propKey] : undefined; //!获取之前的value

    //!必须保证两次的值不同
    if (
      !nextProps.hasOwnProperty(propKey) ||
      nextProp === lastProp ||
      (nextProp == null && lastProp == null)
    ) {
      continue;
    }

    //!如果走到这里表示style属性需要改变或则新增
    if (propKey === STYLE) {
      if (nextProp) {
        Object.freeze(nextProp);
      }

      if (lastProp) {
        //!执行和之前一样的逻辑来判断是否需要删除style中的某个属性
        for (const styleName in lastProp) {
          if (
            //!last中有 next中没有
            lastProp.hasOwnProperty(styleName) &&
            (!nextProp || !nextProp.hasOwnProperty(styleName))
          ) {
            if (!styleUpdates) {
              styleUpdates = {};
            }

            styleUpdates[styleName] = "";
          }
        }

        //!这个循环是为了找出新增或则不同的赋值到styleUpdates中如果value为null表示删除
        for (const styleName in nextProp) {
          if (
            nextProp.hasOwnProperty(styleName) &&
            lastProp[styleName] !== nextProp[styleName]
          ) {
            if (!styleUpdates) {
              styleUpdates = {};
            }

            styleUpdates[styleName] = nextProp[styleName];
          }
        }
      }
      //! 如果lastProp不存在表示之前没有style属性
      else {
        //!如果本次也没有styleUpdates表示之前没有style属性 现在也没有style属性 添加为空就行了
        if (!styleUpdates) {
          if (!updatePayload) {
            updatePayload = [];
          }

          updatePayload.push(propKey, styleUpdates);
        }

        //!走到这里表示之前没有style 现在又了 所以把当前的style值赋值给styleUpdates就行了
        styleUpdates = nextProp;
      }
    }
    //!如果走到这里表示children属性需要改变或则新增
    else if (propKey === CHILDREN) {
      if (typeof nextProp === "string" || typeof nextProp === "number") {
        (updatePayload = updatePayload || []).push(propKey, "" + nextProp);
      }
    }
    //!走到这里表示要改变或则新增
    else {
      (updatePayload = updatePayload || []).push(propKey, nextProp);
    }
  }

  //!对styleUpdates做最后处理 如果存在放入updatePayload中
  if (styleUpdates) {
    (updatePayload = updatePayload || []).push(STYLE, styleUpdates);
  }

  return updatePayload;
}
