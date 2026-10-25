/** Offline support (service worker), updates, and the "install this app" card. */

const DISMISS_KEY = 'book-scanner.install-dismissed';

/** Chrome's install prompt event, not in the standard DOM types. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  // Other iOS browsers can't add to the home screen the same way.
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Registers the service worker (production builds only) and shows `toast` when a new
 * version has been downloaded; tapping its button switches to it.
 */
export function registerServiceWorker(toast: HTMLElement, reloadButton: HTMLButtonElement): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  // Reload only after the user accepted an update; the first install also changes the
  // controller (clients.claim), and that must not reload the page under them.
  let updateAccepted = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateAccepted) return;
    updateAccepted = false;
    location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      const offer = (worker: ServiceWorker) => {
        toast.hidden = false;
        reloadButton.onclick = () => {
          updateAccepted = true;
          worker.postMessage('skip-waiting');
        };
      };
      // An update downloaded on a previous visit, still waiting.
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          // With no controller this is the first install, not an update.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
        });
      });
      // Look for updates when the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void reg.update().catch(() => {});
      });
    } catch (err) {
      console.warn('Offline support is unavailable:', err);
    }
  });
}

/** Shows `card` with an Install button (Android/desktop Chrome) or Add to Home Screen steps (iOS). */
export function setupInstallCard(card: HTMLElement, text: HTMLElement, install: HTMLButtonElement, dismiss: HTMLElement): void {
  if (isStandalone() || dismissed()) return;
  let deferred: BeforeInstallPromptEvent | null = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    text.textContent = 'Install Book Scanner to open it from your home screen, like an app. It also works offline.';
    install.hidden = false;
    card.hidden = false;
  });
  window.addEventListener('appinstalled', () => (card.hidden = true));

  if (isIosSafari()) {
    text.textContent = 'To install: tap the Share button, then “Add to Home Screen”. It then opens like an app and works offline.';
    install.hidden = true;
    card.hidden = false;
  }

  install.addEventListener('click', async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome === 'accepted') card.hidden = true;
  });
  dismiss.addEventListener('click', () => {
    card.hidden = true;
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Then it just shows again next time.
    }
  });
}
