import { effect } from "./effect"
/**
 * 
 * @param {*} target 
 * @param {*} callback 
 * @param {immediate: boolean, flush: string['pre', 'post', 'sync']} options 
 * post 代表异步执行，sync代表同步执行
 */
export const watch = function (target, callback, options = {}) {
  let getter, oldVal, newVal, job, cleanup
  if (typeof(target) === 'function') {
    getter = target
  } else {
    getter = () => {
      traverse(target)
    }
  }
  let onCleanup = (fn) => {
    cleanup = fn
  }
  job = () => {
    newVal = effectFn()
    if (cleanup) cleanup()
    callback(newVal, oldVal, onCleanup)
    oldVal = newVal
  }
  // 监听响应式数据的变化，然后执行回调，所有在effect函数中，要遍历读取属性
  let effectFn = effect(getter, {
    scheduler: () => {
      if (typeof(target) === 'function') {
        if (options.flush === 'post') {
          const p = Promise.resolve()
          p.then(job)
        } else {
          job()
        }
      } else {
        callback(target)
      }
    },
    lazy: true
  })
  if (options.immediate) {
    job()
  } else {
    oldVal = effectFn()
  }
}

const traverse = function(target, seen = new Set()) {
  if (typeof(target) !== 'object' || target == null || seen.has(target)) return
  seen.add(target)
  for (let k in target) {
    traverse(target[k], seen)
  }
  return target
}
