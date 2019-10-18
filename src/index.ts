import tinyColor from "tinycolor2";

let hoverCanvas: HTMLCanvasElement;
let borderCanvas: HTMLCanvasElement;
let hoverCtx: CanvasRenderingContext2D;
let borderCtx: CanvasRenderingContext2D;
let revealItemsMap = new Map<HTMLElement, RevealItem>();

function isRectangleOverlap(rect1: DOMRect, rect2: DOMRect) {
    return Math.max(rect1.left, rect2.left) < Math.min(rect1.right, rect2.right) && Math.max(rect1.top, rect2.top) < Math.min(rect1.bottom, rect2.bottom);
}

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

function isInside(position: { left: number; top: number}, rect: DOMRect) {
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

export interface RevealItem {
    element: HTMLElement;

    borderWidth?: RevalConfig["borderWidth"];
    hoverSize?: RevalConfig["hoverSize"];
    effectEnable?: RevalConfig["effectEnable"];
    borderType?: RevalConfig["borderType"];
    hoverColor?: RevalConfig["hoverColor"];
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
    hoverCanvas = document.createElement("canvas");
    borderCanvas = document.createElement("canvas");
    document.body.appendChild(hoverCanvas);
    document.body.appendChild(borderCanvas);
    hoverCtx = hoverCanvas.getContext("2d") as CanvasRenderingContext2D;
    borderCtx = borderCanvas.getContext("2d") as CanvasRenderingContext2D;

    updateCanvas();
}

function updateCanvas() {
    Object.assign(hoverCanvas.style, {
        width: `${window.innerWidth}px`,
        height: `${window.innerHeight}px`,
        position: "fixed",
        left: "0px",
        top: "0px",
        pointerEvents: "none",
        zIndex: revealConfig.zIndex
    });
    Object.assign(borderCanvas.style, {
        width: `${window.innerWidth}px`,
        height: `${window.innerHeight}px`,
        position: "fixed",
        left: "0px",
        top: "0px",
        pointerEvents: "none",
        zIndex: revealConfig.zIndex
    });
    Object.assign(hoverCanvas, {
        width: window.innerWidth,
        height: window.innerHeight,
    })
    Object.assign(borderCanvas, {
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
            const isInsideEl = isInside({ left: currMousePosition.x, top: currMousePosition.y }, rect);
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
    hoverCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    borderCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

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
    
            hoverCtx.globalCompositeOperation = "source-over";
            drawHoverCircle(hoverCtx);

            hoverCtx.globalCompositeOperation = "destination-in";
            hoverCtx.fillStyle = "#fff";
            const hoverRect = hoverEl.getBoundingClientRect() as DOMRect;
            if (hoverBorderRadius) {
                roundRect(hoverCtx, hoverRect.left, hoverRect.top, hoverRect.width, hoverRect.height, hoverBorderRadius);
                hoverCtx.fill();
            } else {
                hoverCtx.fillRect(hoverRect.left, hoverRect.top, hoverRect.width, hoverRect.height);
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
                const borderWidth = Number(elBorderWidth.replace("px", "")) || currRevealConfig.borderWidth;
                const borderRadius = Number(elBorderRadius.replace("px", ""));

                borderCtx.globalCompositeOperation = "source-over";
                borderCtx.lineWidth = borderWidth;
                borderCtx.strokeStyle = borderColor;
                if (borderWidth || currRevealConfig.borderType === "inside") {
                    // draw inside border.
                    if (borderRadius) {
                        roundRect(borderCtx, rect.x, rect.y, rect.width, rect.height, borderRadius);
                        borderCtx.stroke();
                    } else {
                        borderCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
                    }
                } else {
                    // draw outside border.
                    if (borderRadius) {
                        roundRect(borderCtx, rect.x - borderWidth, rect.y - borderWidth, rect.width + borderWidth, rect.height + borderWidth, borderRadius);
                        borderCtx.stroke();
                    } else {
                        borderCtx.strokeRect(rect.x - borderWidth, rect.y - borderWidth, rect.width + borderWidth, rect.height + borderWidth);
                    }
                }
            });
        }

        drawAllRevealBorders();
        // make border mask.
        borderCtx.globalCompositeOperation = "destination-in";
        drawHoverCircle(borderCtx, true);
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
    hoverCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    borderCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function isCanvasCreated() {
    const isCreated = [hoverCanvas, borderCanvas, hoverCtx, borderCtx].every(v => Boolean(v));
    if (!isCreated) {
        createCanvas();
    }
    return isCreated;
}

function addRevealItem(revealItem: RevealItem) {
    isCanvasCreated();
    revealItemsMap.set(revealItem.element, revealItem);
}

function addRevealItems(revealItems: RevealItem[]) {
    isCanvasCreated();
    revealItems.forEach(revealItem => {
        revealItemsMap.set(revealItem.element, revealItem);
    });
}

function addRevealEl(element: HTMLElement) {
    isCanvasCreated();
    const revealItem = { element };
    revealItemsMap.set(revealItem.element, revealItem);
}

function addRevealEls(elements: HTMLElement[] | NodeListOf<HTMLElement>) {
    elements.forEach((element: HTMLElement) => {
        const revealItem = { element };
        revealItemsMap.set(revealItem.element, revealItem);
    });
}

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
