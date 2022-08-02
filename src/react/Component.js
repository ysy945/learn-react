import ReactNoopUpdateQueue from "./ReactNoopUpdateQueue";

const emptyObject = {};
export default class Component {
  constructor(props, context, updater) {
    this.props = props;
    this.context = context;
    this.refs = emptyObject;
    this.updater = updater || ReactNoopUpdateQueue;
  }
}

Component.prototype.isReactComponent = {};
Component.prototype.setState = function (partialState, callback) {
  if (
    typeof partialState !== "object" &&
    typeof partialState !== "function" &&
    partialState != null
  ) {
    throw new Error(
      "setState(...): takes an object of state variables to update or a " +
        "function which returns an object of state variables."
    );
  }
  this.updater.enqueueSetState(this, partialState, callback, "setState");
};

Component.prototype.forceUpdate = function (callback) {
  this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
};

function PureComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}

function ComponentDummy() {}
ComponentDummy.prototype = Component.prototype;

const pureComponentPrototype = (PureComponent.prototype = new ComponentDummy());
pureComponentPrototype.constructor = PureComponent;

Object.assign(pureComponentPrototype, Component.prototype);
pureComponentPrototype.isPureReactComponent = true;

export { Component, PureComponent };
