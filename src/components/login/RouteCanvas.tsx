export function RouteCanvas() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
      viewBox="0 0 640 720"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <path
        d="M48 600 C140 430, 210 360, 320 310 S500 210, 590 120"
        fill="none"
        stroke="#1f8a80"
        strokeWidth="1.5"
        strokeDasharray="6 9"
        opacity="0.55"
      />
      <path
        d="M36 220 C170 250, 230 400, 320 450 S500 560, 610 530"
        fill="none"
        stroke="#c4a056"
        strokeWidth="1.25"
        strokeDasharray="3 11"
        opacity="0.35"
      />
      <circle cx="88" cy="560" r="4" fill="#1f8a80" opacity="0.7" />
      <circle cx="320" cy="310" r="3.5" fill="#c4a056" opacity="0.7" />
      <circle cx="572" cy="136" r="5" fill="#fffcf8" opacity="0.55" />
    </svg>
  );
}
