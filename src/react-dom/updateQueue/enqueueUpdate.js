export default function enqueueUpdate(fiber, update) {
  const updateQueue = fiber.updateQueue;

  //!组件卸载后 不做处理
  if (updateQueue === null) {
    return;
  }

  const sharedQueue = updateQueue.shared;
  const pending = sharedQueue.pending; //!尾指针 next代表头指针 循环链表

  //!sharedQueue是一个循环链表 第一次构建赋值给update
  if (pending === null) {
    update.next = update;
  }
  //!第n次构建 让update的下一个指向头指针 pending的下一个指向update
  //!update->5
  //!pending-> 1 -> 2 -> 3    1 -> 2 -> 3 -> 5
  //!          | ------- |    | ------------ |
  else {
    update.next = pending.next;
    pending.next = update;
  }

  //!移动尾指针
  sharedQueue.pending = update;
}
