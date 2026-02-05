import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CommonThumb from '../../app/components/common/Thumb.vue';

const UIconStub = {
  name: 'UIcon',
  props: {
    name: {
      type: String,
      required: false,
      default: '',
    },
  },
  template: '<span data-test="uicon" :data-icon="name" />',
};

const LoadingSpinnerStub = {
  name: 'LoadingSpinner',
  template: '<div data-test="spinner" />',
};

describe('CommonThumb', () => {
  it('renders spinner when pending=true', () => {
    const wrapper = mount(CommonThumb, {
      props: {
        src: 'https://example.com/a.png',
        pending: true,
        clickable: false,
      },
      global: {
        stubs: {
          UIcon: UIconStub,
          LoadingSpinner: LoadingSpinnerStub,
        },
      },
    });

    expect(wrapper.find('[data-test="spinner"]').exists()).toBe(true);
  });

  it('renders error state when error=true', () => {
    const wrapper = mount(CommonThumb, {
      props: {
        src: 'https://example.com/a.png',
        error: true,
        errorText: 'Boom',
        pending: false,
        clickable: false,
      },
      global: {
        stubs: {
          UIcon: UIconStub,
          LoadingSpinner: LoadingSpinnerStub,
        },
      },
    });

    expect(wrapper.text()).toContain('Boom');
    expect(wrapper.find('[data-test="uicon"]').attributes('data-icon')).toBe(
      'i-heroicons-exclamation-triangle',
    );
  });

  it('renders play overlay when isVideo=true and not pending/error', () => {
    const wrapper = mount(CommonThumb, {
      props: {
        src: 'https://example.com/a.png',
        isVideo: true,
        pending: false,
        clickable: false,
      },
      global: {
        stubs: {
          UIcon: UIconStub,
          LoadingSpinner: LoadingSpinnerStub,
        },
      },
    });

    expect(wrapper.find('img[src="/thumb-play-overlay.svg"]').exists()).toBe(true);
  });

  it('renders stack badge when totalCount > 2', () => {
    const wrapper = mount(CommonThumb, {
      props: {
        src: 'https://example.com/a.png',
        showStack: true,
        totalCount: 7,
        clickable: false,
      },
      global: {
        stubs: {
          UIcon: UIconStub,
          LoadingSpinner: LoadingSpinnerStub,
        },
      },
    });

    expect(wrapper.text()).toContain('7');
  });

  it('renders bottom and actions slots', () => {
    const wrapper = mount(CommonThumb, {
      props: {
        src: null,
        clickable: false,
      },
      slots: {
        bottom: '<div data-test="bottom">Bottom</div>',
        actions: '<div data-test="actions">Actions</div>',
      },
      global: {
        stubs: {
          UIcon: UIconStub,
          LoadingSpinner: LoadingSpinnerStub,
        },
      },
    });

    expect(wrapper.find('[data-test="bottom"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="actions"]').exists()).toBe(true);
  });
});
