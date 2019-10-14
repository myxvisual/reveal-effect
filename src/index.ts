
let hoverCanvas: HTMLCanvasElement;
let borderCanvas: HTMLCanvasElement;
let hoverCtx: CanvasRenderingContext2D;
let borderCtx: CanvasRenderingContext2D;
let revealItemsMap = new Map<HTMLElement, RevealItem>();

export interface RevalConfig {
    borderWidth?: number;
    hoverSize?: number;
    effectEnable?: "hover" | "border" | "both";
    borderType?: "inside" | "outside";
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
    borderType: "inside"
};

function initRevealEffect() {
    hoverCanvas = document.createElement("canvas");
    borderCanvas = document.createElement("canvas");
    document.body.appendChild(hoverCanvas);
    document.body.appendChild(borderCanvas);
    hoverCtx = hoverCanvas.getContext("2d") as CanvasRenderingContext2D;
    borderCtx = borderCanvas.getContext("2d") as CanvasRenderingContext2D;

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

    window.removeEventListener("scroll", clearCanvas);
    document.documentElement.removeEventListener("mousemove", handleMouseMove);

    document.documentElement.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", clearCanvas);
}

function drawEffects(mouseX: number, mouseY: number, hoverEl: HTMLElement) {
    hoverCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    borderCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const rect = hoverEl.getBoundingClientRect() as DOMRect;
    const revealItem = revealItemsMap.get(hoverEl) as RevealItem;
    const newRevealConfig = {
        hoverSize: revealItem.hoverSize === void 0 ? revealConfig.hoverSize : revealItem.hoverSize,
        borderWidth: revealItem.borderWidth === void 0 ? revealConfig.borderWidth : revealItem.borderWidth,
        effectEnable: revealItem.effectEnable === void 0 ? revealConfig.effectEnable : revealItem.effectEnable,
        borderType: revealItem.borderType === void 0 ? revealConfig.borderType : revealItem.borderType,
    };
    
    const elBorderWidth = window.getComputedStyle(hoverEl).borderWidth as string;
    const borderWidth = Number(elBorderWidth.replace("px", "")) || newRevealConfig.borderWidth;

    const circleGradient = {
        x: mouseX,
        y: mouseY,
        color1: "rgba(255, 255, 255, .1)",
        color2: "rgba(255, 255, 255, 0)",
        r1: 0,
        r2: newRevealConfig.hoverSize
    }

    function drawCircle(ctx: CanvasRenderingContext2D, opacity = 0.1) {
        const gradient = ctx.createRadialGradient(circleGradient.x, circleGradient.y, circleGradient.r1, circleGradient.x, circleGradient.y, circleGradient.r2)
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
        gradient.addColorStop(1, circleGradient.color2);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }

    // inside hover circle.
    function drawHover() {
        hoverCtx.globalCompositeOperation = "source-over";
        hoverCtx.fillStyle = "#fff";
        hoverCtx.fillRect(rect.x, rect.y, rect.width, rect.height);

        hoverCtx.globalCompositeOperation = "destination-in";
        drawCircle(hoverCtx, 0.1);
    }

    // draw inside border.
    function drawBorder() {
        if (newRevealConfig.borderType === "inside") {
            // draw inside border.
            borderCtx.globalCompositeOperation = "source-over";
            borderCtx.fillStyle = circleGradient.color1;
            borderCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
            borderCtx.globalCompositeOperation = "destination-out";
            borderCtx.fillStyle = "#fff";
            borderCtx.fillRect(rect.x + borderWidth, rect.y + borderWidth, rect.width - 2 * borderWidth, rect.height - 2 * borderWidth);
        } else {
            // draw outside border.
            borderCtx.globalCompositeOperation = "source-over";
            borderCtx.fillStyle = circleGradient.color1;
            borderCtx.fillRect(rect.x - borderWidth, rect.y - borderWidth, rect.width + 2 * borderWidth, rect.height + 2 * borderWidth);
            borderCtx.globalCompositeOperation = "destination-out";
            borderCtx.fillStyle = "#fff";
            borderCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }

        borderCtx.globalCompositeOperation = "destination-in";
        drawCircle(borderCtx, 1);
    }

    switch (newRevealConfig.effectEnable) {
        case "hover": {
            drawHover();
            break;
        }
        case "border": {
            drawHover();
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
