/**
 * Which kind of browser a page is open in, for things the browsers built into apps (Messenger, Facebook, Instagram…)
 * can't do - above all, saving a file. On Android these are bare web views that ignore downloads; on an iPhone they
 * can show a PDF but not save it (the share button can).
 */
export type BrowserKind = "normal" | "android-in-app" | "ios-in-app";

// Facebook, Messenger, Instagram, LINE, WeChat, Snapchat, TikTok… say so in their user agent; any other Android app's
// web view carries "; wv)". (WhatsApp opens links in the phone's own browser, which downloads normally.)
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger|Instagram|LinkedInApp|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Bytedance/i;

export function browserKind(ua: string): BrowserKind {
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const android = /Android/i.test(ua);
  if (android && (IN_APP.test(ua) || /; wv\)/.test(ua))) return "android-in-app";
  if (ios && IN_APP.test(ua)) return "ios-in-app";
  return "normal";
}

/**
 * An Android link that opens `url` in Chrome instead of the app's own browser (or, if Chrome isn't installed, in the
 * phone's default browser via the fallback).
 */
export function inChrome(url: string) {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}
