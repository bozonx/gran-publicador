import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { mount } from '@vue/test-utils'

// We need module-level isolation because useFormDirtyState keeps module-scoped state
// (navigationGuardUsers/unregisterNavigationGuard).

describe('composables/useFormDirtyState', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers router guard once and unregisters when last user unmounts', async () => {
    const removeGuard1 = vi.fn()
    const beforeEachMock = vi.fn(() => removeGuard1)

    vi.doMock('vue-router', () => ({
      useRouter: () => ({
        beforeEach: beforeEachMock,
      }),
    }))

    vi.doMock('vue-i18n', () => ({
      useI18n: () => ({
        t: (key: string) => key,
      }),
    }))

    const unregisterForm1 = vi.fn()
    const unregisterForm2 = vi.fn()

    const confirmLeaveDirtyForm = vi.fn(async () => true)

    const registerDirtyForm = vi
      .fn()
      .mockImplementationOnce(() => unregisterForm1)
      .mockImplementationOnce(() => unregisterForm2)

    vi.doMock('../../app/composables/useDirtyFormsManager', () => ({
      registerDirtyForm,
      confirmLeaveDirtyForm,
    }))

    const { useFormDirtyState } = await import('../../app/composables/useFormDirtyState')

    const Comp = defineComponent({
      props: {
        id: { type: String, required: true },
      },
      setup() {
        const state = reactive({ a: 1 })
        useFormDirtyState(state, {
          enableNavigationGuard: true,
          enableBeforeUnload: false,
        })
        return () => h('div')
      },
    })

    const w1 = mount(Comp, { props: { id: '1' } })
    const w2 = mount(Comp, { props: { id: '2' } })

    expect(registerDirtyForm).toHaveBeenCalledTimes(2)
    // One global router guard
    expect(beforeEachMock).toHaveBeenCalledTimes(1)

    w1.unmount()
    expect(unregisterForm1).toHaveBeenCalledTimes(1)
    // Still one user left => guard not removed yet
    expect(removeGuard1).toHaveBeenCalledTimes(0)

    w2.unmount()
    expect(unregisterForm2).toHaveBeenCalledTimes(1)
    // Last user unmounted => guard removed
    expect(removeGuard1).toHaveBeenCalledTimes(1)
  })
})
