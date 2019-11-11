import tinyColor from "tinycolor2";

interface RevealStore {
    hoverCanvas: HTMLCanvasElement;
    borderCanvas: HTMLCanvasElement;
    hoverCtx: CanvasRenderingContext2D;
    borderCtx: CanvasRenderingContext2D;
}

const revealStore: RevealStore = {
    hoverCanvas: null,
    borderCanvas: null,
    hoverCtx: null,
    borderCtx: null,
} as any;
const revealItemsMap = new Map<HTMLElement, RevealItem>();
const coverItemsMap = new Map<HTMLElement, boolean>();
const observersMap = new Map<HTMLElement, MutationObserver>();

function px2numb(px: string | null) {
    return px ? Number(px.replace("px", "")) : 0;
}

function getBorderRadius(style: CSSStyleDeclaration) {
    return {
        borderTopLeftRadius: px2numb(style.borderTopLeftRadius),
        borderTopRightRadius: px2numb(style.borderTopRightRadius),
        borderBottomLeftRadius: px2numb(style.borderBottomLeftRadius),
        borderBottomRightRadius: px2numb(style.borderBottomRightRadius)
    }
}

/**
 * Detect rectangle is overlap.
 * @param rect1 - DOMRect
 * @param rect2 - DOMRect
 */
function isRectangleOverlap(rect1: DOMRect, rect2: DOMRect) {
    return Math.max(rect1.left, rect2.left) < Math.min(rect1.right, rect2.right) && Math.max(rect1.top, rect2.top) < Math.min(rect1.bottom, rect2.bottom);
}

function isOverflowed(element: HTMLElement) {
    return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
}

enum DrawType {
    Fill,
    Stroke
}

function drawRadiusRect(ctx: CanvasRenderingContext2D, rect: { x: number, y: number, w: number, h: number }, radius: { borderTopLeftRadius: number; borderTopRightRadius: number; borderBottomLeftRadius: number; borderBottomRightRadius: number; }) {
    const { x, y, w, h } = rect;
    const {
        borderTopLeftRadius,
        borderTopRightRadius,
        borderBottomLeftRadius,
        borderBottomRightRadius
    } = radius;

    ctx.beginPath();
    // tl start point.
    ctx.moveTo(x, y + borderTopLeftRadius);

    // tl radius.
    ctx.arcTo(x, y, x + borderTopLeftRadius, y, borderTopLeftRadius);

    // top line.
    ctx.lineTo(x + w - borderTopRightRadius, y);
    // tr radius.
    ctx.arcTo(x + w, y, x + w, y + borderTopRightRadius, borderTopRightRadius);

    // right line.
    ctx.lineTo(x + w, y + h - borderBottomRightRadius);

    // br radius.
    ctx.arcTo(x + w, y + h, x + w - borderBottomRightRadius, y + h, borderBottomRightRadius);
    // bottom line.
    ctx.lineTo(x + borderBottomLeftRadius, y + h);
    // bl radius.
    ctx.arcTo(x, y + h, x, y + h - borderBottomLeftRadius, borderBottomLeftRadius);

    // left line.
    ctx.lineTo(x, y + borderTopLeftRadius);
}

function drawElement2Ctx(ctx: CanvasRenderingContext2D, element: HTMLElement, drawType: DrawType = DrawType.Stroke) {
    const rect = element.getBoundingClientRect() as DOMRect;
    const {
        left: x,
        top: y,
        width: w,
        height: h
    } = rect;
    const style = window.getComputedStyle(element);
    const {
        borderTopWidth,
        borderBottomWidth,
        borderLeftWidth,
        borderRightWidth
    } = style;
    const [topWidth, bottomWidth, leftWidth, rightWidth] = [borderTopWidth, borderBottomWidth, borderLeftWidth, borderRightWidth].map(t => px2numb(t));
    const isHadBorder = [topWidth, bottomWidth, leftWidth, rightWidth].some(t => Boolean(t));
    const isStroke = drawType === DrawType.Stroke;

    const borderRadius = getBorderRadius(style);
    if (isStroke) {
        if (isHadBorder) {
            ctx.globalCompositeOperation = "source-over";
            drawRadiusRect(ctx, { x, y, w, h }, borderRadius);
            // ctx.fillStyle = "#fff";
            ctx.fill();

            ctx.globalCompositeOperation = "destination-out";
            drawRadiusRect(ctx, { x: x + leftWidth, y: y + topWidth, w: w - leftWidth - rightWidth, h: h - topWidth - bottomWidth }, borderRadius);
            // ctx.fillStyle = "#fff";
            ctx.fill();
        } else {
            const offsetWidth = ctx.lineWidth / 2;
            drawRadiusRect(ctx, { x: x + offsetWidth, y: y + offsetWidth, w: w - ctx.lineWidth, h: h - ctx.lineWidth }, borderRadius);
            ctx.closePath();
            ctx.stroke();
        }
    } else {
        drawRadiusRect(ctx, { x, y, w, h }, borderRadius);
        ctx.fill();
    }

    return ctx;
}


