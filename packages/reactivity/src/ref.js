import { reactive } from "./effect";

// ref, isRef, toRef, toRefs
export const ref = (val) => {
  const wrapper = {
    value: val
  }
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  })
  return reactive(wrapper)
}

export const isRef = (target) => {
  return target.__v_isRef === true
}

export const toRef = (target, key) => {
  const res = target[key]
  if (isRef(res)) return res
  const wrapper = {
    get value() {
      return target[key]
    },
    set value(val) {
      target[key] = val
    }
  }
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  })
  return wrapper
}

export const toRefs = (target) => {
  const res = {}
  for (const key in target) {
    res[key] = toRef(target, key)
  }
  return res
}

const proxyRefs = function(target) {
  return new Proxy(target, {
    get(target, key, recevier) {
      const value = Reflect.get(target, key, recevier)
      return isRef(value) ? value.value : value
    },
    set(target, key, newVal, recevier) {
      const value = target[key]
      if (isRef(value)) {
        value.value = newVal
        return true
      }
      Reflect.set(target, key, newVal, recevier)
    }
  })
}