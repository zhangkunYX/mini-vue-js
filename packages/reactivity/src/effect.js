export const ITERATE_KEY = Symbol()

let activeEffect
let bucket = new WeakMap() // weakmap的key时弱引用，能够被垃圾回收器回收
export const effect = (fn) => {
  activeEffect = fn
  fn()
}

const track = function(target, key) {
  if (!activeEffect) return target[key]
  let depsMap = bucket.get(target)
  if (!depsMap) bucket.set(target, depsMap = new Map())
  let deps = depsMap.get(key)
  if (!deps) depsMap.set(key, deps = new Set())
  deps.add(activeEffect)
}

const trigger = function(target, key) {
  let depsMap = bucket.get(target)
  if(!depsMap) return
  let effects = depsMap.get(key)
  effects && effects.forEach(fn => fn())
}

export const reactive = (obj) => {
  const result = new Proxy(obj, {
    get(target, key) {
      track(target, key)
      return target[key]
    },
    set(target, key, value) {
      target[key] = value
      trigger(target, key)
      return true
    }
  })
  return result
}