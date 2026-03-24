import { useRef, useState, useEffect } from "react";
import { socket } from "../services/socket";

const BRUSH_COLORS = [
  "#111827", // black
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#a855f7", // purple
];

function Whiteboard({ roomId, canDraw }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#111827");
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const lastPointRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      // Whiteboard should be white, not transparent/black.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Update active tool style without resetting/resizing canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = isEraser ? "#ffffff" : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [brushColor, brushSize, isEraser]);

  useEffect(() => {
    if (!roomId) return;

    const drawStroke = (ctx, canvas, points, strokeStyle, lineWidth) => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.strokeStyle = strokeStyle || "#111827";
      ctx.lineWidth = lineWidth || 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i < points.length; i++) {
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x * w, points[i - 1].y * h);
        ctx.lineTo(points[i].x * w, points[i].y * h);
        ctx.stroke();
      }
    };

    const onStroke = ({ points, strokeStyle, lineWidth }) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      drawStroke(ctx, canvas, points, strokeStyle, lineWidth);
    };

    const onClear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };

    socket.on("whiteboard-stroke", onStroke);
    socket.on("whiteboard-clear", onClear);

    socket.emit("whiteboard-get-state", { roomId }, ({ strokes }) => {
      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas || !strokes?.length) return;
        for (const stroke of strokes) {
          drawStroke(ctx, canvas, stroke.points, stroke.strokeStyle, stroke.lineWidth);
        }
      }, 100);
    });

    return () => {
      socket.off("whiteboard-stroke", onStroke);
      socket.off("whiteboard-clear", onClear);
    };
  }, [roomId]);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX ?? e.touches?.[0]?.clientX) - rect.left,
      y: (e.clientY ?? e.touches?.[0]?.clientY) - rect.top,
    };
  };

  const startDrawing = (e) => {
    if (!canDraw) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const activeColor = isEraser ? "#ffffff" : brushColor;
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { x, y } = getCoords(e);
    const rect = canvas.getBoundingClientRect();
    const nx = x / rect.width;
    const ny = y / rect.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPointRef.current = { x: nx, y: ny };
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!canDraw || !isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(e);
    const rect = canvas.getBoundingClientRect();
    const nx = x / rect.width;
    const ny = y / rect.height;
    ctx.lineTo(x, y);
    ctx.stroke();

    if (roomId && lastPointRef.current) {
      const points = [lastPointRef.current, { x: nx, y: ny }];
      socket.emit("whiteboard-stroke", {
        roomId,
        points,
        strokeStyle: ctx.strokeStyle,
        lineWidth: ctx.lineWidth,
      });
    }
    lastPointRef.current = { x: nx, y: ny };
  };

  const stopDrawing = () => {
    if (canDraw && isDrawing) {
      lastPointRef.current = null;
    }
    setIsDrawing(false);
  };

  const startDrawingRef = useRef(startDrawing);
  const drawRef = useRef(draw);
  const stopDrawingRef = useRef(stopDrawing);
  startDrawingRef.current = startDrawing;
  drawRef.current = draw;
  stopDrawingRef.current = stopDrawing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const touchStart = (e) => {
      e.preventDefault();
      startDrawingRef.current(e);
    };
    const touchMove = (e) => {
      e.preventDefault();
      drawRef.current(e);
    };
    const touchEnd = () => stopDrawingRef.current();

    canvas.addEventListener("touchstart", touchStart, { passive: false });
    canvas.addEventListener("touchmove", touchMove, { passive: false });
    canvas.addEventListener("touchend", touchEnd);
    canvas.addEventListener("touchcancel", touchEnd);

    return () => {
      canvas.removeEventListener("touchstart", touchStart);
      canvas.removeEventListener("touchmove", touchMove);
      canvas.removeEventListener("touchend", touchEnd);
      canvas.removeEventListener("touchcancel", touchEnd);
    };
  }, []);

  const handleClear = () => {
    if (!canDraw || !roomId) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    socket.emit("whiteboard-clear", { roomId });
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className={`w-full h-full touch-none rounded-xl bg-white block ${
          canDraw ? "cursor-crosshair" : "cursor-default"
        }`}
        style={{ touchAction: "none" }}
      />
      {canDraw && (
        <div className="absolute top-2 left-2 right-2 flex flex-wrap items-center gap-2 rounded-xl bg-black/55 px-2 py-2">
          <div className="flex items-center gap-1">
            {BRUSH_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  setBrushColor(color);
                  setIsEraser(false);
                }}
                className={`w-6 h-6 rounded-full border-2 ${
                  !isEraser && brushColor === color ? "border-white" : "border-white/30"
                }`}
                style={{ backgroundColor: color }}
                title={`Color ${color}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 text-white text-xs">
            <span>Size</span>
            <input
              type="range"
              min={1}
              max={16}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24"
            />
          </div>

          <button
            onClick={() => setIsEraser((prev) => !prev)}
            className={`px-2 py-1 rounded-md text-xs ${
              isEraser ? "bg-amber-400 text-black" : "bg-white/20 text-white"
            }`}
            title="Toggle eraser"
          >
            Eraser
          </button>

          <button
            onClick={handleClear}
            className="ml-auto px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

export default Whiteboard;
