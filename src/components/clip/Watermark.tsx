interface WatermarkProps {
  size?: "sm" | "md";
}

const styles = {
  sm: {
    wrapper: "absolute bottom-7 right-2 z-20 pointer-events-none select-none",
    text: "bg-black/60 text-white/90 text-[10px] font-medium px-1.5 py-0.5 rounded tracking-wide",
  },
  md: {
    wrapper: "absolute bottom-2 right-3 z-20 pointer-events-none select-none",
    text: "bg-black/60 text-white/90 text-[11px] font-semibold px-2 py-0.5 rounded tracking-wide",
  },
};

export function Watermark({ size = "sm" }: WatermarkProps) {
  const s = styles[size];
  return (
    <div className={s.wrapper} aria-hidden="true">
      <span className={s.text}>reflix.dev</span>
    </div>
  );
}