/**
 * Detect cursor is inside to rect.
 * @param position The mouse cursor position.
 * @param rect The DOMRect.
 */
function isRectInside(position: { left: number; top: number }, rect: DOMRect) {
    return (position.left > rect.left && position.left < rect.right && position.top > rect.top && position.top < rect.bottom);
}

interface MiddleColor {
    borderColor: string;
    hoverEndColor: string;
}

/** ColorMiddleware function. */
type ColorMiddlewareFunc = (hoverColor?: string) => MiddleColor;

/** Set reveal effect config. */
export interface RevalConfig {
    /** Set hover borderWidth. */
    borderWidth?: number;
    /** Set hover size. */
    hoverSize?: number;
    /** Set effectEnable type, default is both. */
    effectEnable?: "hover" | "border" | "both";
    /** Set borderType, default is inside. */
    borderType?: "inside" | "outside";
    /** Set hoverColor. */
    hoverColor?: string;
    /** Set canvas zIndex. */
    zIndex?: number;
    /** Set colorMiddleware function. */
    colorMiddleware?: ColorMiddlewareFunc;
}

export interface CircleGradient {
    x: number;
    y: number;
    color1: string;
    color2: string;
    r1: number;
    r2: number;
}

/**
 * RevealItem interface.
 * 
 */
export interface RevealItem {
    element: HTMLElement;

    borderWidth?: RevalConfig["borderWidth"];
    hoverSize?: RevalConfig["hoverSize"];
    effectEnable?: RevalConfig["effectEnable"];
    borderType?: RevalConfig["borderType"];
    hoverColor?: RevalConfig["hoverColor"];

    /**
     * zIndex is not supported, only for the type.
     */
    zIndex?: RevalConfig["zIndex"];
}

const currMousePosition = {
    x: 0,
    y: 0
};
const revealConfig: Required<RevalConfig> = {
    hoverSize: 60,
    hoverColor: "rgba(255, 255, 255, .2)",
    borderWidth: 2,
    effectEnable: "both",
    borderType: "inside",
    zIndex: 9999,
    colorMiddleware: (hoverColor?: string) => {
        const { h, s, l, a } = tinyColor(hoverColor).toHsl();
        let borderColor = tinyColor({ h, s, l, a: a + .4 }).toRgbString() as string;
        let hoverEndColor = tinyColor({ h, s, l, a: 0 }).toRgbString() as string;
        return { borderColor, hoverEndColor };
    }
};

/** Create reveal effect method. */
function createCanvas() {
    revealStore.hoverCanvas = document.createElement("canvas");
    revealStore.borderCanvas = document.createElement("canvas");
    document.body.appendChild(revealStore.hoverCanvas);
    document.body.appendChild(revealStore.borderCanvas);
    revealStore.hoverCtx = revealStore.hoverCanvas.getContext("2d") as CanvasRenderingContext2D;
    revealStore.borderCtx = revealStore.borderCanvas.getContext("2d") as CanvasRenderingContext2D;

    updateCanvas();
}

function removeCanvas() {
    document.body.removeChild(revealStore.hoverCanvas);
    document.body.removeChild(revealStore.borderCanvas);
    delete revealStore.hoverCanvas;
    delete revealStore.borderCanvas;
    delete revealStore.hoverCtx;
    delete revealStore.borderCtx;
}

