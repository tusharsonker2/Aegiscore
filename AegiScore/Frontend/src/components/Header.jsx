import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { disablePageScroll, enablePageScroll } from "scroll-lock";
import { useAuth } from "../contexts/AuthContext";
import MenuSvg from "../assets/svg/MenuSvg";
import { HamburgerMenu } from "./design/Header";
import './Header.css';

const Header = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [openNavigation, setOpenNavigation] = useState(false);

  const toggleNavigation = () => {
    setOpenNavigation((prev) => {
      if (prev) enablePageScroll();
      else disablePageScroll();
      return !prev;
    });
  };

  const handleClick = () => {
    if (openNavigation) {
      enablePageScroll();
      setOpenNavigation(false);
    }
  };

  const publicNav = [
    { id: "0", title: "PLATFORM", url: "/#platform" },
    { id: "1", title: "CAPABILITIES", url: "/#capabilities" },
    { id: "2", title: "DOCS", url: "/#docs" },
    { id: "3", title: "PRICING", url: "/#pricing" },
  ];

  const protectedNav = [
    { id: "d1", title: "DASHBOARD", url: "/dashboard" },
    { id: "d2", title: "SOC", url: "/soc" },
    { id: "d3", title: "LOGS", url: "/logs" },
    { id: "d4", title: "AUDIT", url: "/audit" },
    { id: "d8", title: "AGENT CHAT", url: "/agent-chat" },
    { id: "d7", title: "INCIDENTS", url: "/incidents" },
    { id: "d5", title: "NETWORK", url: "/network-graph" },
    { id: "d6", title: "SETTINGS", url: "/settings" },
  ];

  const navItems = user ? protectedNav : publicNav;

  return (
    <div className={`fixed top-0 left-0 w-full z-50 terminal-header-nav ${
      openNavigation ? "bg-[#080C10]" : "bg-[#080C10]/95 backdrop-blur-sm"
    }`}>
      <div className="flex items-center justify-between px-5 lg:px-7.5 xl:px-10 py-4 lg:py-0 h-[5rem]">
        
        {/* LOGO SECTION */}
        <div className="flex items-center cursor-pointer gap-3"
          onClick={() => navigate(user ? '/dashboard' : '/')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="terminal-logo-text">AEGISCORE</span>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className={`${openNavigation ? "flex" : "hidden"} fixed top-[5rem] left-0 right-0 bottom-0 bg-[#080C10] lg:static lg:flex lg:bg-transparent`}>
          <div className="relative z-2 flex flex-col items-center justify-center m-auto lg:flex-row gap-8 lg:gap-6 xl:gap-8">
            {navItems.map((item) => (
              <a key={item.id} href={item.url} onClick={handleClick}
                className={`terminal-nav-link ${
                  item.url === pathname ? "active" : ""
                }`}>
                {item.title}
              </a>
            ))}
          </div>
          <HamburgerMenu />
        </nav>

        {/* CTA BUTTON / USER PROFILE */}
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="hidden lg:block text-xs" style={{fontFamily: 'JetBrains Mono, monospace', color: '#7D8590'}}>
                {user.username} <span style={{color: '#00D4FF'}}>({user.role})</span>
              </span>
              <button className="terminal-btn-outline hidden lg:flex" onClick={() => { logout(); navigate('/'); }}>
                LOGOUT
              </button>
            </>
          ) : (
            <button className="terminal-btn-outline hidden lg:flex" onClick={() => navigate('/login')}>
              SIGN IN
            </button>
          )}
          <button className="lg:hidden p-2 text-[#00D4FF]" onClick={toggleNavigation}>
            <MenuSvg openNavigation={openNavigation} />
          </button>
        </div>
      </div>
      
      {/* SCANNING LINE ANIMATION */}
      <div className="nav-scanning-line"></div>
    </div>
  );
};

export default Header;