// page-flip(StPageFlip)에는 타입 정의가 없어 쓰는 것만 선언한다
declare module "page-flip/dist/js/page-flip.module.js" {
  export class PageFlip {
    constructor(el: HTMLElement, settings: Record<string, unknown>);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    flipNext(corner?: string): void;
    flipPrev(corner?: string): void;
    flip(page: number, corner?: string): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getOrientation(): "portrait" | "landscape";
    on(event: string, cb: (e: { data: unknown }) => void): void;
    destroy(): void;
  }
}
