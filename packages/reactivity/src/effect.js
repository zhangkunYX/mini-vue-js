export const ITERATE_KEY = Symbol()

let activeEffect
let bucket = new WeakMap() // weakmap的key时弱引用，能够被垃圾回收器回收
const effectStack = []
export const effect = (fn, options = {}) => {
  // activeEffect = fn
  let res
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    effectStack.push(effectFn)
    res = fn()
    effectStack.pop(effectFn)
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  // 收集该副作用存在于哪些依赖集合中
  effectFn.options = options
  effectFn.deps = []
  if (!options.lazy) {
    effectFn()
  }
  return effectFn
}

const cleanup = function(effectFn) {
  for (var i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }
  effectFn.deps.length = 0
}

export const track = function(target, key) {
  if (!activeEffect) return
  let depsMap = bucket.get(target)
  if (!depsMap) bucket.set(target, depsMap = new Map())
  let deps = depsMap.get(key)
  if (!deps) depsMap.set(key, deps = new Set())
  deps.add(activeEffect)
  // 收集该副作用存在的依赖集合
  activeEffect.deps.push(deps)
}

export const trigger = function(target, key) {
  let depsMap = bucket.get(target)
  if(!depsMap) return
  let effects = depsMap.get(key)
  // effects && effects.forEach(fn => fn()) // 导致无限循环,同时在清除和添加effect
  const effectsToRun = new Set()
  // 只有当前的副作用函数和trigger的副作用函数不同时，才执行，避免死循环
  effects && effects.forEach(effect => {
    if (effect !== activeEffect) effectsToRun.add(effect)
  })
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
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