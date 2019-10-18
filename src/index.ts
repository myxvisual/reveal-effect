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
let revealItemsMap = new Map<HTMLElement, RevealItem>();

// TODO: Border not cover all element.
// TODO: Overflow not supported.
// TODO: DOM removed not supported.
/**
 * Detect rectangle is overlap.
 * @param rect1 - DOMRect
 * @param rect2 - DOMRect
 */
function isRectangleOverlap(rect1: DOMRect, rect2: DOMRect) {
    return Math.max(rect1.left, rect2.left) < Math.min(rect1.right, rect2.right) && Math.max(rect1.top, rect2.top) < Math.min(rect1.bottom, rect2.bottom);
}

/**
 * Draw round rect to canvas context.
 * @param ctx - CanvasRenderingContext2D
 * @param x - number
 * @param y - number
 * @param w - number
 * @param h - number
 * @param r - number
 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();

    return ctx;
}

/**
 * Detect cursor is inside to rect.
 * @param position The mouse cursor position.
 * @param rect The DOMRect.
 */
function isRectInside(position: { left: number; top: number}, rect: DOMRect) {
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

    window.removeEventListener("scroll", handleScroll);
    window.addEventListener("scroll", handleScroll);
    window.removeEventListener("resize", updateCanvas);
    window.addEventListener("resize", updateCanvas);
    window.removeEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousemove", handleMouseMove);
}

function handleScroll(e: Event) {
    let hoverEl = e.target as HTMLElement;
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
    drawEffect(currMousePosition.x, currMousePosition.y, hoverEl);
}

function handleMouseMove(e: MouseEvent) {
    const el = e.target as HTMLElement;
    drawEffect(e.clientX, e.clientY, el);
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

function drawEffect(mouseX: number, mouseY: number, hoverEl: HTMLElement) {
    currMousePosition.x = mouseX;
    currMousePosition.y = mouseY;
    revealStore.hoverCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    revealStore.borderCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    let isHoverReveal = revealItemsMap.has(hoverEl);
    if (!isHoverReveal) {
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
    const effectItems: RevealItem[] = [];
    revealItemsMap.forEach(revealItem => {
        if (revealItem.element) {
            const rect = revealItem.element.getBoundingClientRect() as DOMRect;
            if (isRectangleOverlap(effectRect, rect)) {
                effectItems.push(revealItem);
            }
        }
    });

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

    let hoverBorderRadius: number;
    if (isHoverReveal) {
        const elBorderRadius = window.getComputedStyle(hoverEl).borderRadius as string;
        hoverBorderRadius = Number(elBorderRadius.replace("px", ""));
    }
    // inside hover effect.
    function drawHover() {
        if (isHoverReveal) {
    
            revealStore.hoverCtx.globalCompositeOperation = "source-over";
            drawHoverCircle(revealStore.hoverCtx);

            revealStore.hoverCtx.globalCompositeOperation = "destination-in";
            revealStore.hoverCtx.fillStyle = "#fff";
            const hoverRect = hoverEl.getBoundingClientRect() as DOMRect;
            if (hoverBorderRadius) {
                roundRect(revealStore.hoverCtx, hoverRect.left, hoverRect.top, hoverRect.width, hoverRect.height, hoverBorderRadius);
                revealStore.hoverCtx.fill();
            } else {
                revealStore.hoverCtx.fillRect(hoverRect.left, hoverRect.top, hoverRect.width, hoverRect.height);
            }
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
                const rect = element.getBoundingClientRect() as DOMRect;
                const computedStyle = window.getComputedStyle(element);
                const elBorderWidth = computedStyle.borderWidth as string;
                const elBorderRadius = computedStyle.borderRadius as string;
                let borderWidth = Number(elBorderWidth.replace("px", ""));
                const borderRadius = Number(elBorderRadius.replace("px", ""));

                revealStore.borderCtx.globalCompositeOperation = "source-over";
                revealStore.borderCtx.strokeStyle = borderColor;
                if (borderWidth || currRevealConfig.borderType === "inside") {
                    // draw inside border.
                    if (!borderWidth) borderWidth = currRevealConfig.borderWidth;
                    const halfBorderWidth = borderWidth / 2;
                    revealStore.borderCtx.lineWidth = borderWidth;
                    if (borderRadius) {
                        roundRect(revealStore.borderCtx, rect.x + halfBorderWidth, rect.y + halfBorderWidth, rect.width - borderWidth, rect.height - borderWidth, borderRadius);
                        revealStore.borderCtx.stroke();
                    } else {
                        revealStore.borderCtx.strokeRect(rect.x + halfBorderWidth, rect.y + halfBorderWidth, rect.width - borderWidth, rect.height - borderWidth);
                    }
                } else {
                    // draw outside border.
                    borderWidth = currRevealConfig.borderWidth;
                    const halfBorderWidth = borderWidth / 2;
                    revealStore.borderCtx.lineWidth = borderWidth;
                    if (borderRadius) {
                        roundRect(revealStore.borderCtx, rect.x - halfBorderWidth, rect.y - halfBorderWidth, rect.width + borderWidth, rect.height + borderWidth, borderRadius);
                        revealStore.borderCtx.stroke();
                    } else {
                        revealStore.borderCtx.strokeRect(rect.x - halfBorderWidth, rect.y - halfBorderWidth, rect.width + borderWidth, rect.height + borderWidth);
                    }
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
            drawHover();
            drawBorder();
            break;
        }
    }
}

function clearCanvas() {
    revealStore.hoverCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    revealStore.borderCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function isCanvasCreated() {
    const isCreated = [revealStore.hoverCanvas, revealStore.borderCanvas, revealStore.hoverCtx, revealStore.borderCtx].every(v => Boolean(v));
    if (!isCreated) {
        createCanvas();
    }
    return isCreated;
}

/**
 * Add reveal effect to revealItem.
 * @param revealItem - RevealItem
 */
function addRevealItem(revealItem: RevealItem) {
    isCanvasCreated();
    revealItemsMap.set(revealItem.element, revealItem);
}

/**
 * Add reveal effect to revealItem list.
 * @param revealItems - RevealItem[]
 */
function addRevealItems(revealItems: RevealItem[]) {
    isCanvasCreated();
    revealItems.forEach(revealItem => {
        revealItemsMap.set(revealItem.element, revealItem);
    });
}

/**
 * Add reveal effect to html element.
 * @param element - HTMLElement
 */
function addRevealEl(element: HTMLElement) {
    isCanvasCreated();
    const revealItem = { element };
    revealItemsMap.set(revealItem.element, revealItem);
}

/**
 * Add reveal effect to html element list.
 * @param elements - HTMLElement[] | NodeListOf<HTMLElement>
 */
function addRevealEls(elements: HTMLElement[] | NodeListOf<HTMLElement>) {
    elements.forEach((element: HTMLElement) => {
        const revealItem = { element };
        revealItemsMap.set(revealItem.element, revealItem);
    });
}

/**
 * Clear all reveal effect items.
 */
function clearRevealItems() {
    revealItemsMap.clear();
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
    if (isCanvasCreated()) {
        updateCanvas();
    }
}


export {
    createCanvas,
    clearCanvas,
    handleMouseMove,
    addRevealItem,
    addRevealItems,
    addRevealEl,
    addRevealEls,
    clearRevealItems,
    setRevealConfig
}
