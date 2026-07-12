const { describe, it } = require('node:test');
const assert = require('node:assert');
const { loadSourceFiles } = require('../setup');

// social.js depends on shared/main.js (DEFAULT_SETTINGS, processPendingReverts).
// The runtime block is skipped because the test context has no `document`.
const ctx = loadSourceFiles(['shared/main.js', 'content-script/social.js']);

const FB_TARGET = 'https://www.facebook.com/?filter=friends&sk=h_chr';
const IG_TARGET = 'https://www.instagram.com/?variant=following';

const ALL_ON = {
  fb_redirect_friends: true,
  fb_redirect_reels: true,
  ig_redirect_following: true,
  ig_redirect_reels: true,
};

describe('Social redirects (Facebook / Instagram)', () => {
  describe('Facebook', () => {
    it('should redirect the root feed to the friends-only chronological feed', () => {
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/', ALL_ON), FB_TARGET);
    });

    it('should not redirect when already on the friends feed (no loop)', () => {
      assert.strictEqual(ctx.getSocialRedirect(FB_TARGET, ALL_ON), null);
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/?sk=h_chr', ALL_ON), null);
    });

    it('should redirect the Reels tab and individual reels', () => {
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/reel/?s=tab', ALL_ON), FB_TARGET);
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/reel/1234567890', ALL_ON), FB_TARGET);
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/reels/', ALL_ON), FB_TARGET);
    });

    it('should leave other Facebook pages alone', () => {
      for (const href of [
        'https://www.facebook.com/groups/feed/',
        'https://www.facebook.com/marketplace/',
        'https://www.facebook.com/some.profile',
        'https://www.facebook.com/messages/t/123',
        'https://www.facebook.com/reeldance', // not a /reel path
      ]) {
        assert.strictEqual(ctx.getSocialRedirect(href, ALL_ON), null, href);
      }
    });

    it('should respect the individual toggles', () => {
      const feedOff = { ...ALL_ON, fb_redirect_friends: false };
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/', feedOff), null);
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/reel/?s=tab', feedOff), FB_TARGET);

      const reelsOff = { ...ALL_ON, fb_redirect_reels: false };
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/reel/?s=tab', reelsOff), null);
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/', reelsOff), FB_TARGET);
    });
  });

  describe('Instagram', () => {
    it('should redirect the root feed to the Following feed', () => {
      assert.strictEqual(ctx.getSocialRedirect('https://www.instagram.com/', ALL_ON), IG_TARGET);
    });

    it('should not redirect when already on the Following feed (no loop)', () => {
      assert.strictEqual(ctx.getSocialRedirect(IG_TARGET, ALL_ON), null);
    });

    it('should redirect Reels (tab and individual)', () => {
      assert.strictEqual(ctx.getSocialRedirect('https://www.instagram.com/reels/', ALL_ON), IG_TARGET);
      assert.strictEqual(ctx.getSocialRedirect('https://www.instagram.com/reels/DAbCd123/', ALL_ON), IG_TARGET);
      assert.strictEqual(ctx.getSocialRedirect('https://www.instagram.com/reel/DAbCd123/', ALL_ON), IG_TARGET);
    });

    it('should leave other Instagram pages alone', () => {
      for (const href of [
        'https://www.instagram.com/some_user/',
        'https://www.instagram.com/direct/inbox/',
        'https://www.instagram.com/explore/', // not covered by these toggles
        'https://www.instagram.com/p/DAbCd123/',
      ]) {
        assert.strictEqual(ctx.getSocialRedirect(href, ALL_ON), null, href);
      }
    });

    it('should respect the individual toggles', () => {
      const feedOff = { ...ALL_ON, ig_redirect_following: false };
      assert.strictEqual(ctx.getSocialRedirect('https://www.instagram.com/', feedOff), null);

      const reelsOff = { ...ALL_ON, ig_redirect_reels: false };
      assert.strictEqual(ctx.getSocialRedirect('https://www.instagram.com/reels/', reelsOff), null);
    });
  });

  describe('Safety', () => {
    it('should never redirect other hosts', () => {
      for (const href of [
        'https://www.youtube.com/',
        'https://www.fakefacebook.com/',
        'https://www.facebook.com.evil.com/',
        'https://evilinstagram.com/',
      ]) {
        assert.strictEqual(ctx.getSocialRedirect(href, ALL_ON), null, href);
      }
    });

    it('should return null for malformed URLs and missing settings', () => {
      assert.strictEqual(ctx.getSocialRedirect('not a url', ALL_ON), null);
      assert.strictEqual(ctx.getSocialRedirect('https://www.facebook.com/', {}), null);
    });
  });

  describe('Auto-revert integration', () => {
    it('all four redirect toggles should be protected by auto-revert', () => {
      for (const id of ['fb_redirect_friends', 'fb_redirect_reels', 'ig_redirect_following', 'ig_redirect_reels']) {
        assert.ok(ctx.AUTO_REVERT_IDS.has(id), `${id} should auto-restore`);
      }
    });

    it('toggles should default to on and be free-tier', () => {
      for (const id of ['fb_redirect_friends', 'fb_redirect_reels', 'ig_redirect_following', 'ig_redirect_reels']) {
        assert.strictEqual(ctx.DEFAULT_SETTINGS[id], true, `${id} default`);
        assert.strictEqual(ctx.PREMIUM_FEATURE_ID_SET.has(id), false, `${id} must not be premium-gated`);
      }
    });
  });
});
