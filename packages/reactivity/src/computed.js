import {effect, track, trigger} from './effect'
export const computed = function (getter) {
  let dirty = true
  let val
  const effectFn = effect(getter, {
    lazy: true,
    scheduler: () => {
      if (!dirty) {
        dirty = true
        trigger(obj, 'value')
      }
    }
  })
  const obj = {
    get value() {
      if (dirty) {
        val = effectFn()
        dirty = false
      }
      track(obj, 'value')
      return val
    }
  }
  return obj
}