import React from "react";
import { motion } from "framer-motion";
import { StatCard } from "../ui/StatCard.jsx";

export function AtlasShell({ children, metrics }) {
  return (
    <main id="top" className="relative min-h-screen overflow-hidden">
      <div className="atlas-noise" />
      <div className="atlas-page">
        <nav className="site-masthead" aria-label="Portfolio navigation">
          <a className="site-wordmark" href="https://rodolfokusulas.com" aria-label="Rodolfo Kusulas home">
            <img className="site-wordmark-logo" src="/assets/rodolfo-kusulas-logo.svg" alt="Rodolfo Kusulas" />
          </a>
          <div className="site-links">
            <a href="https://rodolfokusulas.com/project/">Project overview</a>
            <a href="https://rodolfokusulas.com/about/">About Rodolfo</a>
          </div>
        </nav>
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="hero-shell"
        >
          <section className="hero-title relative z-10">
            <p className="hero-kicker">PUBLIC DATA ATLAS · 2025–2026</p>
            <h1>Mind Your Feelings <em>Data Atlas</em></h1>
          </section>

          <section className="hero-intro relative z-10">
            <p className="hero-lead">A living emotional cartography translating community feeling into collective memory.</p>
            <p>
              Explore how 818 anonymous contributions move through emotion, time, color, relation, and the body. Every view begins with the full collective field; filters let you follow specific patterns without exposing personal information.
            </p>
            <img className="hero-logo" src="/assets/mind-your-feelings-logo.svg" alt="Mind Your Feelings" />
          </section>

          <div className="hero-stat-row relative z-10 mt-8">
            <StatCard label="Participants" value={metrics.total} helper="Anonymous contributions" />
            <StatCard label="Location" value="Johnson Public Library" helper="Hackensack, NJ" />
            <StatCard label="Emotions" value={metrics.emotions.filter((item) => item.count > 0).length} helper="Unified categories" />
            <StatCard label="Colors" value={metrics.colors.length} helper="Participant-selected hues" />
          </div>
        </motion.header>

        <div className="relative z-10 mt-14 space-y-10">{children}</div>
        <footer className="site-footer">
          <p>Mind Your Feelings Data Atlas</p>
          <p>Rodolfo Kusulas · ©2026</p>
          <a href="#top">Back to top ↑</a>
        </footer>
      </div>
    </main>
  );
}
