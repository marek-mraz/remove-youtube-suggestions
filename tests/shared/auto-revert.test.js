const { describe, it } = require('node:test');
const assert = require('node:assert');
const { loadSourceFile, assertDeepEqual } = require('../setup');

// Load main.js (defines AUTO_REVERT_* and processPendingReverts)
const main = loadSourceFile('shared/main.js');

describe('Auto-revert', () => {
  describe('AUTO_REVERT_IDS', () => {
    it('should protect the core blocking features', () => {
      const core = [
        'remove_homepage', 'remove_sidebar', 'remove_end_of_video',
        'remove_all_shorts', 'remove_comments', 'global_enable',
      ];
      for (const id of core) {
        assert.ok(main.AUTO_REVERT_IDS.has(id), `${id} should be protected`);
      }
    });

    it('should exclude the redirect radio group', () => {
      for (const id of ['redirect_to_subs', 'redirect_to_wl', 'redirect_to_library', 'redirect_off']) {
        assert.strictEqual(main.AUTO_REVERT_IDS.has(id), false, `${id} should not be protected`);
      }
    });

    it('should exclude reveal-box preferences and auto_revert itself', () => {
      for (const id of ['add_reveal_homepage', 'add_reveal_sidebar', 'add_reveal_end_of_video', 'auto_revert']) {
        assert.strictEqual(main.AUTO_REVERT_IDS.has(id), false, `${id} should not be protected`);
      }
    });

    it('should only contain known setting ids', () => {
      const known = new Set([
        ...main.SECTIONS.flatMap(s => s.options.map(o => o.id)),
        'global_enable',
      ]);
      for (const id of main.AUTO_REVERT_IDS) {
        assert.ok(known.has(id), `Unknown protected id: ${id}`);
      }
    });
  });

  describe('processPendingReverts', () => {
    it('should apply due reverts and keep future ones', () => {
      const now = 1_000_000;
      const pending = {
        remove_comments: now - 1,       // due
        remove_homepage: now,           // due (>=)
        remove_sidebar: now + 50_000,   // not due
      };
      const applied = [];
      const { due, remaining } = main.processPendingReverts(
        pending, (id, value) => applied.push([id, value]), now
      );

      assertDeepEqual(due.sort(), ['remove_comments', 'remove_homepage']);
      assertDeepEqual(applied.map(a => a[0]).sort(), ['remove_comments', 'remove_homepage']);
      assert.ok(applied.every(([, v]) => v === true), 'reverts should re-enable');
      assertDeepEqual(Object.keys(remaining), ['remove_sidebar']);
      assert.strictEqual(remaining.remove_sidebar, now + 50_000);
    });

    it('should handle empty/missing maps', () => {
      for (const input of [undefined, null, {}]) {
        const { due, remaining } = main.processPendingReverts(input, () => {
          assert.fail('should not apply anything');
        });
        assertDeepEqual(due, []);
        assertDeepEqual(remaining, {});
      }
    });

    it('should tolerate string timestamps (storage round-trip)', () => {
      const now = 500;
      const { due } = main.processPendingReverts({ remove_comments: '100' }, () => {}, now);
      assertDeepEqual(due, ['remove_comments']);
    });
  });

  describe('AUTO_REVERT_DELAY_MS', () => {
    it('should be one minute', () => {
      assert.strictEqual(main.AUTO_REVERT_DELAY_MS, 60 * 1000);
    });
  });
});
