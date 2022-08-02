import { UpdateState } from "../react-dom-types";

export default function createUpdate(eventTime, lane) {
  var update = {
    eventTime: eventTime, //!更新的产生时间
    lane: lane, //!表示优先级
    tag: UpdateState, //!0表示更新是哪种类型（UpdateState，ReplaceState，ForceUpdate，CaptureUpdate）
    payload: null, //!更新所携带的状态。在类组件中，有两种可能，对象（{}），和函数（(prevState, nextProps):newState => {}）
    //!根组件中，为React.element，即ReactDOM.render的第一个参数
    callback: null, //!可理解为setState的回调
    next: null, //!下一个update指针
  };
  return update;
}
