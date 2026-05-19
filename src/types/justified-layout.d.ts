declare module 'justified-layout' {
  export interface JustifiedLayoutBox {
    top: number;
    left: number;
    width: number;
    height: number;
    aspectRatio: number;
  }

  export interface JustifiedLayoutResult {
    boxes: JustifiedLayoutBox[];
    containerHeight: number;
    widowCount: number;
  }

  export interface JustifiedLayoutOptions {
    containerWidth?: number;
    containerPadding?: number | { top: number; right: number; bottom: number; left: number };
    boxSpacing?: number | { horizontal: number; vertical: number };
    targetRowHeight?: number;
    targetRowHeightTolerance?: number;
    maxNumRows?: number;
    fullWidthBreakoutRowCadence?: number | false;
    showWidows?: boolean;
    forceAspectRatio?: number | false;
  }

  function justifiedLayout(
    items: Array<{ width: number; height: number } | number>,
    options?: JustifiedLayoutOptions,
  ): JustifiedLayoutResult;

  export default justifiedLayout;
}
