import React from 'react';
import LenisSmoothScroll from './components/LenisSmoothScroll';
import CustomCursor from './components/CustomCursor';
import Nav from './components/Nav';
import HeroSection from './components/HeroSection';
import FeatureSectionA from './components/FeatureSectionA';
import GreenCardBand from './components/GreenCardBand';
import FeatureSectionB from './components/FeatureSectionB';
import FeatureSectionC from './components/FeatureSectionC';
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
      <main className="relative bg-[#03045E] text-[#CAF0F8] selection:bg-[#00B4D8] selection:text-[#03045E]">
        {/* Hero Section */}
        <HeroSection />

        {/* Feature A: Pinned Policy Guard Screen */}
        <FeatureSectionA />

        {/* Green Band: Interactive 3D Card (Almighty Card) */}
        <GreenCardBand />

        {/* Feature B: Move Money & Verdict Log */}
        <FeatureSectionB />

        {/* Feature C: Invest / Glowing Heartbeat Pulse */}
        <FeatureSectionC />

        {/* AI Section: Claude Chat Card & Pastel Mesh */}
        <AIChatDemoSection />

        {/* 4-Step Rotation Onboarding Flow */}
        <SafeRotationSection />

        {/* Social Proof: Fan Review Carousel */}
        <FanReviewCarousel />

        {/* Edge-Blurred Logo / Verdict Marquee */}
        <VerdictMarquee />

        {/* Live Ticking Counter on Green Band */}
        <LiveCounterSection />

        {/* Final CTA & Footer */}
        <FinalCTAAndFooter />
      </main>
    </LenisSmoothScroll>
  );
}
