import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

export async function launchArchTerm(): Promise<{ app: ElectronApplication; page: Page }> {
  const builtMain = path.resolve(process.cwd(), 'out/main/index.js');
  if (!fs.existsSync(builtMain)) {
    throw new Error('Missing out/main/index.js. Run `npm run build` before Electron visual tests.');
  }

  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: 'http://127.0.0.1:4173/?e2e=1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      NODE_ENV: 'test',
    },
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });

  return { app, page };
}

export async function closeArchTerm(app: ElectronApplication): Promise<void> {
  if (!app) return;
  await app.close();
}

export async function pressPrimaryShortcut(page: Page, key: string): Promise<void> {
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+${key}`);
}

