"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  GlobeIcon,
  MenuIcon,
  CloseIcon,
  CheckIcon,
} from "@/components/icons";
import { Brand } from "@/components/brand";
import { siteConfig } from "@/lib/site";
import Section from "./section";

export function SiteNav() {
  const [langOpen, setLangOpen] = useState(false);
  const [activeLang, setActiveLang] = useState("en");
  const [mobileOpen, setMobileOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    if (langOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [langOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLangOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentLang =
    siteConfig.languages.find((l) => l.code === activeLang) ?? siteConfig.languages[0];

  return (
    <Section className="site-nav-section">
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label={`${siteConfig.productName} home`}>
          <Brand />
        </Link>

        {/* ── Navigation Links ────────────────────────────────────── */}
        <div className="nav-center">
          <ul className="nav-links">
            {siteConfig.navigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Navigation Actions ──────────────────────────────────── */}
        <div className="nav-actions">
          {/* Multilingual Selector Dropdown */}
          <div className="lang-switcher" ref={langRef}>
            <button
              className="lang-trigger"
              onClick={() => setLangOpen((prev) => !prev)}
              aria-expanded={langOpen}
              aria-haspopup="listbox"
              aria-label={`Language: currently ${currentLang.label} (${currentLang.native}). Click to change language`}
              type="button"
            >
              <GlobeIcon />
              <span className="lang-trigger-glyph" aria-hidden="true">
                {currentLang.glyph}
              </span>
              <span className="lang-trigger-code">{currentLang.code.toUpperCase()}</span>
              <span
                className={`lang-trigger-chevron ${langOpen ? "is-open" : ""}`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {langOpen && (
              <div className="lang-dropdown" role="listbox" aria-label="Select language">
                <div className="lang-dropdown-header">
                  <span className="lang-dropdown-title">Select language</span>
                  <span className="lang-dropdown-subtitle">भाषा चुनें</span>
                </div>
                <div className="lang-options-grid">
                  {siteConfig.languages.map((lang) => {
                    const isSelected = lang.code === activeLang;
                    return (
                      <button
                        key={lang.code}
                        className={`lang-option ${isSelected ? "lang-option-active" : ""}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setActiveLang(lang.code);
                          setLangOpen(false);
                          if (typeof document !== "undefined") {
                            document.documentElement.lang = lang.code;
                            if ("dir" in lang && lang.dir) {
                              document.documentElement.dir = lang.dir;
                            } else {
                              document.documentElement.dir = "ltr";
                            }
                          }
                        }}
                        type="button"
                      >
                        <span className="lang-option-glyph" aria-hidden="true">
                          {lang.glyph}
                        </span>
                        <div className="lang-option-text">
                          <span className="lang-option-native">{lang.native}</span>
                          <span className="lang-option-label">
                            {lang.label} · {lang.note}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="lang-option-check" aria-hidden="true">
                            <CheckIcon />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Report CTA — original animation & markup preserved completely */}
          <Link className="nav-cta" href="/reports/new">
            <span className="nav-cta-label">Report a hazard</span>
            <span className="nav-cta-icon-track" aria-hidden="true">
              <span className="nav-cta-icon">
                <span className="nav-cta-arrow nav-cta-arrow-launch">
                  <ArrowUpRight />
                </span>
                <span className="nav-cta-arrow nav-cta-arrow-continue">
                  <ArrowRight />
                </span>
              </span>
            </span>
          </Link>

          {/* Mobile hamburger menu toggle */}
          <button
            className="nav-mobile-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            type="button"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* ── Mobile menu drawer ──────────────────────────────────── */}
        {mobileOpen && (
          <div className="nav-mobile-drawer" role="dialog" aria-label="Mobile navigation">
            <ul className="nav-mobile-links">
              {siteConfig.navigation.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setMobileOpen(false)}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </Section>
  );
}
