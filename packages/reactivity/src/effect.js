export const ITERATE_KEY = Symbol()

let activeEffect
let bucket = new WeakMap() // weakmap的key是弱引用，能够被垃圾回收器回收
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
  if (!activeEffect || !shouldTrack) return
  let depsMap = bucket.get(target)
  if (!depsMap) bucket.set(target, depsMap = new Map())
  let deps = depsMap.get(key)
  if (!deps) depsMap.set(key, deps = new Set())
  deps.add(activeEffect)
  // 收集该副作用存在的依赖集合
  activeEffect.deps.push(deps)
}

export const trigger = function(target, key, type, newValue) {
  let depsMap = bucket.get(target)
  if(!depsMap) return

  let effects = depsMap.get(key)
  // effects && effects.forEach(fn => fn()) // 导致无限循环,同时在清除和添加effect
  const effectsToRun = new Set()
  // 只有当前的副作用函数和trigger的副作用函数不同时，才执行，避免死循环
  effects && effects.forEach(effect => {
    if (effect !== activeEffect) effectsToRun.add(effect)
  })

  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, key) => {
      if (key >= newValue) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) effectsToRun.add(effectFn)
        })
      }
    })
  }

  if (type === 'ADD' && Array.isArray(target)) {
    let lengthEffects = depsMap.get('length')
    lengthEffects && lengthEffects.forEach(effect => {
      if (effect !== activeEffect) effectsToRun.add(effect)
    })
  }

  if (
    type === 'ADD' || 
    type === 'DELETE' ||
    (type === 'SET' && Object.prototype.toString.call(target) === '[object Map]')
  ) {
    // 取得与ITERATE_KEY相关联的副作用函数(当给对象新增或者删除属性时，应该触发for in遍历)
    let iterateEffects = depsMap.get(ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effect => {
      if (effect !== activeEffect) effectsToRun.add(effect)
    })
  }

  if (
    (type === 'ADD' || type === 'DELETE') &&
    Object.prototype.toString.call(target) === '[object Map]'
  ) {
    let iterateEffects = depsMap.get(MAP_KEY_ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effect => {
      if (effect !== activeEffect) effectsToRun.add(effect)
    })
  }
  
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}

export const creatReactive = (obj, isShallow = false, isReadonly = false) => {
  return new Proxy(obj, {
    get(target, key, recevier) {
      if (key === 'raw') {
        return target
      }

      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, recevier)
      }

      if (!isReadonly && typeof(key) !== 'symbol') track(target, key)
      // return target[key]
      const res = Reflect.get(target, key, recevier)
      if (isShallow) {
        return res
      }
      if (typeof(res) === 'object' && res !== null) {
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
    },
    set(target, key, value, recevier) {
      if (isReadonly) {
        console.warn(`属性${key}是只读的`)
        return true
      }
      const oldVal = target[key]
      const type = Array.isArray(target) 
      ? Number(key) < target.length ? 'SET' : 'ADD'
      : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
      // target[key] = value
      const res = Reflect.set(target, key, value, recevier)

      // fix：从原型上读取属性，设置会属性导致副作用重复执行问题
      if (target === recevier.raw) {
        // 排除oldValue和value为NaN的情况，因为 NaN === NaN 为false
        if (oldVal !== value && (oldVal === oldVal || value === value)) {
          trigger(target, key, type, value)
        }
      }
      return res
    },
    // 用于拦截 'key' in obj 操作
    has(target, key) {
      track(target, key)
      return Reflect.has(target, key)
    },
    // 用于拦截 for in
    ownKeys(target) {
      Array.isArray(target) 
      ? track(target, 'length') 
      : track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
    // 用于拦截删除属性操作
    deleteProperty(target, key) {
      if (isReadonly) {
        console.warn(`属性${key}是只读的`)
        return true
      }
      const hasKey = Object.prototype.hasOwnProperty.call(target, key)
      const res = Reflect.deleteProperty(target, key)
      // const res = delete target[key]
      if (res && hasKey) {
        trigger(target, key, 'DELETE')
      }
      return res
    }
  })
}

