export const ITERATE_KEY = Symbol()

let activeEffect = new Set()
export const effect = (fn) => {
  // 无法姜副作用函数和对象的key关联
  activeEffect.add(fn)
  fn()
}

export const reactive = (obj) => {
  const result = new Proxy(obj, {
    get(target, key) {
      return target[key]
    },
    set(target, key, value) {
      target[key] = value
      // 缺点：设置任何一个值时，所有的副作用函数都会执行
      activeEffect.forEach(fn => fn())
      return true
    }
  })
  return result
}