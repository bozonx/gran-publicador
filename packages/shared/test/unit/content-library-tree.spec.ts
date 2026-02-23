import { describe, it, expect } from '@jest/globals';
import { calculateRecursiveGroupCounters, type ContentCollectionForCounters } from '../../src/utils/content-library-tree.js';

describe('ContentLibraryTree Utils', () => {
    describe('calculateRecursiveGroupCounters', () => {
        it('should calculate sums for flat groups', () => {
            const collections: ContentCollectionForCounters[] = [
                { id: '1', type: 'GROUP', directItemsCount: 5 },
                { id: '2', type: 'GROUP', directItemsCount: 10 }
            ];
            const counters = calculateRecursiveGroupCounters(collections);
            expect(counters.get('1')).toBe(5);
            expect(counters.get('2')).toBe(10);
        });

        it('should calculate recursive sums for nested groups', () => {
            const collections: ContentCollectionForCounters[] = [
                { id: 'parent', type: 'GROUP', directItemsCount: 5 },
                { id: 'child1', type: 'GROUP', parentId: 'parent', directItemsCount: 10 },
                { id: 'child2', type: 'GROUP', parentId: 'parent', directItemsCount: 20 },
                { id: 'grandchild', type: 'GROUP', parentId: 'child1', directItemsCount: 30 }
            ];
            const counters = calculateRecursiveGroupCounters(collections);
            
            // grandchild = 30
            expect(counters.get('grandchild')).toBe(30);
            // child1 = 10 + 30 = 40
            expect(counters.get('child1')).toBe(40);
            // child2 = 20
            expect(counters.get('child2')).toBe(20);
            // parent = 5 + 40 + 20 = 65
            expect(counters.get('parent')).toBe(65);
        });

        it('should handle empty collections', () => {
            const counters = calculateRecursiveGroupCounters([]);
            expect(counters.size).toBe(0);
        });

        it('should ignore non-GROUP types in calculation but nested groups under them still might be skipped as they are usually children of groups', () => {
            // SAVED_VIEW doesn't have recursive items by design of this function
            const collections: ContentCollectionForCounters[] = [
                { id: 'g1', type: 'GROUP', directItemsCount: 5 },
                { id: 'v1', type: 'SAVED_VIEW', parentId: 'g1', directItemsCount: 100 }
            ];
            const counters = calculateRecursiveGroupCounters(collections);
            // SAVED_VIEW items are NOT added to group count by this logic (it only sums directItemsCount of groups)
            // Actually, let's look at the code: `total += countForGroup(childId, trail);` 
            // and `if (!group || group.type !== 'GROUP') { return 0; }`
            // So SAVED_VIEW directItemsCount is NOT included even if it's a child of a group?
            // Wait, `let total = Number(group.directItemsCount ?? 0);` is called for 'g1'.
            // Then it iterates children. 'v1' is a child of 'g1'.
            // countForGroup('v1') will return 0 because it's not a GROUP.
            expect(counters.get('g1')).toBe(5); 
        });
    });
});