function updateCanvas() {
    Object.assign(revealStore.hoverCanvas.style, {
        width: `${window.innerWidth}px`,
        height: `${window.innerHeight}px`,
        position: "fixed",
        left: "0px",
        top: "0px",
        pointerEvents: "none",
        zIndex: revealConfig.zIndex
    });
    Object.assign(revealStore.borderCanvas.style, {
        width: `${window.innerWidth}px`,
        height: `${window.innerHeight}px`,
        position: "fixed",
        left: "0px",
        top: "0px",
        pointerEvents: "none",
        zIndex: revealConfig.zIndex
    });
    Object.assign(revealStore.hoverCanvas, {
        width: window.innerWidth,
        height: window.innerHeight,
    })
    Object.assign(revealStore.borderCanvas, {
        width: window.innerWidth,
        height: window.innerHeight,
    })

    document.removeEventListener("scroll", handleScroll, true);
    document.addEventListener("scroll", handleScroll, true);
    document.removeEventListener("click", handleScroll, true);
    document.addEventListener("click", handleScroll, true);
    window.removeEventListener("resize", updateCanvas);
    window.addEventListener("resize", updateCanvas);
    window.removeEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousemove", handleMouseMove);
}

function handleScroll(e: Event) {
    let hoverEl = document.body as HTMLElement;
    revealItemsMap.forEach(({ element }) => {
        if (element) {
            const rect = element.getBoundingClientRect() as DOMRect;
            const isInsideEl = isRectInside({ left: currMousePosition.x, top: currMousePosition.y }, rect);
            if (isInsideEl) {
                if (hoverEl.contains(element)) {
                    hoverEl = element;
                }
            }
        }
    });
    drawEffect(currMousePosition.x, currMousePosition.y, hoverEl, true);
}

function handleMouseMove(e: MouseEvent) {
    const el = e.target as HTMLElement;
    drawEffect(e.clientX, e.clientY, el, true);
}

function getHoverParentEl(hoverEl: HTMLElement) {
    let parentEl: HTMLElement = document.body;
    revealItemsMap.forEach(({ element }) => {
        if (element) {
            if (element.contains(hoverEl) && parentEl.contains(element)) {
                parentEl = element;
            }
        }
    });

    return parentEl;
}

