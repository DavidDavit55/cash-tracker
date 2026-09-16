import { useRef, useEffect, useState } from 'react';

// לוח חתימה פשוט (עכבר/מגע) - מחזיר dataURL של PNG דרך onChange, או null אם ריק.
export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasSignature = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
  }, []);

  const posFromEvent = (e) => {
    const rect = e.target.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = posFromEvent(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = posFromEvent(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    hasSignature.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(!hasSignature.current);
    onChange(hasSignature.current ? canvasRef.current.toDataURL('image/png') : null);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    hasSignature.current = false;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={320}
        height={140}
        style={{ width: '100%', maxWidth: '320px', height: '140px', border: '2px dashed var(--border)', borderRadius: '10px', touchAction: 'none', display: 'block' }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      {!empty && (
        <button type="button" onClick={clear} style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
          מחק וחתום שוב
        </button>
      )}
    </div>
  );
}
