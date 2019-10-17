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

export interface RevalConfig {
    borderWidth?: number;
    hoverSize?: number;
    effectEnable?: "hover" | "border" | "both";
    borderType?: "inside" | "outside";
    hoverColor?: string;
    zIndex?: number;
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
    zIndex: 9999
};
let { borderColor, transparentColor } = getMiddleColors(revealConfig.hoverColor);

function createCanvas() {
    hoverCanvas = document.createElement("canvas");
    borderCanvas = document.createElement("canvas");
    document.body.appendChild(hoverCanvas);
    document.body.appendChild(borderCanvas);
    hoverCtx = hoverCanvas.getContext("2d") as CanvasRenderingContext2D;
    borderCtx = borderCanvas.getContext("2d") as CanvasRenderingContext2D;
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
}

function createEffect() {
    createCanvas();
    updateCanvas();

    window.removeEventListener("scroll", handleScroll, true);
    window.addEventListener("scroll", handleScroll, true);
    window.removeEventListener("resize", updateCanvas, true);
    window.addEventListener("resize", updateCanvas, true);
    window.removeEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mousemove", handleMouseMove, true);
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
    const { borderColor, transparentColor } = getMiddleColors(revealConfig.hoverColor);

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

        if (draw2border) {
            gradient.addColorStop(0, borderColor);
            gradient.addColorStop(1, transparentColor);
        } else {
            gradient.addColorStop(0, revealConfig.hoverColor);
            gradient.addColorStop(1, transparentColor);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(mouseX - hoverRevealConfig.hoverSize, mouseY - hoverRevealConfig.hoverSize, mouseX + hoverRevealConfig.hoverSize, mouseY + hoverRevealConfig.hoverSize);
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
            hoverCtx.fillStyle = "#fff";
            const hoverRect = hoverEl.getBoundingClientRect() as DOMRect;
            if (hoverBorderRadius) {
                roundRect(hoverCtx, hoverRect.left, hoverRect.top, hoverRect.width, hoverRect.height, hoverBorderRadius);
                hoverCtx.fill();
            } else {
                hoverCtx.fillRect(hoverRect.left, hoverRect.top, hoverRect.width, hoverRect.height);
            }
    
            hoverCtx.globalCompositeOperation = "destination-in";
            drawHoverCircle(hoverCtx);
        }
    }

    // draw border effect.
    function drawBorder() {
        function drawAllRevealBorders() {
            effectItems.forEach(revealItem => {
                const element = revealItem.element;
                if (!element) return;
                const currRevealConfig = getRevealConfig(revealItem);
                const rect = element.getBoundingClientRect() as DOMRect;
                const computedStyle = window.getComputedStyle(element);
                const elBorderWidth = computedStyle.borderWidth as string;
                const elBorderRadius = computedStyle.borderRadius as string;
                const borderWidth = Number(elBorderWidth.replace("px", "")) || currRevealConfig.borderWidth;
                const borderRadius = Number(elBorderRadius.replace("px", ""));

                borderCtx.globalCompositeOperation = "source-over";
                borderCtx.lineWidth = borderWidth;
                borderCtx.strokeStyle = "#fff";
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

function checkEffectCreated() {
    if (![hoverCanvas, borderCanvas, hoverCtx, borderCtx].every(v => Boolean(v))) {
        createEffect();
    }
}

function addRevealItem(revealItem: RevealItem) {
    checkEffectCreated();
    revealItemsMap.set(revealItem.element, revealItem);
}

function addRevealItems(revealItems: RevealItem[]) {
    checkEffectCreated();
    revealItems.forEach(revealItem => {
        revealItemsMap.set(revealItem.element, revealItem);
    });
}

function addRevealEl(element: HTMLElement) {
    checkEffectCreated();
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

function getMiddleColors(hoverColor = revealConfig.hoverColor) {
    const { h, s, l, a } = tinyColor(hoverColor).toHsl();
    let borderColor = tinyColor({ h, s, l, a: a + .3 }).toRgbString();
    let transparentColor = tinyColor({ h, s, l, a: 0 }).toRgbString();

    return { borderColor, transparentColor };
}

function getRevealConfig(config: RevalConfig) {
    return {
        hoverSize: config.hoverSize === void 0 ? revealConfig.hoverSize : config.hoverSize,
        borderWidth: config.borderWidth === void 0 ? revealConfig.borderWidth : config.borderWidth,
        effectEnable: config.effectEnable === void 0 ? revealConfig.effectEnable : config.effectEnable,
        borderType: config.borderType === void 0 ? revealConfig.borderType : config.borderType,
        hoverColor: config.hoverColor === void 0 ? revealConfig.hoverColor : config.hoverColor,
        zIndex: config.zIndex === void 0 ? revealConfig.zIndex : config.zIndex
    } as Required<RevalConfig>;
}

function setRevealConfig(config: RevalConfig) {
    const newConfig = getRevealConfig(config);
    const middleColors = getMiddleColors(newConfig.hoverColor);
    borderColor = middleColors.borderColor;
    transparentColor = middleColors.transparentColor;

    Object.assign(revealConfig, newConfig);
}


export {
    createEffect as initRevealEffect,
    clearCanvas,
    handleMouseMove,
    addRevealItem,
    addRevealItems,
    addRevealEl,
    addRevealEls,
    clearRevealItems,
    setRevealConfig
}
