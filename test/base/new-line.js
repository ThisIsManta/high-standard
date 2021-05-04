/* eslint-disable no-unused-vars */

console.log('a', 'b')
console.log(
  'a',
  'b'
)

const a = { a: 1, b: 1 }
const b = {
  a: 1,
  b: 1,
}

function f(a, b, c) {}

function g(a,
  b, c,
) {}

f(a,
  b,
)

g(a, b)

if ((a && b) ||
  (f && g)) {
  void a
}
