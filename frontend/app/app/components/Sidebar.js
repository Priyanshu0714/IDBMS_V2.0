"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      name: "Upload",
      href: "/upload",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      name: "Query",
      href: "/query",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-1/5 min-w-[220px] h-screen items-center justify-start border-r border-zinc-200">
      {/* logo part */}
      <div className="flex flex-row w-full h-14 font-bold text-xl items-center justify-center gap-2 text-white bg-amber-500">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
        IDMS
      </div>

      {/* menu bar */}
      <div className="flex flex-col w-full flex-1 items-center justify-start px-3 py-4 gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-row w-full h-10 px-3 items-center gap-3 rounded-lg text-sm cursor-pointer transition-colors ${
                isActive
                  ? "bg-amber-50 border border-amber-200 text-amber-700 font-medium"
                  : "hover:bg-zinc-100 text-zinc-600"
              }`}
            >
              {item.icon}
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* footer / user profile */}
      <div className="flex flex-col w-full h-auto bg-zinc-800 px-3 py-3 gap-2">
        {/* User identification */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900/60 text-zinc-200">
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center font-bold text-xs text-white uppercase">
            {user?.username ? user.username.charAt(0) : "U"}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-zinc-200 truncate">
              {user?.username || "Guest"}
            </span>
            <span className="text-[10px] text-zinc-400 truncate">
              Personal Space
            </span>
          </div>
        </div>

        {/* logout button */}
        <button
          onClick={logout}
          className="flex flex-row w-full h-9 px-3 items-center gap-2 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-medium cursor-pointer transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}
