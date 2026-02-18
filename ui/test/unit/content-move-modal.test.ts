import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';

import ContentMoveModal from '../../app/components/content/ContentMoveModal.vue';

describe('ContentMoveModal', () => {
  it('disables only current group id (root enabled when currentGroupId is a subgroup)', async () => {
    const ContentGroupSelectTreeStub = defineComponent({
      name: 'ContentGroupSelectTree',
      props: {
        items: { type: Array, required: true },
        disabledIds: { type: Array, required: false },
      },
      setup(props) {
        return () => h('div', { 'data-disabled': JSON.stringify(props.disabledIds ?? []) });
      },
    });

    const wrapper = mount(ContentMoveModal, {
      props: {
        open: true,
        ids: ['id-1'],
        scope: 'personal',
        activeCollection: { id: 'root', type: 'GROUP', title: 'Root' } as any,
        currentGroupId: 'sub-1',
        collections: [],
        projects: [],
        folderTreeItems: [],
      },
      global: {
        stubs: {
          UiAppModal: defineComponent({
            name: 'UiAppModal',
            props: ['open'],
            emits: ['update:open'],
            setup(_, { slots }) {
              return () => h('div', slots.default?.());
            },
          }),
          UAccordion: defineComponent({
            name: 'UAccordion',
            setup(_, { slots }) {
              return () => h('div', slots['to-group']?.());
            },
          }),
          UiAppButtonGroup: true,
          USelectMenu: true,
          UFormField: true,
          UButton: true,
          UIcon: true,
          CommonInfoTooltip: true,
          ContentGroupSelectTree: ContentGroupSelectTreeStub,
        },
      },
    });

    await nextTick();

    const tree = wrapper.findComponent(ContentGroupSelectTreeStub);
    expect(tree.exists()).toBe(true);
    expect(tree.attributes('data-disabled')).toBe(JSON.stringify(['sub-1']));
  });

  it('emits MOVE_TO_GROUP with sourceGroupId equal to currentGroupId when provided', async () => {
    const emitSelect = vi.fn();

    const ContentGroupSelectTreeStub = defineComponent({
      name: 'ContentGroupSelectTree',
      emits: ['select'],
      setup(_, { emit }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              onClick: () => {
                emitSelect();
                emit('select', 'target');
              },
            },
            'select',
          );
      },
    });

    const wrapper = mount(ContentMoveModal, {
      props: {
        open: true,
        ids: ['id-1'],
        scope: 'personal',
        activeCollection: { id: 'root', type: 'GROUP', title: 'Root' } as any,
        currentGroupId: 'sub-1',
        collections: [],
        projects: [],
        folderTreeItems: [],
      },
      global: {
        stubs: {
          UiAppModal: defineComponent({
            name: 'UiAppModal',
            props: ['open'],
            emits: ['update:open'],
            setup(_, { slots }) {
              return () => h('div', slots.default?.());
            },
          }),
          UAccordion: defineComponent({
            name: 'UAccordion',
            setup(_, { slots }) {
              return () => h('div', slots['to-group']?.());
            },
          }),
          UiAppButtonGroup: true,
          USelectMenu: true,
          UFormField: true,
          UButton: true,
          UIcon: true,
          CommonInfoTooltip: true,
          ContentGroupSelectTree: ContentGroupSelectTreeStub,
        },
      },
    });

    await wrapper.find('button').trigger('click');

    const events = wrapper.emitted('move') ?? [];
    expect(events.length).toBe(1);
    expect(events[0]?.[0]).toEqual({
      operation: 'MOVE_TO_GROUP',
      groupId: 'target',
      sourceGroupId: 'sub-1',
    });
  });
});
