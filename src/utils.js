/**
 * const a = {a:1}
 * const copy = extendSyntax(a,['a',"asd"])
 */
function extendSyntax(obj, ...args) {
  const copy = {};
  for (const key in obj) {
    copy[key] = obj[key];
  }
  args.forEach((entries) => {
    const [key, value] = entries;
    if (!value) delete copy[key];
    else copy[key] = value;
  });
  return copy;
}

const utils = {
  extendSyntax,
};

export default utils;