function clearHoverCtx() {
    revealStore.hoverCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function clearBorderCtx() {
    revealStore.borderCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function drawEffect(mouseX: number, mouseY: number, hoverEl: HTMLElement, clearHover: boolean) {
    currMousePosition.x = mouseX;
    currMousePosition.y = mouseY;
    if (clearHover) {
        clearHoverCtx();
    }
    clearBorderCtx();

    let isHoverReveal = revealItemsMap.has(hoverEl);
    if (!isHoverReveal && !coverItemsMap.has(hoverEl)) {
        hoverEl = getHoverParentEl(hoverEl);
        isHoverReveal = revealItemsMap.has(hoverEl);
    }
    const hoverRevealConfig = isHoverReveal ? getRevealConfig(revealItemsMap.get(hoverEl) as RevealItem) : revealConfig;
    const { borderColor, hoverEndColor } = hoverRevealConfig.colorMiddleware(hoverRevealConfig.hoverColor);

    const effectLeft = mouseX - hoverRevealConfig.hoverSize;
    const effectTop = mouseY - hoverRevealConfig.hoverSize;
    const effectSize = 2 * hoverRevealConfig.hoverSize;
    const effectRect = {
        left: effectLeft,
        top: effectTop,
        right: effectLeft + effectSize,
        bottom: effectTop + effectSize
    } as DOMRect;
    let effectItems: RevealItem[] = [];
    revealItemsMap.forEach(revealItem => {
        if (revealItem.element) {
            const rect = revealItem.element.getBoundingClientRect() as DOMRect;
            if (isRectangleOverlap(effectRect, rect)) {
                effectItems.push(revealItem);
            }
        }
    });
    // sort effectItems by depth(deeper).
    effectItems = effectItems.sort((a, b) => a.element.compareDocumentPosition(b.element) & 2 ? -1 : 1);

    function drawHoverCircle(ctx: CanvasRenderingContext2D, draw2border = false) {
        const gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, hoverRevealConfig.hoverSize)

        const transparentColor = "rgba(0, 0, 0, 0)";
        if (draw2border) {
            gradient.addColorStop(0, borderColor);
            gradient.addColorStop(1, transparentColor);
        } else {
            gradient.addColorStop(0, hoverRevealConfig.hoverColor);
            gradient.addColorStop(1, hoverEndColor);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }

    // inside hover effect.
    function drawHover() {
        if (isHoverReveal) {
            revealStore.hoverCtx.globalCompositeOperation = "source-over";
            drawHoverCircle(revealStore.hoverCtx);

            revealStore.hoverCtx.globalCompositeOperation = "destination-in";
            revealStore.hoverCtx.fillStyle = "#fff";
            drawElement2Ctx(revealStore.hoverCtx, hoverEl, DrawType.Fill);
        }
    }

    // draw border effect.
    function drawBorder() {
        function drawAllRevealBorders() {
            effectItems.forEach(revealItem => {
                const element = revealItem.element;
                if (!element) return;
                const currRevealConfig = getRevealConfig(revealItem);
                const { borderColor } = currRevealConfig.colorMiddleware(currRevealConfig.hoverColor);

                revealStore.borderCtx.globalCompositeOperation = "source-over";
                revealStore.borderCtx.strokeStyle = borderColor;

                // draw inside border.
                revealStore.borderCtx.lineWidth = currRevealConfig.borderWidth;
                revealStore.borderCtx.fillStyle = currRevealConfig.hoverColor;
                revealStore.borderCtx.strokeStyle = currRevealConfig.hoverColor;
                
                drawElement2Ctx(revealStore.borderCtx, element, DrawType.Stroke);
                const parentEl = element.parentElement as HTMLElement;
                if (coverItemsMap.has(parentEl)) {
                    const rect = parentEl.getBoundingClientRect() as DOMRect;
                    revealStore.borderCtx.globalCompositeOperation = "destination-in";
                    revealStore.hoverCtx.globalCompositeOperation = "destination-in";
                    revealStore.borderCtx.fillStyle = "#fff";
                    revealStore.hoverCtx.fillStyle = "#fff";
                    revealStore.borderCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
                    revealStore.hoverCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
                }
            });
        }

        drawAllRevealBorders();
        // make border mask.
        revealStore.borderCtx.globalCompositeOperation = "destination-in";
        drawHoverCircle(revealStore.borderCtx, true);
    }

    switch (hoverRevealConfig.effectEnable) {
        case "hover": {
            drawHover();
            break;
        }
        case "border": {
            drawBorder();
            break;
        }
        default: {
            drawBorder();
            drawHover();
            break;
        }
    }
}

function clearCanvas() {
    if (isCanvasCreated()) {
        clearHoverCtx();
        clearBorderCtx();
    }
    revealItemsMap.clear();
}

function isCanvasCreated() {
    return revealStore.hoverCanvas && revealStore.borderCanvas && revealStore.hoverCtx && revealStore.borderCtx;
}

function checkAndCreateCanvas() {
    if (!isCanvasCreated()) {
        createCanvas();
    }
}

const observerConfig: MutationObserverInit = {
    attributes: true,
    characterData: false,
    childList: true,
    subtree: true
};

const observerParentConfig: MutationObserverInit = {
    attributes: true,
    characterData: false,
    childList: true,
    subtree: true
};

function addObserver(element: HTMLElement) {
    const { parentElement } = element;
    const observer = new MutationObserver((mutationsList) => {
        const elements = revealItemsMap.keys();
        let isRemoved = false;
        for (const el of elements) {
            if (!document.documentElement.contains(el)) {
                revealItemsMap.delete(el);
                observersMap.delete(el);
                // observer.disconnect();
                isRemoved = el === element;
            }
            if (isRemoved) break;
        }
        if (isRemoved) return;

        const isInsideEl = isRectInside({ left: currMousePosition.x, top: currMousePosition.y }, element.getBoundingClientRect() as DOMRect);
        drawEffect(currMousePosition.x, currMousePosition.y, isInsideEl ? element : document.documentElement, isInsideEl);
    });
    // Start observing the target node for configured mutations.
    // observer.observe(element, observerConfig);
    if (parentElement) {
        observer.observe(parentElement, observerParentConfig);
    }
    observersMap.set(element, observer);
}

function clearObserver(element: HTMLElement) {
    const observer = observersMap.get(element);
    if (observer) {
        observer.disconnect();
        revealItemsMap.delete(element);
    }
}

function clearObservers() {
    observersMap.forEach(observer => observer.disconnect());
    observersMap.clear();
}

/**
 * Add reveal effect to revealItem.
 * @param revealItem - RevealItem
 */
function addRevealItem(revealItem: RevealItem) {
    checkAndCreateCanvas();
    const { element } = revealItem;
    if (element) {
        addObserver(element);
        revealItemsMap.set(element, revealItem);
        const { parentElement } = element;
        if (parentElement && isOverflowed(parentElement)) {
            coverItemsMap.set(parentElement as HTMLElement, true);
        }
    }
}

/**
 * Add reveal effect to revealItem list.
 * @param revealItems - RevealItem[]
 */
function addRevealItems(revealItems: RevealItem[]) {
    checkAndCreateCanvas();
    revealItems.forEach(revealItem => {
        const { element } = revealItem;
        if (element) {
            addObserver(element);
            revealItemsMap.set(element, revealItem);
            const { parentElement } = element;
            if (parentElement && isOverflowed(parentElement)) {
                coverItemsMap.set(parentElement as HTMLElement, true);
            }
        }
    });
}

/**
 * Add reveal effect to html element.
 * @param element - HTMLElement
 */
function addRevealEl(element: HTMLElement) {
    checkAndCreateCanvas();
    if (element) {
        addObserver(element);
        const revealItem = { element };
        revealItemsMap.set(element, revealItem);
        const { parentElement } = element;
        if (parentElement && isOverflowed(parentElement)) {
            coverItemsMap.set(parentElement as HTMLElement, true);
        }
    }
}

/**
 * Add reveal effect to html element list.
 * @param elements - HTMLElement[] | NodeListOf<HTMLElement>
 */
function addRevealEls(elements: HTMLElement[] | NodeListOf<HTMLElement>) {
    checkAndCreateCanvas();
    elements.forEach((element: HTMLElement) => {
        if (element) {
            addObserver(element);
            const revealItem = { element };
            revealItemsMap.set(element, revealItem);
            const { parentElement } = element;
            if (parentElement && isOverflowed(parentElement)) {
                coverItemsMap.set(parentElement as HTMLElement, true);
            }
        }
    });
}

function addCoverEl(element: HTMLElement) {
    if (element) {
        addObserver(element);
        coverItemsMap.set(element, true);
    }
}

function addCoverEls(elements: HTMLElement[] | NodeListOf<HTMLElement>) {
    elements.forEach((element: HTMLElement) => {
        if (element) {
            coverItemsMap.set(element, true);
        }
    });
}

/**
 * Clear all reveal effect element.
 */
function clearRevealEl(element: HTMLElement) {
    if (revealItemsMap.has(element)) {
        revealItemsMap.delete(element);
    }
    clearObserver(element);
    clearCanvas();
}

/**
 * Clear all reveal effect item.
 */
function clearRevealItem(revealItem: RevealItem) {
    if (revealItemsMap.has(revealItem.element)) {
        revealItemsMap.delete(revealItem.element);
        clearObserver(revealItem.element);
    }
    clearCanvas();
}

/**
 * Clear all reveal effect elements.
 */
function clearRevealEls() {
    revealItemsMap.clear();
    clearCanvas();
    clearObservers();
}

/**
 * Clear all reveal effect items.
 */
function clearRevealItems() {
    revealItemsMap.clear();
    clearCanvas();
    clearObservers();
}

function getRevealConfig(config: RevalConfig) {
    return {
        hoverSize: config.hoverSize === void 0 ? revealConfig.hoverSize : config.hoverSize,
        borderWidth: config.borderWidth === void 0 ? revealConfig.borderWidth : config.borderWidth,
        effectEnable: config.effectEnable === void 0 ? revealConfig.effectEnable : config.effectEnable,
        borderType: config.borderType === void 0 ? revealConfig.borderType : config.borderType,
        hoverColor: config.hoverColor === void 0 ? revealConfig.hoverColor : config.hoverColor,
        zIndex: config.zIndex === void 0 ? revealConfig.zIndex : config.zIndex,
        colorMiddleware: config.colorMiddleware === void 0 ? revealConfig.colorMiddleware : config.colorMiddleware
    } as Required<RevalConfig>;
}

function setRevealConfig(config: RevalConfig) {
    const newConfig = getRevealConfig(config);
    Object.assign(revealConfig, newConfig);
    checkAndCreateCanvas();
    updateCanvas();
}

export {
    createCanvas,
    clearCanvas,
    handleMouseMove,
    addRevealItem,
    clearRevealItem,
    addRevealItems,
    clearRevealItems,
    addRevealEl,
    clearRevealEl,
    addRevealEls,
    clearRevealEls,
    addCoverEl,
    addCoverEls,
    setRevealConfig
}
