import tinyColor from "tinycolor2";

let hoverCanvas: HTMLCanvasElement;
let borderCanvas: HTMLCanvasElement;
let hoverCtx: CanvasRenderingContext2D;
let borderCtx: CanvasRenderingContext2D;
let revealItemsMap = new Map<HTMLElement, RevealItem>();

// TODO: Add borderRadius.
// TODO: Set onScroll position.
function isRectangleOverlap(rect1: DOMRect, rect2: DOMRect) {
    return Math.max(rect1.left, rect2.left) < Math.min(rect1.right, rect2.right) && Math.max(rect1.top, rect2.top) < Math.min(rect1.bottom, rect2.bottom);
}

export interface RevalConfig {
    borderWidth?: number;
    hoverSize?: number;
    effectEnable?: "hover" | "border" | "both";
    borderType?: "inside" | "outside";
    hoverColor?: string;
}

export interface CircleGradient {
    x: number;
    y: number;
    color1: string;
    color2: string;
    r1: number;
    r2: number;
}

export interface RevealItem extends RevalConfig {
    element: HTMLElement;
}

const revealConfig: Required<RevalConfig> = {
    hoverSize: 60,
    borderWidth: 2,
    effectEnable: "both",
    borderType: "inside",
    hoverColor: "rgba(255, 255, 255, .2)",
};
let hoverMiddleColor1: string;
let hoverMiddleColor2: string;
let transparentColor: string;
setMiddleColors(revealConfig.hoverColor);

function getRevealConfig(revealItem: RevealItem) {
    return {
        hoverSize: revealItem.hoverSize === void 0 ? revealConfig.hoverSize : revealItem.hoverSize,
        borderWidth: revealItem.borderWidth === void 0 ? revealConfig.borderWidth : revealItem.borderWidth,
        effectEnable: revealItem.effectEnable === void 0 ? revealConfig.effectEnable : revealItem.effectEnable,
        borderType: revealItem.borderType === void 0 ? revealConfig.borderType : revealItem.borderType,
        hoverColor: revealItem.hoverColor === void 0 ? revealConfig.hoverColor : revealItem.hoverColor,
    } as Required<RevalConfig>;
}

