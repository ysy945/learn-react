/*var EventInterface = {
  eventPhase: 0,
  bubbles: 0,
  cancelable: 0,
  timeStamp: function (event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: 0,
  isTrusted: 0,
};*/

export default function createSyntheticEvent(Interface) {
  //!合成基础的合成事件

  function functionThatReturnsTrue() {
    return true;
  }
  function functionThatReturnsFalse() {
    return false;
  }
  function SyntheticBaseEvent(
    reactName,
    reactEventType,
    targetInst,
    nativeEvent,
    nativeEventTarget
  ) {
    this._reactName = reactName; //!onClick
    this._targetInst = targetInst; //!对应的fiber
    this.type = reactEventType; //!click
    this.nativeEvent = nativeEvent; //!事件源event
    this.target = nativeEventTarget; //!事件节点a
    this.currentTarget = null;

    //!处理传进来的interface 全部赋值给this 如果是函数 实际上是需要event来做处理
    for (const _propName in Interface) {
      if (!Interface.hasOwnProperty(_propName)) {
        continue;
      }

      const normalize = Interface[_propName];

      if (normalize) {
        this[_propName] = normalize(nativeEvent);
      } else {
        this[_propName] = nativeEvent[_propName];
      }
    }

    //!判断当前defaultPrevented的值
    let defaultPrevented =
      nativeEvent.defaultPrevented != null
        ? nativeEvent.defaultPrevented
        : nativeEvent.returnValue === false;

    if (defaultPrevented) {
      this.isDefaultPrevented = functionThatReturnsTrue;
    } else {
      this.isDefaultPrevented = functionThatReturnsFalse;
    }

    this.isPropagationStopped = functionThatReturnsFalse;
    return this;
  }
  //!分配preventDefault和stopPropagation
  Object.assign(SyntheticBaseEvent.prototype, {
    preventDefault: function () {
      this.defaultPrevented = true;
      var event = this.nativeEvent;

      if (!event) {
        return;
      }

      if (event.preventDefault) {
        event.preventDefault(); // $FlowFixMe - flow is not aware of `unknown` in IE
      } else if (typeof event.returnValue !== "unknown") {
        event.returnValue = false;
      }

      this.isDefaultPrevented = functionThatReturnsTrue;
    },
    //!一旦合成事件调用了stopPropagation那么isPropagationStopped会被置为true
    //!这样后面的事件可以根据这个变量来取消执行或则继续执行
    stopPropagation: function () {
      var event = this.nativeEvent;

      if (!event) {
        return;
      }

      if (event.stopPropagation) {
        event.stopPropagation(); // $FlowFixMe - flow is not aware of `unknown` in IE
      } else if (typeof event.cancelBubble !== "unknown") {
        event.cancelBubble = true;
      }

      this.isPropagationStopped = functionThatReturnsTrue;
    },
  });

  return SyntheticBaseEvent;
}
