import {
  reactive,
  effect,
  // stop,
  // toRaw,
  // TrackOpTypes,
  // TriggerOpTypes,
  // DebuggerEvent,
  // markRaw,
  shallowReactive,
  readonly,
  // ReactiveEffectRunner
} from '../src/index'
import {jobQueue, flushJob} from '../src/scheduler'
import { ITERATE_KEY } from '../src/effect'

describe('reactivity/effect', () => {
  it('should run the passed function once (wrapped by a effect)', () => {
    const fnSpy = jest.fn(() => {})
    effect(fnSpy)
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })

  it('should observe basic properties', () => {
    let dummy
    const counter = reactive({ num: 0 })
    effect(() => (dummy = counter.num))

    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
  })

  it('should observe multiple properties', () => {
    let dummy
    const counter = reactive({ num1: 0, num2: 0 })
    effect(() => (dummy = counter.num1 + counter.num1 + counter.num2))

    expect(dummy).toBe(0)
    counter.num1 = counter.num2 = 7
    expect(dummy).toBe(21)
  })

  it('should handle multiple effects', () => {
    let dummy1, dummy2
    const counter = reactive({ num: 0 })
    effect(() => (dummy1 = counter.num))
    effect(() => (dummy2 = counter.num))

    expect(dummy1).toBe(0)
    expect(dummy2).toBe(0)
    counter.num++
    expect(dummy1).toBe(1)
    expect(dummy2).toBe(1)
  })

  /**
   * 补充测试用例 start
   */

  it('should handle related key effect', () => {
    let dummy
    const counter = reactive({ num1: 0 })
    let effectFn = jest.fn(function() {
      dummy = counter.num1
    })
    effect(effectFn)
    counter.num2 = 0
    expect(effectFn).toHaveBeenCalledTimes(1)
  })

  it('should cleanup when effect deps branch change', () => {
    let dummy
    const counter = reactive( { num: 0, flag: true })
    let effectFn = jest.fn(() => (dummy = counter.flag ? counter.num : -1)) 
    effect(effectFn)
    expect(dummy).toBe(0)
    counter.flag = false
    counter.num = 1
    expect(effectFn).toHaveBeenCalledTimes(2)
  })

  it('should not loop', () => {
    const counter = reactive( { num: 0 })
    effect(() => counter.num++)
  })

  it('should handle the lastest effect by scheduler', () => {
    const counter = reactive( { num: 0 })
    effect(() => {
      console.log(counter.num)
    }, {scheduler: (fn) => {
      jobQueue.add(fn)
      flushJob()
    }})
    counter.num = 1
    counter.num = 2
    counter.num = 3
  })

  it('should not be triggered when shallowReactive', () => {
    const observed = reactive({ obj: { foo: 1 } })
    const fnSpy = jest.fn(() => observed.obj.foo)

    effect(fnSpy)

    expect(fnSpy).toHaveBeenCalledTimes(1)
    observed.obj.foo = 2
    expect(fnSpy).toHaveBeenCalledTimes(2)

    const observed2 = shallowReactive({ obj2: { foo: 1 } })
    const fnSpy2 = jest.fn(() => observed2.obj2.foo)

    effect(fnSpy2)

    expect(fnSpy2).toHaveBeenCalledTimes(1)
    observed2.obj2.foo = 2
    expect(fnSpy2).toHaveBeenCalledTimes(1)
  })

  it('should be triggered when set/get array by index', () => {
    const observed = reactive(['foo'])
    const fnSpy = jest.fn(() => observed[0])
    const lengthFnSpy = jest.fn(() => observed.length)

    effect(fnSpy)
    expect(fnSpy).toHaveBeenCalledTimes(1)
    observed[0] = 'foo1'
    expect(fnSpy).toHaveBeenCalledTimes(2)

    effect(lengthFnSpy)
    expect(lengthFnSpy).toHaveBeenCalledTimes(1)
    observed[1] = 'foo2'
    expect(lengthFnSpy).toHaveBeenCalledTimes(2)

    observed.length = 0
    expect(lengthFnSpy).toHaveBeenCalledTimes(3)
    expect(fnSpy).toHaveBeenCalledTimes(3)
  })

  it('should be triggered when use for..in iteration and set by index od set length', () => {
    let sum = 0
    const observed = reactive([1])
    const fnSpy = jest.fn(() => {
      // for (let k in observed) {
      //   sum += observed[k]
      // }
      for (let k of observed) {
        sum += k
      }
    })
    const lengthFnSpy = jest.fn(() => observed.length)

    effect(fnSpy)
    expect(fnSpy).toHaveBeenCalledTimes(1)
    effect(lengthFnSpy)
    expect(lengthFnSpy).toHaveBeenCalledTimes(1)
    observed[1] = 2
    expect(sum).toEqual(4)
    expect(lengthFnSpy).toHaveBeenCalledTimes(2)
    expect(fnSpy).toHaveBeenCalledTimes(2)
    observed.length = 0
    expect(fnSpy).toHaveBeenCalledTimes(3)
    expect(lengthFnSpy).toHaveBeenCalledTimes(3)
  })

  /**
   * 补充测试用例 end
   */

  it('should observe nested properties', () => {
    let dummy
    const counter = reactive({ nested: { num: 0 } })
    effect(() => (dummy = counter.nested.num))

    expect(dummy).toBe(0)
    counter.nested.num = 8
    expect(dummy).toBe(8)
  })

  it('should observe delete operations', () => {
    let dummy
    const obj = reactive({ prop: 'value' })
    effect(() => (dummy = obj.prop))

    expect(dummy).toBe('value')
    // @ts-ignore
    delete obj.prop
    expect(dummy).toBe(undefined)
  })

  it('should observe has operations', () => {
    let dummy
    const obj = reactive({ prop: 'value' })
    effect(() => (dummy = 'prop' in obj))

    expect(dummy).toBe(true)
    // @ts-ignore
    delete obj.prop
    expect(dummy).toBe(false)
    obj.prop = 12
    expect(dummy).toBe(true)
  })

  it('should observe properties on the prototype chain', () => {
    let dummy
    const counter = reactive({ num: 0 })
    const parentCounter = reactive({ num: 2 })
    Object.setPrototypeOf(counter, parentCounter)
    effect(() => (dummy = counter.num))

    expect(dummy).toBe(0)
    // @ts-ignore
    delete counter.num
    expect(dummy).toBe(2)
    parentCounter.num = 4
    expect(dummy).toBe(4)
    counter.num = 3
    expect(dummy).toBe(3)
  })

  it('should observe has operations on the prototype chain', () => {
    let dummy
    const counter = reactive({ num: 0 })
    const parentCounter = reactive({ num: 2 })
    Object.setPrototypeOf(counter, parentCounter)
    effect(() => (dummy = 'num' in counter))

    expect(dummy).toBe(true)
    // @ts-ignore
    delete counter.num
    expect(dummy).toBe(true)
    // @ts-ignore
    delete parentCounter.num
    expect(dummy).toBe(false)
    counter.num = 3
    expect(dummy).toBe(true)
  })

  // it('should observe inherited property accessors', () => {
  //   let dummy, parentDummy, hiddenValue
  //   const obj = reactive({})
  //   const parent = reactive({
  //     set prop(value) {
  //       hiddenValue = value
  //     },
  //     get prop() {
  //       return hiddenValue
  //     }
  //   })
  //   Object.setPrototypeOf(obj, parent)
  //   effect(() => (dummy = obj.prop))
  //   effect(() => (parentDummy = parent.prop))

  //   expect(dummy).toBe(undefined)
  //   expect(parentDummy).toBe(undefined)
  //   obj.prop = 4
  //   expect(dummy).toBe(4)
  //   // this doesn't work, should it?
  //   // expect(parentDummy).toBe(4)
  //   parent.prop = 2
  //   expect(dummy).toBe(2)
  //   expect(parentDummy).toBe(2)
  // })

  // it('should observe function call chains', () => {
  //   let dummy
  //   const counter = reactive({ num: 0 })
  //   effect(() => (dummy = getNum()))

  //   function getNum() {
  //     return counter.num
  //   }

  //   expect(dummy).toBe(0)
  //   counter.num = 2
  //   expect(dummy).toBe(2)
  // })

  // iteration: 迭代 （for in, for of）
  // it('should observe iteration', () => {
  //   let dummy
  //   const list = reactive(['Hello'])
  //   effect(() => (
  //     dummy = list.join(' ')
  //   ))

  //   expect(dummy).toBe('Hello')
  //   list.push('World!')
  //   expect(dummy).toBe('Hello World!')
  //   list.shift()
  //   expect(dummy).toBe('World!')
  // })

  it('should observe implicit array length changes', () => {
    let dummy
    const list = reactive(['Hello'])
    effect(() => (dummy = list.join(' ')))

    expect(dummy).toBe('Hello')
    list[1] = 'World!'
    expect(dummy).toBe('Hello World!')
    list[3] = 'Hello!'
    expect(dummy).toBe('Hello World!  Hello!')
  })

  // it('should observe sparse array mutations', () => {
  //   let dummy
  //   const list = reactive([])
  //   list[1] = 'World!'
  //   effect(() => (dummy = list.join(' ')))

  //   expect(dummy).toBe(' World!')
  //   list[0] = 'Hello'
  //   expect(dummy).toBe('Hello World!')
  //   list.pop()
  //   expect(dummy).toBe('Hello')
  // })

  it('should observe enumeration', () => {
    let dummy = 0
    const numbers = reactive({ num1: 3 })
    effect(() => {
      dummy = 0
      for (let key in numbers) {
        dummy += numbers[key]
      }
    })

    expect(dummy).toBe(3)
    numbers.num2 = 4
    expect(dummy).toBe(7)
    delete numbers.num1
    expect(dummy).toBe(4)
  })

  // it('should observe symbol keyed properties', () => {
  //   const key = Symbol('symbol keyed prop')
  //   let dummy, hasDummy
  //   const obj = reactive({ [key]: 'value' })
  //   effect(() => (dummy = obj[key]))
  //   effect(() => (hasDummy = key in obj))

  //   expect(dummy).toBe('value')
  //   expect(hasDummy).toBe(true)
  //   obj[key] = 'newValue'
  //   expect(dummy).toBe('newValue')
  //   // @ts-ignore
  //   delete obj[key]
  //   expect(dummy).toBe(undefined)
  //   expect(hasDummy).toBe(false)
  // })

  // it('should not observe well-known symbol keyed properties', () => {
  //   const key = Symbol.isConcatSpreadable
  //   let dummy
  //   const array = reactive([])
  //   effect(() => (dummy = array[key]))

  //   expect(array[key]).toBe(undefined)
  //   expect(dummy).toBe(undefined)
  //   array[key] = true
  //   expect(array[key]).toBe(true)
  //   expect(dummy).toBe(undefined)
  // })

  // it('should observe function valued properties', () => {
  //   const oldFunc = () => {}
  //   const newFunc = () => {}

  //   let dummy
  //   const obj = reactive({ func: oldFunc })
  //   effect(() => (dummy = obj.func))

  //   expect(dummy).toBe(oldFunc)
  //   obj.func = newFunc
  //   expect(dummy).toBe(newFunc)
  // })

  it('should observe chained getters relying on this', () => {
    const obj = reactive({
      a: 1,
      get b() {
        return this.a
      }
    })

    let dummy
    effect(() => (dummy = obj.b))
    expect(dummy).toBe(1)
    obj.a++
    expect(dummy).toBe(2)
  })

  it('should observe methods relying on this', () => {
    const obj = reactive({
      a: 1,
      b() {
        return this.a
      }
    })

    let dummy
    effect(() => (dummy = obj.b()))
    expect(dummy).toBe(1)
    obj.a++
    expect(dummy).toBe(2)
  })

  it('should not observe set operations without a value change', () => {
    let hasDummy, getDummy
    const obj = reactive({ prop: 'value' })

    const getSpy = jest.fn(() => (getDummy = obj.prop))
    const hasSpy = jest.fn(() => (hasDummy = 'prop' in obj))
    effect(getSpy)
    effect(hasSpy)

    expect(getDummy).toBe('value')
    expect(hasDummy).toBe(true)
    obj.prop = 'value'
    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(hasSpy).toHaveBeenCalledTimes(1)
    expect(getDummy).toBe('value')
    expect(hasDummy).toBe(true)
  })

  // it('should not observe raw mutations', () => {
  //   let dummy
  //   const obj = reactive({})
  //   effect(() => (dummy = toRaw(obj).prop))

  //   expect(dummy).toBe(undefined)
  //   obj.prop = 'value'
  //   expect(dummy).toBe(undefined)
  // })

  // it('should not be triggered by raw mutations', () => {
  //   let dummy
  //   const obj = reactive({})
  //   effect(() => (dummy = obj.prop))

  //   expect(dummy).toBe(undefined)
  //   toRaw(obj).prop = 'value'
  //   expect(dummy).toBe(undefined)
  // })

  // it('should not be triggered by inherited raw setters', () => {
  //   let dummy, parentDummy, hiddenValue
  //   const obj = reactive({})
  //   const parent = reactive({
  //     set prop(value) {
  //       hiddenValue = value
  //     },
  //     get prop() {
  //       return hiddenValue
  //     }
  //   })
  //   Object.setPrototypeOf(obj, parent)
  //   effect(() => (dummy = obj.prop))
  //   effect(() => (parentDummy = parent.prop))

  //   expect(dummy).toBe(undefined)
  //   expect(parentDummy).toBe(undefined)
  //   toRaw(obj).prop = 4
  //   expect(dummy).toBe(undefined)
  //   expect(parentDummy).toBe(undefined)
  // })

  it('should avoid implicit infinite recursive loops with itself', () => {
    const counter = reactive({ num: 0 })

    const counterSpy = jest.fn(() => counter.num++)
    effect(counterSpy)
    expect(counter.num).toBe(1)
    expect(counterSpy).toHaveBeenCalledTimes(1)
    counter.num = 4
    expect(counter.num).toBe(5)
    expect(counterSpy).toHaveBeenCalledTimes(2)
  })

  it('should avoid infinite recursive loops when use Array.prototype.push/unshift/pop/shift', () => {
    ;(['push', 'unshift']).forEach(key => {
      const arr = reactive([])
      const counterSpy1 = jest.fn(() => (arr[key])(1))
      const counterSpy2 = jest.fn(() => (arr[key])(2))
      effect(counterSpy1)
      effect(counterSpy2)
      expect(arr.length).toBe(2)
      expect(counterSpy1).toHaveBeenCalledTimes(1)
      expect(counterSpy2).toHaveBeenCalledTimes(1)
    })
    ;(['pop', 'shift']).forEach(key => {
      const arr = reactive([1, 2, 3, 4])
      const counterSpy1 = jest.fn(() => (arr[key])())
      const counterSpy2 = jest.fn(() => (arr[key])())
      effect(counterSpy1)
      effect(counterSpy2)
      expect(arr.length).toBe(2)
      expect(counterSpy1).toHaveBeenCalledTimes(1)
      expect(counterSpy2).toHaveBeenCalledTimes(1)
    })
  })

  // it('should allow explicitly recursive raw function loops', () => {
  //   const counter = reactive({ num: 0 })
  //   const numSpy = jest.fn(() => {
  //     counter.num++
  //     if (counter.num < 10) {
  //       numSpy()
  //     }
  //   })
  //   effect(numSpy)
  //   expect(counter.num).toEqual(10)
  //   expect(numSpy).toHaveBeenCalledTimes(10)
  // })

  // it('should avoid infinite loops with other effects', () => {
  //   const nums = reactive({ num1: 0, num2: 1 })

  //   const spy1 = jest.fn(() => (nums.num1 = nums.num2))
  //   const spy2 = jest.fn(() => (nums.num2 = nums.num1))
  //   effect(spy1)
  //   effect(spy2)
  //   expect(nums.num1).toBe(1)
  //   expect(nums.num2).toBe(1)
  //   expect(spy1).toHaveBeenCalledTimes(1)
  //   expect(spy2).toHaveBeenCalledTimes(1)
  //   nums.num2 = 4
  //   expect(nums.num1).toBe(4)
  //   expect(nums.num2).toBe(4)
  //   expect(spy1).toHaveBeenCalledTimes(2)
  //   expect(spy2).toHaveBeenCalledTimes(2)
  //   nums.num1 = 10
  //   expect(nums.num1).toBe(10)
  //   expect(nums.num2).toBe(10)
  //   expect(spy1).toHaveBeenCalledTimes(3)
  //   expect(spy2).toHaveBeenCalledTimes(3)
  // })

  // it('should return a new reactive version of the function', () => {
  //   function greet() {
  //     return 'Hello World'
  //   }
  //   const effect1 = effect(greet)
  //   const effect2 = effect(greet)
  //   expect(typeof effect1).toBe('function')
  //   expect(typeof effect2).toBe('function')
  //   expect(effect1).not.toBe(greet)
  //   expect(effect1).not.toBe(effect2)
  // })

  it('should discover new branches while running automatically', () => {
    let dummy
    const obj = reactive({ prop: 'value', run: false })

    const conditionalSpy = jest.fn(() => {
      dummy = obj.run ? obj.prop : 'other'
    })
    effect(conditionalSpy)

    expect(dummy).toBe('other')
    expect(conditionalSpy).toHaveBeenCalledTimes(1)
    obj.prop = 'Hi'
    expect(dummy).toBe('other')
    expect(conditionalSpy).toHaveBeenCalledTimes(1)
    obj.run = true
    expect(dummy).toBe('Hi')
    expect(conditionalSpy).toHaveBeenCalledTimes(2)
    obj.prop = 'World'
    expect(dummy).toBe('World')
    expect(conditionalSpy).toHaveBeenCalledTimes(3)
  })

  it('should discover new branches when running manually', () => {
    let dummy
    let run = false
    const obj = reactive({ prop: 'value' })
    const runner = effect(() => {
      dummy = run ? obj.prop : 'other'
    })

    expect(dummy).toBe('other')
    runner()
    expect(dummy).toBe('other')
    run = true
    runner()
    expect(dummy).toBe('value')
    obj.prop = 'World'
    expect(dummy).toBe('World')
  })

  it('should not be triggered by mutating a property, which is used in an inactive branch', () => {
    let dummy
    const obj = reactive({ prop: 'value', run: true })

    const conditionalSpy = jest.fn(() => {
      dummy = obj.run ? obj.prop : 'other'
    })
    effect(conditionalSpy)

    expect(dummy).toBe('value')
    expect(conditionalSpy).toHaveBeenCalledTimes(1)
    obj.run = false
    expect(dummy).toBe('other')
    expect(conditionalSpy).toHaveBeenCalledTimes(2)
    obj.prop = 'value2'
    expect(dummy).toBe('other')
    expect(conditionalSpy).toHaveBeenCalledTimes(2)
  })

  // it('should handle deep effect recursion using cleanup fallback', () => {
  //   const results = reactive([0])
  //   const effects = []
  //   for (let i = 1; i < 40; i++) {
  //     ;(index => {
  //       const fx = effect(() => {
  //         results[index] = results[index - 1] * 2
  //       })
  //       effects.push({ fx, index })
  //     })(i)
  //   }

  //   expect(results[39]).toBe(0)
  //   results[0] = 1
  //   expect(results[39]).toBe(Math.pow(2, 39))
  // })

  // it('should register deps independently during effect recursion', () => {
  //   const input = reactive({ a: 1, b: 2, c: 0 })
  //   const output = reactive({ fx1: 0, fx2: 0 })

  //   const fx1Spy = jest.fn(() => {
  //     let result = 0
  //     if (input.c < 2) result += input.a
  //     if (input.c > 1) result += input.b
  //     output.fx1 = result
  //   })

  //   const fx1 = effect(fx1Spy)

  //   const fx2Spy = jest.fn(() => {
  //     let result = 0
  //     if (input.c > 1) result += input.a
  //     if (input.c < 3) result += input.b
  //     output.fx2 = result + output.fx1
  //   })

  //   const fx2 = effect(fx2Spy)

  //   expect(fx1).not.toBeNull()
  //   expect(fx2).not.toBeNull()

  //   expect(output.fx1).toBe(1)
  //   expect(output.fx2).toBe(2 + 1)
  //   expect(fx1Spy).toHaveBeenCalledTimes(1)
  //   expect(fx2Spy).toHaveBeenCalledTimes(1)

  //   fx1Spy.mockClear()
  //   fx2Spy.mockClear()
  //   input.b = 3
  //   expect(output.fx1).toBe(1)
  //   expect(output.fx2).toBe(3 + 1)
  //   expect(fx1Spy).toHaveBeenCalledTimes(0)
  //   expect(fx2Spy).toHaveBeenCalledTimes(1)

  //   fx1Spy.mockClear()
  //   fx2Spy.mockClear()
  //   input.c = 1
  //   expect(output.fx1).toBe(1)
  //   expect(output.fx2).toBe(3 + 1)
  //   expect(fx1Spy).toHaveBeenCalledTimes(1)
  //   expect(fx2Spy).toHaveBeenCalledTimes(1)

  //   fx1Spy.mockClear()
  //   fx2Spy.mockClear()
  //   input.c = 2
  //   expect(output.fx1).toBe(3)
  //   expect(output.fx2).toBe(1 + 3 + 3)
  //   expect(fx1Spy).toHaveBeenCalledTimes(1)

  //   // Invoked twice due to change of fx1.
  //   expect(fx2Spy).toHaveBeenCalledTimes(2)

  //   fx1Spy.mockClear()
  //   fx2Spy.mockClear()
  //   input.c = 3
  //   expect(output.fx1).toBe(3)
  //   expect(output.fx2).toBe(1 + 3)
  //   expect(fx1Spy).toHaveBeenCalledTimes(1)
  //   expect(fx2Spy).toHaveBeenCalledTimes(1)

  //   fx1Spy.mockClear()
  //   fx2Spy.mockClear()
  //   input.a = 10
  //   expect(output.fx1).toBe(3)
  //   expect(output.fx2).toBe(10 + 3)
  //   expect(fx1Spy).toHaveBeenCalledTimes(0)
  //   expect(fx2Spy).toHaveBeenCalledTimes(1)
  // })

  // it('should not double wrap if the passed function is a effect', () => {
  //   const runner = effect(() => {})
  //   const otherRunner = effect(runner)
  //   expect(runner).not.toBe(otherRunner)
  //   expect(runner.effect.fn).toBe(otherRunner.effect.fn)
  // })

  it('should not run multiple times for a single mutation', () => {
    let dummy
    const obj = reactive({})
    const fnSpy = jest.fn(() => {
      for (const key in obj) {
        dummy = obj[key]
      }
      dummy = obj.prop
    })
    effect(fnSpy)

    expect(fnSpy).toHaveBeenCalledTimes(1)
    obj.prop = 16
    expect(dummy).toBe(16)
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })

  it('should allow nested effects', () => {
    const nums = reactive({ num1: 0, num2: 1, num3: 2 })
    const dummy = {}

    const childSpy = jest.fn(() => (dummy.num1 = nums.num1))
    const childeffect = effect(childSpy)
    const parentSpy = jest.fn(() => {
      dummy.num2 = nums.num2
      childeffect()
      dummy.num3 = nums.num3
    })
    effect(parentSpy)

    expect(dummy).toEqual({ num1: 0, num2: 1, num3: 2 })
    expect(parentSpy).toHaveBeenCalledTimes(1)
    expect(childSpy).toHaveBeenCalledTimes(2)
    // this should only call the childeffect
    nums.num1 = 4
    expect(dummy).toEqual({ num1: 4, num2: 1, num3: 2 })
    expect(parentSpy).toHaveBeenCalledTimes(1)
    expect(childSpy).toHaveBeenCalledTimes(3)
    // this calls the parenteffect, which calls the childeffect once
    nums.num2 = 10
    expect(dummy).toEqual({ num1: 4, num2: 10, num3: 2 })
    expect(parentSpy).toHaveBeenCalledTimes(2)
    expect(childSpy).toHaveBeenCalledTimes(4)
    // this calls the parenteffect, which calls the childeffect once
    nums.num3 = 7
    expect(dummy).toEqual({ num1: 4, num2: 10, num3: 7 })
    expect(parentSpy).toHaveBeenCalledTimes(3)
    expect(childSpy).toHaveBeenCalledTimes(5)
  })

  // it('should observe json methods', () => {
  //   let dummy = {}
  //   const obj = reactive({})
  //   effect(() => {
  //     dummy = JSON.parse(JSON.stringify(obj))
  //   })
  //   obj.a = 1
  //   expect(dummy.a).toBe(1)
  // })

  // it('should observe class method invocations', () => {
  //   class Model {
  //     count
  //     constructor() {
  //       this.count = 0
  //     }
  //     inc() {
  //       this.count++
  //     }
  //   }
  //   const model = reactive(new Model())
  //   let dummy
  //   effect(() => {
  //     dummy = model.count
  //   })
  //   expect(dummy).toBe(0)
  //   model.inc()
  //   expect(dummy).toBe(1)
  // })

  it('lazy', () => {
    const obj = reactive({ foo: 1 })
    let dummy
    const runner = effect(() => (dummy = obj.foo), { lazy: true })
    expect(dummy).toBe(undefined)

    //todo  expect(runner()).toBe(1) ?
    runner()
    expect(dummy).toBe(1)
    obj.foo = 2
    expect(dummy).toBe(2)
  })

  it('scheduler', () => {
    let dummy
    let run
    const scheduler = jest.fn(() => {
      run = runner
    })
    const obj = reactive({ foo: 1 })
    const runner = effect(
      () => {
        dummy = obj.foo
      },
      { scheduler }
    )
    expect(scheduler).not.toHaveBeenCalled()
    expect(dummy).toBe(1)
    // should be called on first trigger
    obj.foo++
    expect(scheduler).toHaveBeenCalledTimes(1)
    // should not run yet
    expect(dummy).toBe(1)
    // manually run
    run()
    // should have run
    expect(dummy).toBe(2)
  })

  // it('events: onTrack', () => {
  //   let events = []
  //   let dummy
  //   const onTrack = jest.fn((e) => {
  //     events.push(e)
  //   })
  //   const obj = reactive({ foo: 1, bar: 2 })
  //   const runner = effect(
  //     () => {
  //       dummy = obj.foo
  //       dummy = 'bar' in obj
  //       dummy = Object.keys(obj)
  //     },
  //     { onTrack }
  //   )
  //   expect(dummy).toEqual(['foo', 'bar'])
  //   expect(onTrack).toHaveBeenCalledTimes(3)
  //   expect(events).toEqual([
  //     {
  //       effect: runner.effect,
  //       target: toRaw(obj),
  //       type: TrackOpTypes.GET,
  //       key: 'foo'
  //     },
  //     {
  //       effect: runner.effect,
  //       target: toRaw(obj),
  //       type: TrackOpTypes.HAS,
  //       key: 'bar'
  //     },
  //     {
  //       effect: runner.effect,
  //       target: toRaw(obj),
  //       type: TrackOpTypes.ITERATE,
  //       key: ITERATE_KEY
  //     }
  //   ])
  // })

  // it('events: onTrigger', () => {
  //   let events = []
  //   let dummy
  //   const onTrigger = jest.fn((e) => {
  //     events.push(e)
  //   })
  //   const obj = reactive({ foo: 1 })
  //   const runner = effect(
  //     () => {
  //       dummy = obj.foo
  //     },
  //     { onTrigger }
  //   )

  //   obj.foo++
  //   expect(dummy).toBe(2)
  //   expect(onTrigger).toHaveBeenCalledTimes(1)
  //   expect(events[0]).toEqual({
  //     effect: runner.effect,
  //     target: toRaw(obj),
  //     type: TriggerOpTypes.SET,
  //     key: 'foo',
  //     oldValue: 1,
  //     newValue: 2
  //   })

  //   // @ts-ignore
  //   delete obj.foo
  //   expect(dummy).toBeUndefined()
  //   expect(onTrigger).toHaveBeenCalledTimes(2)
  //   expect(events[1]).toEqual({
  //     effect: runner.effect,
  //     target: toRaw(obj),
  //     type: TriggerOpTypes.DELETE,
  //     key: 'foo',
  //     oldValue: 2
  //   })
  // })

  // it('stop', () => {
  //   let dummy
  //   const obj = reactive({ prop: 1 })
  //   const runner = effect(() => {
  //     dummy = obj.prop
  //   })
  //   obj.prop = 2
  //   expect(dummy).toBe(2)
  //   stop(runner)
  //   obj.prop = 3
  //   expect(dummy).toBe(2)

  //   // stopped effect should still be manually callable
  //   runner()
  //   expect(dummy).toBe(3)
  // })

  // it('events: onStop', () => {
  //   const onStop = jest.fn()
  //   const runner = effect(() => {}, {
  //     onStop
  //   })

  //   stop(runner)
  //   expect(onStop).toHaveBeenCalled()
  // })

  // it('stop: a stopped effect is nested in a normal effect', () => {
  //   let dummy
  //   const obj = reactive({ prop: 1 })
  //   const runner = effect(() => {
  //     dummy = obj.prop
  //   })
  //   stop(runner)
  //   obj.prop = 2
  //   expect(dummy).toBe(1)

  //   // observed value in inner stopped effect
  //   // will track outer effect as an dependency
  //   effect(() => {
  //     runner()
  //   })
  //   expect(dummy).toBe(2)

  //   // notify outer effect to run
  //   obj.prop = 3
  //   expect(dummy).toBe(3)
  // })

  // it('markRaw', () => {
  //   const obj = reactive({
  //     foo: markRaw({
  //       prop: 0
  //     })
  //   })
  //   let dummy
  //   effect(() => {
  //     dummy = obj.foo.prop
  //   })
  //   expect(dummy).toBe(0)
  //   obj.foo.prop++
  //   expect(dummy).toBe(0)
  //   obj.foo = { prop: 1 }
  //   expect(dummy).toBe(1)
  // })

  it('should not be triggered when the value and the old value both are NaN', () => {
    const obj = reactive({
      foo: NaN
    })
    const fnSpy = jest.fn(() => obj.foo)
    effect(fnSpy)
    obj.foo = NaN
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })

  // it('should trigger all effects when array length is set to 0', () => {
  //   const observed = reactive([1])
  //   let dummy, record
  //   effect(() => {
  //     dummy = observed.length
  //   })
  //   effect(() => {
  //     record = observed[0]
  //   })
  //   expect(dummy).toBe(1)
  //   expect(record).toBe(1)

  //   observed[1] = 2
  //   expect(observed[1]).toBe(2)

  //   observed.unshift(3)
  //   expect(dummy).toBe(3)
  //   expect(record).toBe(3)

  //   observed.length = 0
  //   expect(dummy).toBe(0)
  //   expect(record).toBeUndefined()
  // })

  // it('should not be triggered when set with the same proxy', () => {
  //   const obj = reactive({ foo: 1 })
  //   const observed = reactive({ obj })
  //   const fnSpy = jest.fn(() => observed.obj)

  //   effect(fnSpy)

  //   expect(fnSpy).toHaveBeenCalledTimes(1)
  //   observed.obj = obj
  //   expect(fnSpy).toHaveBeenCalledTimes(1)

  //   const obj2 = reactive({ foo: 1 })
  //   const observed2 = shallowReactive({ obj2 })
  //   const fnSpy2 = jest.fn(() => observed2.obj2)

  //   effect(fnSpy2)

  //   expect(fnSpy2).toHaveBeenCalledTimes(1)
  //   observed2.obj2 = obj2
  //   expect(fnSpy2).toHaveBeenCalledTimes(1)
  // })

  // describe('readonly + reactive for Map', () => {
  //   test('should work with readonly(reactive(Map))', () => {
  //     const m = reactive(new Map())
  //     const roM = readonly(m)
  //     const fnSpy = jest.fn(() => roM.get(1))

  //     effect(fnSpy)
  //     expect(fnSpy).toHaveBeenCalledTimes(1)
  //     m.set(1, 1)
  //     expect(fnSpy).toHaveBeenCalledTimes(2)
  //   })

  //   test('should work with observed value as key', () => {
  //     const key = reactive({})
  //     const m = reactive(new Map())
  //     m.set(key, 1)
  //     const roM = readonly(m)
  //     const fnSpy = jest.fn(() => roM.get(key))

  //     effect(fnSpy)
  //     expect(fnSpy).toHaveBeenCalledTimes(1)
  //     m.set(key, 1)
  //     expect(fnSpy).toHaveBeenCalledTimes(1)
  //     m.set(key, 2)
  //     expect(fnSpy).toHaveBeenCalledTimes(2)
  //   })
  // })

  /**
   * 新增测试用例 start
   * @functions 对Set，Map数据类型的响应式处理
   */
  describe('reactive for Set', () => {
    test('should trigger success on Set', () => {
      const set = new Set()
      const m = reactive(set)
      
      const fnSpy = jest.fn(() => m.size)
      effect(fnSpy)
      expect(fnSpy).toHaveBeenCalledTimes(1)

      m.add(1)
      expect(fnSpy).toHaveBeenCalledTimes(2)

      m.add(1)
      expect(fnSpy).toHaveBeenCalledTimes(2)

      m.delete(1)
      expect(fnSpy).toHaveBeenCalledTimes(3)
    })
  })

  describe('reactive for Map', () => {
    test('should trigger success on Map', () => {
      const map = new Map([
        ['1', 1],
        ['2', 2]
      ])
      const m = reactive(map)
      
      const fnSpy = jest.fn(() => {
        m.get('1')
      })
      effect(fnSpy)
      expect(fnSpy).toHaveBeenCalledTimes(1)

      m.set('1', '1')
      expect(fnSpy).toHaveBeenCalledTimes(2)

      m.set('3', 3)
      expect(fnSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('should trigger rightly for Set/Map forEach', () => {
    test('should trigger rightly for Set/Map forEach', () => {
      const map = new Map([
        ['1', 1],
        ['2', 2]
      ])
      const m = reactive(map)
      
      const fnSpy = jest.fn(() => {
        m.forEach((value, key) => {
          console.log(value)
          console.log(key)
        })
      })

      effect(fnSpy)
      expect(fnSpy).toHaveBeenCalledTimes(1)

      m.set('1', '1')
      expect(fnSpy).toHaveBeenCalledTimes(2)

      m.set('3', 3)
      expect(fnSpy).toHaveBeenCalledTimes(3)

      m.delete('3')
      expect(fnSpy).toHaveBeenCalledTimes(4)
    })
  })

  // entries/keys/values
  describe('should trigger rightly for Set/Map by use for...of', () => {
    test('should trigger success on Map', () => {
      const map = new Map([
        ['1', 1],
        ['2', 2]
      ])
      const m = reactive(map)
      
      const fnSpy = jest.fn(() => {
        // for (const [key, value] of m) {
        //   console.log(key)
        //   console.log(value)
        // }
        for (const [key, value] of m.entries()) {
          console.log(key)
          console.log(value)
        }
      })

      effect(fnSpy)
      expect(fnSpy).toHaveBeenCalledTimes(1)

      m.set('1', '1')
      expect(fnSpy).toHaveBeenCalledTimes(2)

      m.set('3', 3)
      expect(fnSpy).toHaveBeenCalledTimes(3)

      m.delete('3')
      expect(fnSpy).toHaveBeenCalledTimes(4)
    })
  })

  describe('should trigger rightly for Set/Map by use for...of', () => {
    test('should trigger success on Map', () => {
      const map = new Map([
        ['1', 1],
        ['2', 2]
      ])
      const m = reactive(map)
      
      const fnSpy = jest.fn(() => {
        // for (const [key, value] of m) {
        //   console.log(key)
        //   console.log(value)
        // }
        for (const key of m.keys()) {
          console.log(key)
        }
      })

      effect(fnSpy)
      expect(fnSpy).toHaveBeenCalledTimes(1)

      m.set('1', '1')
      expect(fnSpy).toHaveBeenCalledTimes(1)

      m.set('3', 3)
      expect(fnSpy).toHaveBeenCalledTimes(2)

      m.delete('3')
      expect(fnSpy).toHaveBeenCalledTimes(3)
    })
  })

  /**
   * 新增测试用例 end
   * @functions 对Set，Map数据类型的响应式处理
   */
})
