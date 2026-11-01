import {useLayoutEffect} from 'react';

let held: {route: string; top: number} | null = null;
// The offset a reader had scrolled to when the startup frame went, which the next tree puts back when it shows the same
// page; any other page, or the sign-in page (no route), opens at the top. The startup Skeleton is as tall as the page,
// so the reader can scroll it, and WebKit drops the offset to the top when a new tree replaces it, as the tree's
// container queries lay out. The frame reads the offset as it goes, while its elements are still in the page.
export function useHeldScroll(route: string | undefined, startup: boolean) {
  useLayoutEffect(() => {
    if (held) scrollTo(0, held.route === route ? held.top : 0);
    held = null;
    return startup && route
      ? () => {
          held = {route, top: scrollY};
        }
      : undefined;
  }, [route, startup]);
}
