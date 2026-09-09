import { useState } from 'react'
import { useSupporterMotion } from '../lib/supporterMotion'
import '../supporter.css'

export function MushroomFriend({ className = '' }) {
  return <svg className={`mushroom-friend ${className}`} viewBox="0 0 80 84" fill="none" aria-hidden="true">
    <ellipse className="mushroom-soil" cx="40" cy="76" rx="29" ry="4" fill="currentColor" opacity=".16" />
    <g className="mushroom-grow">
      <path d="M31 43c2 10 0 17-4 25-2 5 3 9 13 9s15-4 13-9c-4-8-6-15-4-25" fill="#eee0b9" stroke="#b69a68" strokeWidth="1.2" />
      <path d="M32 49c-5 2-8 7-10 6" stroke="#ddc794" strokeWidth="3.5" strokeLinecap="round" />
      <g className="mushroom-wave"><path d="M49 49c7 7 10 1 12-5m0 0-1-4m1 4 4-2" stroke="#eee0b9" strokeWidth="3" strokeLinecap="round" /></g>
      <path d="M10 40C11 25 23 11 40 11s29 14 30 29c-6 7-18 9-30 9S16 47 10 40Z" fill="#ab6957" stroke="#e1a886" strokeWidth="1.2" />
      <path d="M12 40c17-5 39-5 56 0-9 5-17 6-28 6s-21-2-28-6Z" fill="#d8b48a" />
      <path d="M18 31c5-10 12-14 19-15" stroke="#f0c597" strokeWidth="2" strokeLinecap="round" opacity=".65" />
      <ellipse cx="27" cy="26" rx="4" ry="2.4" transform="rotate(-24 27 26)" fill="#efd8b5" opacity=".8" />
      <ellipse cx="49" cy="23" rx="3.2" ry="2" transform="rotate(22 49 23)" fill="#efd8b5" opacity=".8" />
      <ellipse cx="59" cy="34" rx="3.2" ry="2" fill="#efd8b5" opacity=".6" />
      <path d="M34 54v2m12-2v2" stroke="#463634" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M37 61q3 3 6 0" stroke="#765243" strokeWidth="1.6" strokeLinecap="round" />
    </g>
    <path d="m15 76-4-7m8 7 1-5m42 5 4-6" stroke="#879d79" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
}

export default function SupporterSprout({ collection = 'fungi', supporter = false }) {
  const [dismissed, setDismissed] = useState(false)
  const { paused } = useSupporterMotion()
  return <a className={`supporter-sprout${dismissed ? ' sprout-dismissed' : ''}${paused ? ' sprout-paused' : ''}`} href={`/supporters${collection === 'herbs' ? '?collection=herbs' : ''}`}
    aria-label={supporter ? 'Your supporter membership' : 'Support the project for 10 US dollars per year'}
    onKeyDown={event => { if (event.key === 'Escape') setDismissed(true) }} onBlur={() => setDismissed(false)}>
    <MushroomFriend />
    <span className="sprout-bubble"><span>{supporter ? 'You help this forest grow.' : 'Help this little world grow.'}</span><strong>{supporter ? 'Your supporter membership ↗' : 'Support the project · $10/year ↗'}</strong></span>
  </a>
}