const mutableInstrumenations = {
  add(key) {
    const target = this.raw
    const has = target.has(key)
    const res = target.add(key)
    if (!has) {
      trigger(target, ITERATE_KEY, 'ADD')
    }
    return res
  },
  delete(key) {
    const target = this.raw
    const has = target.has(key)
    const res = target.delete(key)
    if (has) {
      trigger(target, ITERATE_KEY, 'DELETE')
    }
    return res
  },
  get(key) {
    const target = this.raw
    const has = target.has(key)
    const res = target.get(key)
    if (has) {
      track(target, key)
      return typeof res === 'object' ? reactive(res) : res
    }
  },
  set(key, value) {
    const target = this.raw
    const has = target.has(key)
    const oldVal = target.get(key)
    const rawValue = value.raw ? value.raw : value
    target.set(key, rawValue)
    if (!has) {
      trigger(target, key, 'ADD')
    } else if (oldVal !== value || (oldVal === oldVal && value === value)) {
      trigger(target, key, 'SET')
    }
  },
  forEach(callback, thisArg) {
    const target = this.raw
    const wrap = val => typeof(val) === 'object' ? reactive(val) : val
    track(target, ITERATE_KEY)
    target.forEach((value, key) => {
      callback.call(thisArg, wrap(value), wrap(key), this)
    })
  },
  [Symbol.iterator]: iterationMethod,
  entries: iterationMethod,
  values: valuesIterationMethod,
  keys: keysIterationMethod
}

function iterationMethod() {
  const target = this.raw
  const itr = target[Symbol.iterator]()

  const wrap = val => typeof(val) === 'object' ? reactive(val) : val
  track(target, ITERATE_KEY)
  return {
    next() {
      const {value, done} = itr.next()
      return {
        value: value ? [wrap[0], wrap[1]] : value,
        done
      }
    },
    [Symbol.iterator]() {
      return this
    }
  }
}

function valuesIterationMethod() {
  const target = this.raw
  const itr = target.values()

  const wrap = val => typeof(val) === 'object' ? reactive(val) : val
  track(target, ITERATE_KEY)
  return {
    next() {
      const {value, done} = itr.next()
      return {
        value: value ? wrap(value) : value,
        done
      }
    },
    [Symbol.iterator]() {
      return this
    }
  }
}

const MAP_KEY_ITERATE_KEY = Symbol()

function keysIterationMethod() {
  const target = this.raw
  const itr = target.keys()

  const wrap = val => typeof(val) === 'object' ? reactive(val) : val
  track(target, MAP_KEY_ITERATE_KEY)
  return {
    next() {
      const {value, done} = itr.next()
      return {
        value: value ? wrap(value) : value,
        done
      }
    },
    [Symbol.iterator]() {
      return this
    }
  }
}

// 对Set, Map数据类型左响应式
const creatMapReactive = function(target, isShallow = false, readonly = false) {
  return new Proxy(target, {
    get(target, key, recevier) {
      if (key === 'raw') return target
      if (key === 'size') {
        track(target, ITERATE_KEY)
        return Reflect.get(target, key, target)
      }
      return mutableInstrumenations[key]
    }
  })
}


const arrayInstrumentations = {
  
  // 'includes': (args) => {
  //   let res = originMethod.apply(this, args)
  //   if (res === false) {
  //     res = originMethod.call(this.raw, args)
  //   }
  //   return res
  // }
}

// fix: const obj = {}, const arr = reactive([obj]), arr.includes(obj)
;['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function(...args) {
    let res = originMethod.apply(this, args)
    if (res === false || res === -1) {
      res = originMethod.call(this.raw, args)
    }
    return res
  }
})

// fix: const arr = reactive([]), effect(() => arr.push(1)), effect(() => arr.push(1))
let shouldTrack = true
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
  const originMethod = Array.prototype[method] 
  arrayInstrumentations[method] = function(...args) {
    shouldTrack = false
    let res = originMethod.apply(this, args)
    shouldTrack = true
    return res
  }
})

const reactiveMap = new Map()
export const reactive = function(target) {
  // fix: const obj = {}, const arr = reactive([obj]), arr.includes(arr[0])
  const existProxy = reactiveMap.get(target)
  if (existProxy) return existProxy

  const typeCheck = Object.prototype.toString
  const isSet = typeCheck.call(target) === '[object Set]'
  const isMap = typeCheck.call(target) === '[object Map]'

  const proxy = isSet || isMap ? creatMapReactive(target) : creatReactive(target)
  reactiveMap.set(target, proxy)
  return proxy
}

export const shallowReactive = function(target) {
  return creatReactive(target, true)
}

export const readonly = function(target) {
  return creatReactive(target, false, true)
}

export const shallowReadonly = function(target) {
  return creatReactive(target, true, true)
}