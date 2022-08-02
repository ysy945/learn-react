import React from "./react";

export default function App(props) {
  const [number, setNumber] = React.useState(0);
  debugger;
  React.useEffect(() => {
    debugger;
    console.log(111);
    return () => console.log(222);
  });
  React.useEffect(() => {
    console.log(333);
    return () => console.log(444);
  });
  return (
    <div
      onClick={() => {
        setNumber(2);
      }}
    >
      我是App组件：{number}
    </div>
  );
}
