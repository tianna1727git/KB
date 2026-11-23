export function PencilSave({size = 18}: {size?: number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 3.5Q9 3 16.2 3.6l4.2 4.1-.3 12.5q-7 .7-16.6-.1Q3 13 3.6 4Z"/>
    <path d="m7.3 3.8.2 5.9q4.5.4 8.1-.2l-.1-5.3M7 19.8l.3-6.6q4.8-.5 9.4.1l.3 6.4M13 5.3l-.1 2.4"/>
    <path opacity=".45" strokeWidth=".7" d="m2.6 7 .2 10m5.4 4.1 9.5-.3"/>
  </svg>;
}
