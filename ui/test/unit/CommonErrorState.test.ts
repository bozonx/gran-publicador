import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import CommonErrorState from '../../app/components/common/CommonErrorState.vue';

describe('components/common/CommonErrorState.vue', () => {
    it('renders default error message and title', () => {
        const wrapper = mount(CommonErrorState, {
            props: {
                showRetry: false
            }
        });
        
        expect(wrapper.text()).toContain('common.errorOccurred');
    });

    it('renders custom title and error message string', () => {
        const wrapper = mount(CommonErrorState, {
            props: {
                title: 'Custom Title',
                error: 'Custom Error Message'
            }
        });
        
        expect(wrapper.find('h3').text()).toBe('Custom Title');
        expect(wrapper.find('p').text()).toBe('Custom Error Message');
    });

    it('renders error message from error object', () => {
        const wrapper = mount(CommonErrorState, {
            props: {
                error: { message: 'Object Error Message' }
            }
        });
        
        expect(wrapper.find('p').text()).toBe('Object Error Message');
    });

    it('emits retry event when button is clicked', async () => {
        const wrapper = mount(CommonErrorState, {
            props: {
                showRetry: true
            },
            global: {
                stubs: {
                    UButton: {
                        template: '<button @click="$emit(\'click\')"><slot /></button>'
                    },
                    UIcon: true
                }
            }
        });
        
        await wrapper.find('button').trigger('click');
        expect(wrapper.emitted('retry')).toBeTruthy();
    });

    it('shows loading state on retry button', () => {
        const wrapper = mount(CommonErrorState, {
            props: {
                loading: true,
                showRetry: true
            },
            global: {
              stubs: {
                UButton: true,
                UIcon: true
              }
            }
        });
        
        const button = wrapper.findComponent({ name: 'UButton' });
        expect(button.props('loading')).toBe(true);
    });
});
