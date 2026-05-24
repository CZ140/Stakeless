import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

// The Vault app shell: fixed sidebar + top bar, with a scrolling content area.
// Pages render their content as children inside <main>. As more screens are
// migrated to the Vault design they should be wrapped in this shell.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main-col">
        <TopBar />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
