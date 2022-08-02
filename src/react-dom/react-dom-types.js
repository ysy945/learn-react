export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
export const COMMENT_NODE = 8;
export const DOCUMENT_NODE = 9;

export const randomKey = Math.random().toString(36).slice(2);
export const internalInstanceKey = "__reactFiber$" + randomKey;
export const internalPropsKey = "__reactProps$" + randomKey;
export const internalContainerInstanceKey = "__reactContainer$" + randomKey;
export const internalEventHandlersKey = "__reactEvents$" + randomKey;

//!标识是否已经绑定过事件了
export const listeningMarker = "_reactListeningMarker";

//!标识是否是冒泡阶段
export const IS_CAPTURE_PHASE = 4;

//!事件监听的优先级
export const DiscreteEvent = 0;
export const UserBlockingEvent = 1;
export const ContinuousEvent = 2;

//!事件的优先级 越大优先级越高
export const ImmediatePriority$1 = 99;
export const UserBlockingPriority$2 = 98;
export const NormalPriority$1 = 97;
export const LowPriority$1 = 96;
export const IdlePriority$1 = 95; // NoPriority is the absence of priority. Also React-only.
export const NoPriority$1 = 90;

//!标识当前fiber是什么类型的节点

export const FunctionComponent = 0;
export const ClassComponent = 1;
export const IndeterminateComponent = 2;
export const HostRoot = 3;
export const HostPortal = 4;
export const HostComponent = 5;
export const HostText = 6;
export const Fragment = 7;
export const Mode = 8;
export const ContextConsumer = 9;
export const ContextProvider = 10;

export const NoTimestamp = -1;

export const UpdateState = 0;
export const ReplaceState = 1;
export const ForceUpdate = 2;
export const CaptureUpdate = 3;

//!react 执行上下文
export const NoContext = 0;
export const BatchedContext = 1;
export const LegacyUnbatchedContext = 8;
export const EventContext = 2;
export const DiscreteEventContext = 4;
export const RenderContext = 16;
export const CommitContext = 32;
export const RetryAfterError = 64;

//!当前处于什么阶段
export const RootIncomplete = 0;
export const RootFatalErrored = 1;
export const RootErrored = 2;
export const RootSuspended = 3;
export const RootSuspendedWithDelay = 4;
export const RootCompleted = 5;

//!用于表示fiber有那些flag
export const NoFlags = 0;
export const PerformedWork = 1;
export const Placement = 2; //!标识插入
export const Update = 4; //!标识更新
export const PlacementAndUpdate = 6; //!插入和更新
export const Deletion = 8; //!标识需要删除
export const ContentReset = 16; //!标识需要重设文本节点的内容
export const Callback = 32; //!标识传递了callback函数
export const DidCapture = 64;
export const Ref = 128; //!标识Ref
export const Snapshot = 256; //!标记getSnapshotBeforeUpdate
export const Passive = 512; //!
export const Incomplete = 2048; //!是否处于complete阶段(只有在complete阶段出错了才会标志这个)
export const ShouldCapture = 4096;
export const PassiveUnmountPendingDev = 8192;

//!hooks
export const NoFlags$1 = 0;
export const hasEffect = 1;
export const Layout = 2;
export const Passive$1 = 4;

export const REACT_ELEMENT_TYPE = Symbol.for("react.element");
export const REACT_CLASS_TYPE = Symbol.for("react.class");
export const REACT_FUNCTION_TYPE = Symbol.for("react.function");
export const REACT_PROVIDER_TYPE = Symbol.for("react.provider");
export const REACT_CONTEXT_TYPE = Symbol.for("react.context");

export const STYLE = "style";
export const CHILDREN = "children";