function initRevealEffect() {
    hoverCanvas = document.createElement("canvas");
    borderCanvas = document.createElement("canvas");
    document.body.appendChild(hoverCanvas);
    document.body.appendChild(borderCanvas);
    hoverCtx = hoverCanvas.getContext("2d") as CanvasRenderingContext2D;
    borderCtx = borderCanvas.getContext("2d") as CanvasRenderingContext2D;
    
    function setCanvasStyles() {
        Object.assign(hoverCanvas.style, {
            width: `${window.innerWidth}px`,
            height: `${window.innerHeight}px`,
            position: "fixed",
            left: "0px",
            top: "0px",
            pointerEvents: "none",
            zIndex: 9999
        });
        Object.assign(borderCanvas.style, {
            width: `${window.innerWidth}px`,
            height: `${window.innerHeight}px`,
            position: "fixed",
            left: "0px",
            top: "0px",
            pointerEvents: "none",
            zIndex: 9999
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
    setCanvasStyles();

    window.removeEventListener("scroll", clearCanvas);
    window.removeEventListener("resize", setCanvasStyles);
    window.removeEventListener("mousemove", handleMouseMove);

    window.addEventListener("scroll", clearCanvas);
    window.addEventListener("resize", setCanvasStyles);
    window.addEventListener("mousemove", handleMouseMove);
}

function drawEffects(mouseX: number, mouseY: number, hoverEl: HTMLElement) {
    hoverCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    borderCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const isHoverReveal = revealItemsMap.has(hoverEl);
    const hoverRevealConfig = isHoverReveal ?  getRevealConfig(revealItemsMap.get(hoverEl) as RevealItem) : revealConfig;

    
    const effectLeft = mouseX - hoverRevealConfig.hoverSize;
    const effectTop = mouseY - hoverRevealConfig.hoverSize;
    const effectSize = 2 * hoverRevealConfig.hoverSize;
    const effectRect = {
        left: effectLeft,
        top: effectTop,
        right: effectLeft + effectSize,
        bottom: effectTop + effectSize
    } as DOMRect;

    function drawHoverCircle(ctx: CanvasRenderingContext2D, draw2border = false) {
        const gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, hoverRevealConfig.hoverSize)
        
        if (draw2border) {
            gradient.addColorStop(0, revealConfig.hoverColor);
            gradient.addColorStop(1, transparentColor);
        } else {
            gradient.addColorStop(0, hoverMiddleColor2);
            gradient.addColorStop(1, transparentColor);
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(mouseX - hoverRevealConfig.hoverSize, mouseY - hoverRevealConfig.hoverSize, mouseX + hoverRevealConfig.hoverSize, mouseY + hoverRevealConfig.hoverSize);
    }

    // inside hover effect.
    function drawHover() {
        if (isHoverReveal) {
            hoverCtx.globalCompositeOperation = "source-over";
            hoverCtx.fillStyle = "#fff";
            const hoverRect = hoverEl.getBoundingClientRect() as DOMRect;
            hoverCtx.fillRect(hoverRect.left, hoverRect.top, hoverRect.width, hoverRect.height);
    
            hoverCtx.globalCompositeOperation = "destination-in";
            drawHoverCircle(hoverCtx);
        }
    }

    // draw border effect.
    function drawBorder() {
        const effectItems: RevealItem[] = [];
        revealItemsMap.forEach(revealItem => {
            if (revealItem.element) {
                const rect = revealItem.element.getBoundingClientRect() as DOMRect;
                if (isRectangleOverlap(effectRect, rect)) {
                    effectItems.push(revealItem);
                }
            }
            // effectItems.push(revealItem);
        });

        function drawAllRevealBorders() {
            effectItems.forEach(revealItem => {
                const element = revealItem.element;
                if (!element) return;
                const rect = element.getBoundingClientRect() as DOMRect;
                const elBorderWidth = window.getComputedStyle(hoverEl).borderWidth as string;
                const currRevealConfig = getRevealConfig(revealItem);
                const borderWidth = Number(elBorderWidth.replace("px", "")) || currRevealConfig.borderWidth;

                borderCtx.globalCompositeOperation = "source-over";
                borderCtx.lineWidth = borderWidth;
                borderCtx.strokeStyle = "#fff";
                if (borderWidth || currRevealConfig.borderType === "inside") {
                    // draw inside border.
                    borderCtx.strokeRect(rect.x - borderWidth, rect.y - borderWidth, rect.width + borderWidth, rect.height + borderWidth);
                } else {
                    // draw outside border.
                    borderCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);
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

function handleMouseMove(e: MouseEvent) {
    const el = e.target as HTMLElement;
    drawEffects(e.clientX, e.clientY, el);

    // if (el && revealItemsMap.has(el)) {
    //     drawEffects(e.clientX, e.clientY, el);
    // } else {
    //     let isInsideEl = false;
    //     for (const revealItem of revealItemsMap) {
    //         if (revealItem[0] && revealItem[0].contains(el)) {
    //             isInsideEl = true;
    //             drawEffects(e.clientX, e.clientY, revealItem[0]);
    //             break;
    //         }
    //     }
    //     if (!isInsideEl) {
    //         clearCanvas();
    //     }
    // }
}

function checkCanvasCreated() {
    if (!hoverCanvas || !borderCanvas) {
        initRevealEffect();
    }
}

function addRevealItem(revealItem: RevealItem) {
    checkCanvasCreated();
    revealItemsMap.set(revealItem.element, revealItem);
}

function addRevealItems(revealItems: RevealItem[]) {
    checkCanvasCreated();
    revealItems.forEach(revealItem => {
        revealItemsMap.set(revealItem.element, revealItem);
    });
}

function addRevealEl(element: HTMLElement) {
    checkCanvasCreated();
    const revealItem = { element };
    revealItemsMap.set(revealItem.element, revealItem);
}

function addRevealEls(elements: HTMLElement[]) {
    checkCanvasCreated();
    elements.forEach(element => {
        const revealItem = { element };
        revealItemsMap.set(revealItem.element, revealItem);
    });
}

function clearRevealItems() {
    revealItemsMap.clear();
}

function setMiddleColors(hoverColor = revealConfig.hoverColor) {
    const { h, s, l, a } = tinyColor(hoverColor).toHsl();
    hoverMiddleColor1 = tinyColor({ h, s, l, a: a / 4 }).toRgbString();
    hoverMiddleColor2 = tinyColor({ h, s, l, a: a / 8 }).toRgbString();
    transparentColor = tinyColor({ h, s, l, a: 0 }).toRgbString();
}

function setRevealConfig(newConfig: RevalConfig) {
    setMiddleColors(newConfig.hoverColor);

    Object.assign(revealConfig, newConfig);
}


export {
    initRevealEffect,
    clearCanvas,
    handleMouseMove,
    addRevealItem,
    addRevealItems,
    addRevealEl,
    addRevealEls,
    clearRevealItems,
    setRevealConfig
}
