import React from 'react';
import LenisSmoothScroll from './components/LenisSmoothScroll';
import CustomCursor from './components/CustomCursor';
import Nav from './components/Nav';
import HeroSection from './components/HeroSection';
import ShowcaseBand from './components/ShowcaseBand';
import FeatureSectionA from './components/FeatureSectionA';
import FeatureSectionB from './components/FeatureSectionB';
import AIChatDemoSection from './components/AIChatDemoSection';
import SafeRotationSection from './components/SafeRotationSection';
import FanReviewCarousel from './components/FanReviewCarousel';
import VerdictMarquee from './components/VerdictMarquee';
import LiveCounterSection from './components/LiveCounterSection';
import FinalCTAAndFooter from './components/FinalCTAAndFooter';

export default function HomePage() {
  return (
    <LenisSmoothScroll>
      <CustomCursor />
      <Nav />
      <main className="relative bg-[#050505] text-[#E2E8F0] selection:bg-[#D152F5] selection:text-[#050505]">
        {/* Hero Section */}
        <HeroSection />

        {/* F2: Lavender Showcase Poster Band with cropped watermark & monitor mockup */}
        <ShowcaseBand />

        {/* Feature A: Pinned Policy Guard Screen */}
        <FeatureSectionA />

        {/* Feature B: Move Money & Verdict Log */}
        <FeatureSectionB />

        {/* AI Section: Claude Chat Card & Pastel Mesh */}
        <AIChatDemoSection />

        {/* 4-Step Rotation Onboarding Flow */}
        <SafeRotationSection />

        {/* Social Proof: Fan Review Carousel */}
        <FanReviewCarousel />

        {/* Edge-Blurred Logo / Verdict Marquee */}
        <VerdictMarquee />

        {/* Live Ticking Counter on Silver/Violet Accent Band */}
        <LiveCounterSection />

        {/* Final CTA & Footer */}
        <FinalCTAAndFooter />
      </main>
    </LenisSmoothScroll>
  );
}
