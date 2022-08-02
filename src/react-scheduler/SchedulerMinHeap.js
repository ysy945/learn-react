export function createHeap(heap = []) {
  return [...heap];
}

function siftUp(heap, node, index) {
  let parentIndex;
  do {
    //获取父亲的位置
    parentIndex = index % 2 === 0 ? index / 2 - 1 : (index - 1) / 2;
    //比较孩子的大小与父亲的大小
    if (compare(heap[parentIndex], node) > 0) {
      //父亲大于孩子需要交换
      heap[index] = heap[parentIndex];
      heap[parentIndex] = node;
    }
    //重置index
    index = parentIndex;
  } while (parentIndex > 0);
}

function siftDown(heap, index) {
  const length = heap.length;
  let leftIndex, rightIndex;

  do {
    leftIndex = index * 2 + 1;
    rightIndex = (index + 1) * 2;
    if (leftIndex >= length) break;
    const left = heap[leftIndex];
    const right = heap[rightIndex];
    //最后一个是空的
    if (rightIndex === length) {
      //如果要交换的值大于left则需要交换
      if (compare(heap[index], heap[leftIndex]) > 0) {
        change(heap, index, leftIndex);
      }
      break;
    }
    //right小一点
    if (compare(left, right) > 0) {
      if (compare(heap[index], right) > 0) {
        change(heap, index, rightIndex);
        index = rightIndex;
        continue;
      }
    }
    //left小一点
    else {
      if (compare(heap[index], left) > 0) {
        change(heap, index, leftIndex);
        index = leftIndex;
        continue;
      }
    }
    break;
  } while (leftIndex < length || rightIndex < length);
}

function change(heap, index, changeIndex) {
  const temp = heap[index];
  heap[index] = heap[changeIndex];
  heap[changeIndex] = temp;
}

export function pop(heap) {
  if (heap.length === 0) return null;
  if (heap.length === 1) return heap.pop();
  //把推出的元素缓存起来
  const first = heap[0];
  heap[0] = heap.pop(); //让最后一个元素的值为第一个元素的值
  siftDown(heap, 0);

  return first;
}

//获取第一个元素
export function peek(heap) {
  return heap.length === 0 ? null : heap[0];
}

export function push(heap, heapNode) {
  const index = heap.length;
  heap.push(heapNode);
  if (index > 0) siftUp(heap, heapNode, index);
}

function compare(a, b) {
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}

// const heap = createHeap();
// push(heap, new HeapNode(5));
// push(heap, new HeapNode(1));
// push(heap, new HeapNode(1));
// push(heap, new HeapNode(3));
// push(heap, new HeapNode(8));
// push(heap, new HeapNode(7));
// push(heap, new HeapNode(6));
// push(heap, new HeapNode(5));
// push(heap, new HeapNode(2));
// console.log(pop(heap));
// console.log(pop(heap));
// console.log(pop(heap));
// console.log(pop(heap));
// console.log(pop(heap));
// console.log(pop(heap));
// console.log(pop(heap));
// console.log(pop(heap));
// console.log(pop(heap));

// console.log(heap);
