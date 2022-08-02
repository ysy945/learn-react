import React from "./react";

export default class C extends React.Component {
  constructor(props) {
    super(props);
    this.state = { a: 1 };
  }
  checkClick = () => {
    console.log(111);
    debugger;
    this.setState({ a: 2 });
  };
  render() {
    return <div onClick={this.checkClick}>点击我 我是{this.state.a}</div>;
  }
}
