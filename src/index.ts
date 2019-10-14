let hoverCanvas: HTMLCanvasElement;
let borderCanvas: HTMLCanvasElement;
let hoverCtx: CanvasRenderingContext2D;
let borderCtx: CanvasRenderingContext2D;
let revealItemsMap = new Map<HTMLElement, RevealItem>();

// TODO: Add BorderRadius.
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
    document.documentElement.removeEventListener("mousemove", handleMouseMove);

    window.addEventListener("scroll", clearCanvas);
    window.addEventListener("resize", setCanvasStyles);
    document.documentElement.addEventListener("mousemove", handleMouseMove);
}

function drawEffects(mouseX: number, mouseY: number, hoverEl: HTMLElement) {
    hoverCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    borderCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const hoverRect = hoverEl.getBoundingClientRect() as DOMRect;

    const revealItem = revealItemsMap.get(hoverEl) as RevealItem;
    const newRevealConfig = getRevealConfig(revealItem);

    const circleGradient = {
        x: mouseX,
        y: mouseY,
        color1: revealConfig.hoverColor,
        color2: "rgba(255, 255, 255, 0)",
        r1: 0,
        r2: newRevealConfig.hoverSize
    }

    function drawCircle(ctx: CanvasRenderingContext2D) {
        const gradient = ctx.createRadialGradient(circleGradient.x, circleGradient.y, circleGradient.r1, circleGradient.x, circleGradient.y, circleGradient.r2)
        gradient.addColorStop(0, circleGradient.color1);
        gradient.addColorStop(1, circleGradient.color2);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }

    // inside hover effect.
    function drawHover() {
        hoverCtx.globalCompositeOperation = "source-over";
        hoverCtx.fillStyle = "#fff";
        hoverCtx.fillRect(hoverRect.x, hoverRect.y, hoverRect.width, hoverRect.height);

        hoverCtx.globalCompositeOperation = "destination-in";
        drawCircle(hoverCtx);
    }

    // draw border effect.
    function drawBorder() {
        const left = mouseX - newRevealConfig.hoverSize;
        const top = mouseY - newRevealConfig.hoverSize;
        const effectRect = {
            left: left,
            top: top,
            right: left + 2 * newRevealConfig.hoverSize,
            bottom: top + 2 * newRevealConfig.hoverSize
        } as DOMRect;
        const effectItems: RevealItem[] = [];
        revealItemsMap.forEach(revealItem => {
            if (revealItem.element) {
                const rect = revealItem.element.getBoundingClientRect() as DOMRect;
                const isNotIntersect =
                    (effectRect.right < rect.left) ||
                    (effectRect.left > rect.right) ||
                    (effectRect.bottom < rect.top) ||
                    (effectRect.top > rect.bottom);

                if (!isNotIntersect) {
                    if (!isRectangleOverlap(hoverRect, rect) && revealItem.element !== hoverEl) {
                        effectItems.push(revealItem);
                    }
                }
            }
        });
        effectItems.push(revealItem);

        function drawBorders() {
            effectItems.forEach(revealItem => {
                const element = revealItem.element;
                const rect = element.getBoundingClientRect() as DOMRect;
                const elBorderWidth = window.getComputedStyle(hoverEl).borderWidth as string;
                const currRevealConfig = getRevealConfig(revealItem);
                const borderWidth = Number(elBorderWidth.replace("px", "")) || currRevealConfig.borderWidth;
                
                if (newRevealConfig.borderType === "inside") {
                    // draw inside border.
                    borderCtx.globalCompositeOperation = "source-over";
                    borderCtx.fillStyle = "#fff";
                    borderCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
                } else {
                    // draw outside border.
                    borderCtx.globalCompositeOperation = "source-over";
                    borderCtx.fillStyle = "#fff";
                    borderCtx.fillRect(rect.x - borderWidth, rect.y - borderWidth, rect.width + 2 * borderWidth, rect.height + 2 * borderWidth);
                }
            });
            effectItems.forEach(revealItem => {
                const element = revealItem.element;
                const rect = element.getBoundingClientRect() as DOMRect;
                const elBorderWidth = window.getComputedStyle(hoverEl).borderWidth as string;
                const currRevealConfig = getRevealConfig(revealItem);
                const borderWidth = Number(elBorderWidth.replace("px", "")) || currRevealConfig.borderWidth;

                if (newRevealConfig.borderType === "inside") {
                    // draw inside border.
                    borderCtx.globalCompositeOperation = "destination-out";
                    borderCtx.fillStyle = "#fff";
                    borderCtx.fillRect(rect.x + borderWidth, rect.y + borderWidth, rect.width - 2 * borderWidth, rect.height - 2 * borderWidth);
                } else {
                    // draw outside border.
                    borderCtx.globalCompositeOperation = "destination-out";
                    borderCtx.fillStyle = "#fff";
                    borderCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
                }
            });
        }

        drawBorders();
        borderCtx.globalCompositeOperation = "destination-in";
        drawCircle(borderCtx);
    }

    switch (newRevealConfig.effectEnable) {
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
    if (el && revealItemsMap.has(el)) {
        drawEffects(e.clientX, e.clientY, el);
    } else {
        let isInsideEl = false;
        for (const revealItem of revealItemsMap) {
            if (revealItem[0] && revealItem[0].contains(el)) {
                isInsideEl = true;
                drawEffects(e.clientX, e.clientY, revealItem[0]);
                break;
            }
        }
        if (!isInsideEl) {
            clearCanvas();
        }
    }
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

function setRevealConfig(newConfig: RevalConfig) {
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
