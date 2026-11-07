export default function WorkshopBackdrop() {
  return <div className="workshop-scene" aria-hidden="true">
    <svg className="neon-waves" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none">
      <defs>
        <linearGradient id="neon-wave-color" x1="0" y1="0" x2="1600" y2="1000" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6b9984" stopOpacity=".05"/>
          <stop offset=".27" stopColor="#a3d67c" stopOpacity=".7"/>
          <stop offset=".5" stopColor="#c4f563"/>
          <stop offset=".76" stopColor="#88b58e" stopOpacity=".65"/>
          <stop offset="1" stopColor="#608b80" stopOpacity=".08"/>
        </linearGradient>
        <path id="neon-wave-a" d="M-160 270C130 640 345 70 700 350S1240 1040 1770 470"/>
        <path id="neon-wave-b" d="M-130 760C210 920 260 280 650 510S1220 80 1750 330"/>
        <path id="neon-wave-c" d="M-150 570C240 110 415 900 900 640S1280 310 1750 780"/>
      </defs>
      {['a', 'b', 'c'].map(wave => <g key={wave} className={`neon-wave neon-wave-${wave}`} stroke="url(#neon-wave-color)">
        <use href={`#neon-wave-${wave}`} strokeWidth="5" opacity=".06"/>
        <use href={`#neon-wave-${wave}`} strokeWidth="1.3"/>
      </g>)}
    </svg>
    <div className="neon-side-mist neon-side-mist-left"/>
    <div className="neon-side-mist neon-side-mist-right"/>
    <div className="neon-wave-shade"/>
  </div>
}
