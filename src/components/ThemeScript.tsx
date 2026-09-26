// Runs before paint so the saved theme / focus mode never flashes the default.
const script = `(function(){try{var t=localStorage.getItem('if:theme');if(t!=='light'&&t!=='sepia'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;if(localStorage.getItem('if:focus')==='on'&&location.pathname.split('/').filter(Boolean).length===2){document.documentElement.dataset.focus='on';}}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
