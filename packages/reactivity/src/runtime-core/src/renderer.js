const operations = {
  creatElement(tag) {
    return document.createElement(tag)
  },
  setElementText(el, text) {
    el.textContent = text
  },
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  },
  createText(text) {
    return document.createTextNode(text)
  },
  setText(el, text) {
    el.nodeValue = text
  },
  patchProps(el, key, preValue, nextValue) {
    if (/^on/.test(key)) {
      const name = key.slice(2).toLowerCase()
      // vnode event invoker
      let invokers = el._vei || (el._vei = {})
      let invoker = invokers(key)
      if (nextValue) {
        if (!invoker) {
          invoker = (e) => {
            if (e.timeStamp < invoker.attached) return
            if (Array.isArray(invoker.value)) {
              invoker.vlaue.forEach(fn => fn(e))
            } else {
              invoker.value(e)
            }
          }
          invoker.value = nextValue
          invoker.attached = performance.now()
          el.addEventListener(name, invoker)
        } else { 
          invoker.value = nextValue
        }
      } else {
        el.removeEventListener(name, invoker)
      }
    }
    if (key === 'class') {
      el.className = nextValue // 性能更好
    } else if (shouldSetAsProps(el, key, nextValue)) {
      const type = typeof(el[key])
      if (type === 'boolean' && nextValue === '') {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      el.setAttribute(key, nextValue)
    }
  }
}

// todo 归一化为统一的字符传
function normalizeClass() {}

const createRenderer = function(options) {
  const {
    creatElement,
    setElementText,
    insert,
    patchProps,
    createText,
    setText
  } = options
  function render(vnode, container) {
    if (vnode) {
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        unmount(container._vnode)
      }
    }
    container._vnode = vnode
  }
  function hydrate() {
    // todo
  }

  const Text = Symbol()
  const Comment = Symbol()
  const Fragment = Symbol()

  function patch(oldNode, newNode, container) {
    if (oldNode && oldNode.type !== newNode.type) {
      unmount(oldNode)
      oldNode = null
    }
    const { type } = newNode
    if (typeof(newNode.type) === 'string') {
      if (!oldNode) {
        mountElement(newNode, container)
      } else {
        patchElement(oldNode, newNode)
      }
    } else if (type === Text) {
      if (!oldNode) {
        const el = newNode.el = createText(newNode.children)
        insert(el, container)
      } else {
        const el = newNode.el = oldNode.el
        if (newNode.children !== oldNode.children) {
          setText(el, newNode.children)
        }
      }
    } else if (type === Fragment) {
      if (!oldNode) {
        newNode.children.forEach(c => patch(null, c, container))
      } else {
        patchChildren(oldNode, newNode, container)
      }
    } else if (typeof(newNode.type) === 'object') {
      // todo 组件
    } else {
      // todo 其他类型，如fragment
    }
  }

  function patchElement(oldNode, newNode) {
    const el = newNode.el = oldNode.el
    const oldProps = oldNode.props
    const newProps = newNode.props
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key])
      }
    }
    for (const key in oldProps) {
      if (!(ken in newProps)) {
        patchProps(el, key, oldProps[key], null)
      }
    }
    patchChildren(oldNode, newNode, el)
  }

  function patchChildren(oldNode, newNode, container) {
    if (typeof(newNode.children) === 'string') {
      if (Array.isArray(oldNode.children)) {
        oldNode.children.forEach(child => unmount(child))
      }
      setElementText(container, newNode.children)
    } else if (Array.isArray(newNode.children)) {
      if (Array.isArray(oldNode.children)) {
        // todo diff
      } else {
        setElementText(container, '')
        n2.children.forEach(c => patch(null, c, container))
      }
    }
  }

  function shouldSetAsProps(el, key, value) {
    if (key === 'form' && el.tagName === 'INPUT') return false
    return key in el
  }

  function mountElement(vnode, container) {
    const el = vnode.el = creatElement(vnode.type)
    if (typeof(vnode.children) === 'string') {
      setElementText(el, vnode.children)
    } else if (Array.isArray(vnode.children)) {
      vnode.children.forEach(child => {
        patch(null, child, el)
      })
    }
    if (vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key])
      }
    }
    insert(el, container)
  }

  function unmount(vnode) {
    if (vnode.type === Fragment) {
      vnode.children.forEach(c => unmount(c))
      return
    }
    const parent = vnode.el.parentNode
    if(parent) parent.removeChild(vnode.el)
    // todo 调用组件钩子，指令钩子等
  }

  return {
    render,
    hydrate
  }
}

const render = createRenderer(operations).render

export {
  render
}