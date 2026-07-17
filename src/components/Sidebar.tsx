'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (status === 'loading' || !session) {
    return null; // Don't show sidebar on login page or while loading
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className={styles.mobileBar}>
        <span className={styles.mobileLogo}>I &amp; I Autos</span>
        <button
          className={styles.hamburger}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <span className={open ? styles.barTop_open : styles.barTop} />
          <span className={open ? styles.barMid_open : styles.barMid} />
          <span className={open ? styles.barBot_open : styles.barBot} />
        </button>
      </div>

      {/* Overlay */}
      {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <div className={styles.logo}>
          <h2>I &amp; I Autos</h2>
        </div>

        <nav className={styles.nav}>
          <Link
            href="/"
            className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
            onClick={() => setOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/sales/new"
            className={`${styles.navLink} ${pathname === '/sales/new' ? styles.active : ''}`}
            onClick={() => setOpen(false)}
          >
            Add New Sale
          </Link>
        </nav>

        <div className={styles.footer}>
          <button className={styles.logoutBtn} onClick={() => signOut()}>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
